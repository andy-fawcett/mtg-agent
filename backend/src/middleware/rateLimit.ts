import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redisClient } from '../config/redis';
import { getRateLimitConfig, getTierLimits } from '../config/limits';

// IP limiter cache - recreated when config changes
let ipLimiter: RateLimiterRedis;
let lastIpLimiterConfig: { points: number; duration: number } | null = null;

/**
 * IP-based rate limiting middleware
 * Limits requests per IP address to prevent abuse
 * Config loaded from database dynamically and limiter recreated on changes
 */
export async function ipRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get current config from database (cached)
    const config = await getRateLimitConfig();

    // Recreate limiter if config changed or doesn't exist
    const currentConfig = {
      points: config.IP_MAX_REQUESTS,
      duration: config.IP_WINDOW_MS / 1000,
    };

    if (
      !ipLimiter ||
      !lastIpLimiterConfig ||
      lastIpLimiterConfig.points !== currentConfig.points ||
      lastIpLimiterConfig.duration !== currentConfig.duration
    ) {
      ipLimiter = new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'rl_ip',
        points: currentConfig.points,
        duration: currentConfig.duration,
        blockDuration: 60, // Block for 1 minute if exceeded
      });
      lastIpLimiterConfig = currentConfig;
    }

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

// Import CostService for budget enforcement
import { CostService } from '../services/costService';

/**
 * Check if we can afford this request based on daily budget
 * Blocks requests when daily budget is exceeded
 * Config loaded from database dynamically
 */
export async function budgetCheck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Require authenticated user (should be guaranteed by requireAuth middleware)
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated to access this resource',
      });
      return;
    }

    // Get user's tier limits from database
    const tier = req.user.tier;
    const limits = await getTierLimits(tier);

    // Estimate cost for this request
    const messageLength = req.body.message?.length || 0;
    const estimatedCost = await CostService.estimateCost(messageLength, limits.maxOutputTokens);

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
 * Config loaded from database dynamically
 * NOTE: Requires authentication - use after requireAuth middleware
 */
export async function tokenBudgetCheck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // User must be authenticated (enforced by requireAuth middleware)
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to use the chat',
      });
      return;
    }

    const tier = req.user.tier;
    const limits = await getTierLimits(tier);

    // Get user's tokens used today from database
    // Dynamic import to avoid circular dependency
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
