import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redisClient } from '../config/redis';

// Per-IP rate limiter (10 requests per minute by default)
const ipLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rl_ip',
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10'),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000') / 1000,
  blockDuration: 60, // Block for 1 minute if exceeded
});

/**
 * IP-based rate limiting middleware
 * Limits requests per IP address to prevent abuse
 */
export async function ipRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    await ipLimiter.consume(ip, 1);
    next();
  } catch (rateLimiterRes: any) {
    const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;

    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Try again in ${secs} seconds.`,
      retryAfter: secs,
    });
  }
}

/**
 * User-based rate limiting (tier-aware)
 * Different limits for anonymous, free, premium, and enterprise users
 */
export async function userRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      // Anonymous users have strict limits
      const anonLimiter = new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'rl_anon',
        points: parseInt(process.env.RATE_LIMIT_ANONYMOUS_PER_DAY || '3'),
        duration: 86400, // 24 hours
      });

      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      await anonLimiter.consume(ip, 1);

      next();
      return;
    }

    // Get tier-based limits
    const limits = getTierLimits(req.user.tier);

    const userLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: `rl_user_${req.user.tier}`,
      points: limits.requestsPerDay,
      duration: 86400, // 24 hours
    });

    const result = await userLimiter.consume(req.user.id, 1);

    // Add rate limit info to response headers
    res.set({
      'X-RateLimit-Limit': String(limits.requestsPerDay),
      'X-RateLimit-Remaining': String(result.remainingPoints),
      'X-RateLimit-Reset': String(new Date(Date.now() + result.msBeforeNext).toISOString()),
    });

    next();
  } catch (rateLimiterRes: any) {
    const secs = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;

    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Daily limit exceeded',
      message: `You've reached your daily limit. Resets in ${Math.ceil(secs / 3600)} hours.`,
      retryAfter: secs,
      limit: rateLimiterRes.consumedPoints + rateLimiterRes.remainingPoints,
      remaining: 0,
    });
  }
}

// Import tier limits from config
import { getTierLimits as getConfigTierLimits } from '../config/limits';

interface TierLimits {
  requestsPerDay: number;
  maxTokens: number;  // Renamed to maxOutputTokens in config, but kept here for compatibility
}

/**
 * Get rate limits and token limits based on user tier
 * Configurable via environment variables (legacy)
 * NOTE: New token limits are in config/limits.ts
 */
function getTierLimits(tier: string): TierLimits {
  const limits: Record<string, TierLimits> = {
    anonymous: {
      requestsPerDay: parseInt(process.env.RATE_LIMIT_ANONYMOUS_PER_DAY || '3'),
      maxTokens: 1000,
    },
    free: {
      requestsPerDay: parseInt(process.env.RATE_LIMIT_FREE_PER_DAY || '50'),
      maxTokens: parseInt(process.env.RATE_LIMIT_FREE_MAX_TOKENS || '2000'),
    },
    premium: {
      requestsPerDay: parseInt(process.env.RATE_LIMIT_PREMIUM_PER_DAY || '500'),
      maxTokens: parseInt(process.env.RATE_LIMIT_PREMIUM_MAX_TOKENS || '4000'),
    },
    enterprise: {
      requestsPerDay: 10000,
      maxTokens: 8000,
    },
  };

  return limits[tier] || limits.free;
}

export { getTierLimits };

// Import CostService for budget enforcement
import { CostService } from '../services/costService';

/**
 * Check if we can afford this request based on daily budget
 * Blocks requests when daily budget is exceeded
 */
export async function budgetCheck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get user's tier limits
    const tier = req.user?.tier || 'anonymous';
    const limits = getTierLimits(tier);

    // Estimate cost for this request
    const messageLength = req.body.message?.length || 0;
    const estimatedCost = CostService.estimateCost(messageLength, limits.maxTokens);

    // Check if we can afford it
    const canAfford = await CostService.canAffordRequest(estimatedCost);

    if (!canAfford) {
      const status = await CostService.getBudgetStatus();

      res.status(503).json({
        error: 'Daily budget exceeded',
        message: 'Service temporarily unavailable due to budget limits',
        budgetStatus: {
          percentUsed: status.percentUsed.toFixed(1),
          resetsIn: 'Resets at midnight UTC',
        },
      });
      return;
    }

    // Attach estimated cost to request for later use
    (req as any).estimatedCost = estimatedCost;

    next();
  } catch (error) {
    console.error('Budget check error:', error);
    next(error);
  }
}

/**
 * Token budget check middleware (Phase 1.7)
 * Checks user's daily token usage against tier limits
 * Blocks requests when user exceeds daily token quota
 */
export async function tokenBudgetCheck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Skip for anonymous users (handled by request count limit)
    if (!req.user) {
      next();
      return;
    }

    const tier = req.user.tier;
    const limits = getConfigTierLimits(tier);

    // Get user's tokens used today
    const { UserDailyTokensModel } = await import('../models/UserDailyTokens');
    const tokensUsed = await UserDailyTokensModel.getTodayUsage(req.user.id);

    // Estimate tokens for this request
    // Rough estimation: message chars / 4 for input, plus max output tokens
    const messageLength = req.body.message?.length || 0;
    const estimatedInputTokens = Math.ceil(messageLength / 4);
    const estimatedTotalTokens = estimatedInputTokens + limits.maxOutputTokens;

    // Check if user would exceed daily limit
    if (tokensUsed + estimatedTotalTokens > limits.tokensPerDay) {
      const remaining = Math.max(0, limits.tokensPerDay - tokensUsed);

      res.status(429).json({
        error: 'Daily token limit exceeded',
        message: `You've used ${tokensUsed.toLocaleString()} of your ${limits.tokensPerDay.toLocaleString()} daily tokens. Resets at midnight UTC.`,
        tokensUsed,
        tokensLimit: limits.tokensPerDay,
        tokensRemaining: remaining,
      });
      return;
    }

    // Add info to response headers
    res.set({
      'X-Tokens-Limit': String(limits.tokensPerDay),
      'X-Tokens-Used': String(tokensUsed),
      'X-Tokens-Remaining': String(limits.tokensPerDay - tokensUsed),
    });

    next();
  } catch (error) {
    console.error('Token budget check error:', error);
    next(error);
  }
}
