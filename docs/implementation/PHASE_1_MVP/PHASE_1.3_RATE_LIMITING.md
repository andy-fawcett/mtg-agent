# Phase 1.3: Rate Limiting & Cost Controls

**Status:** ⏸️ Not Started
**Duration Estimate:** 6-8 hours
**Prerequisites:** Phase 1.0 (Foundation) + Phase 1.1 (Database) + Phase 1.2 (Auth) complete
**Dependencies:** Redis, DailyCost model, User tier system

## Objectives

Implement multi-layer rate limiting and cost controls to prevent abuse and protect budget.

- Redis-based rate limiting (IP + user)
- Tier-based request limits
- Cost estimation before requests
- Daily budget tracking and enforcement
- Budget alert system (50%, 75%, 90%)
- Circuit breaker at 100% budget
- Request counting and analytics

---

## Task 1.3.1: Redis Rate Limiter Setup

**Estimated Time:** 90 minutes

### Objectives

Configure rate-limiter-flexible with Redis for distributed rate limiting.

### Steps

**Create `backend/src/config/redis.ts`:**

```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
  console.log('✓ Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

export default redis;
```

**Create `backend/src/middleware/rateLimit.ts`:**

```typescript
import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import redis from '../config/redis';

// Per-IP rate limiter (10 requests per minute)
const ipLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl_ip',
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10'),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000') / 1000,
  blockDuration: 60, // Block for 1 minute if exceeded
});

/**
 * IP-based rate limiting middleware
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
        storeClient: redis,
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
      storeClient: redis,
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

interface TierLimits {
  requestsPerDay: number;
  maxTokens: number;
}

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
```

### Verification

```bash
cd backend

# Test rate limiting
cat > test-rate-limit.ts << 'EOF'
import { ipRateLimit, userRateLimit } from './src/middleware/rateLimit';
import express from 'express';
import { closePool } from './src/config/database';
import redis from './src/config/redis';

const app = express();

app.get('/test-ip', ipRateLimit, (req, res) => {
  res.json({ message: 'Success' });
});

const server = app.listen(3001);

async function test() {
  // Make 15 requests (limit is 10/min)
  for (let i = 1; i <= 15; i++) {
    const response = await fetch('http://localhost:3001/test-ip');
    console.log(`Request ${i}: ${response.status}`);

    if (response.status === 429) {
      const data = await response.json();
      console.log('Rate limited:', data);
      break;
    }
  }

  server.close();
  await closePool();
  redis.disconnect();
}

test();
EOF

npx tsx test-rate-limit.ts
rm test-rate-limit.ts
```

### Success Criteria

- [ ] Redis connection works
- [ ] IP rate limiting enforces limits
- [ ] User rate limiting tier-aware
- [ ] Anonymous users strictly limited
- [ ] Rate limit headers set
- [ ] 429 responses with retry-after
- [ ] Limits reset after duration

---

## Task 1.3.2: Cost Estimation & Tracking

**Estimated Time:** 90 minutes

### Objectives

Estimate costs before requests and track against daily budget.

### Steps

**Create `backend/src/services/costService.ts`:**

```typescript
import { DailyCostModel } from '../models/DailyCost';
import redis from '../config/redis';

// Claude Pricing (as of Jan 2025 - adjust as needed)
const PRICING = {
  'claude-3-5-sonnet-20241022': {
    input: 3.0 / 1_000_000,  // $3 per million input tokens
    output: 15.0 / 1_000_000, // $15 per million output tokens
  },
};

export class CostService {
  /**
   * Estimate cost for a request
   */
  static estimateCost(
    messageLength: number,
    maxOutputTokens: number,
    model: string = 'claude-3-5-sonnet-20241022'
  ): number {
    // Rough estimation: 1 token ≈ 4 characters
    const estimatedInputTokens = Math.ceil(messageLength / 4);

    const pricing = PRICING[model as keyof typeof PRICING];
    if (!pricing) {
      throw new Error(`Unknown model: ${model}`);
    }

    const inputCost = estimatedInputTokens * pricing.input;
    const outputCost = maxOutputTokens * pricing.output;

    // Return cost in cents
    return Math.ceil((inputCost + outputCost) * 100);
  }

  /**
   * Check if adding this cost would exceed daily budget
   */
  static async canAffordRequest(estimatedCostCents: number): Promise<boolean> {
    const dailyBudget = parseInt(process.env.DAILY_BUDGET_CENTS || '100');
    const today = await DailyCostModel.getToday();

    return (today.total_cost_cents + estimatedCostCents) <= dailyBudget;
  }

  /**
   * Get current budget status
   */
  static async getBudgetStatus(): Promise<{
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
  }> {
    const dailyBudget = parseInt(process.env.DAILY_BUDGET_CENTS || '100');
    const today = await DailyCostModel.getToday();

    const used = today.total_cost_cents;
    const remaining = Math.max(0, dailyBudget - used);
    const percentUsed = (used / dailyBudget) * 100;

    return {
      used,
      limit: dailyBudget,
      remaining,
      percentUsed,
    };
  }

  /**
   * Check budget and send alerts if needed
   */
  static async checkBudgetAlerts(): Promise<void> {
    const status = await this.getBudgetStatus();

    const thresholds = [
      parseInt(process.env.COST_ALERT_THRESHOLD_1 || '50'),
      parseInt(process.env.COST_ALERT_THRESHOLD_2 || '75'),
      parseInt(process.env.COST_ALERT_THRESHOLD_3 || '90'),
    ];

    for (const threshold of thresholds) {
      if (status.percentUsed >= threshold) {
        const alerted = await redis.get(`budget_alert_${threshold}`);

        if (!alerted) {
          await this.sendBudgetAlert(threshold, status);
          await redis.set(`budget_alert_${threshold}`, '1', 'EX', 86400);
        }
      }
    }
  }

  /**
   * Send budget alert (log for now, email in Phase 4)
   */
  private static async sendBudgetAlert(
    threshold: number,
    status: { used: number; limit: number; percentUsed: number }
  ): Promise<void> {
    console.error('🚨 BUDGET ALERT 🚨');
    console.error(`Threshold: ${threshold}% of daily budget`);
    console.error(`Current: ${status.percentUsed.toFixed(1)}%`);
    console.error(`Used: $${(status.used / 100).toFixed(2)} / $${(status.limit / 100).toFixed(2)}`);

    // TODO: Send email notification in Phase 4
  }

  /**
   * Record actual cost after request
   */
  static async recordCost(
    actualTokensUsed: number,
    userId?: string
  ): Promise<void> {
    // Calculate actual cost
    const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    const pricing = PRICING[model as keyof typeof PRICING];

    // Assume 50/50 input/output for simplicity (can be improved)
    const inputTokens = Math.floor(actualTokensUsed / 2);
    const outputTokens = Math.ceil(actualTokensUsed / 2);

    const costCents = Math.ceil(
      (inputTokens * pricing.input + outputTokens * pricing.output) * 100
    );

    // Add to daily cost
    await DailyCostModel.addCost(costCents, actualTokensUsed, userId);

    // Check for alerts
    await this.checkBudgetAlerts();
  }
}
```

### Verification

```bash
cd backend
cat > test-cost-service.ts << 'EOF'
import { CostService } from './src/services/costService';
import { closePool } from './src/config/database';
import redis from './src/config/redis';

async function test() {
  console.log('Testing Cost Service...\n');

  // Test cost estimation
  console.log('1. Estimating cost...');
  const cost = CostService.estimateCost(500, 2000);
  console.log(`✓ Estimated cost: ${cost} cents ($${(cost / 100).toFixed(4)})`);

  // Test budget status
  console.log('\n2. Getting budget status...');
  const status = await CostService.getBudgetStatus();
  console.log('✓ Budget status:', status);

  // Test can afford
  console.log('\n3. Testing can afford...');
  const canAfford = await CostService.canAffordRequest(10);
  console.log('✓ Can afford 10 cents:', canAfford);

  // Test record cost
  console.log('\n4. Recording cost...');
  await CostService.recordCost(500);
  const newStatus = await CostService.getBudgetStatus();
  console.log('✓ New budget status:', newStatus);

  console.log('\n✓ All tests passed!');
  await closePool();
  redis.disconnect();
}

test();
EOF

npx tsx test-cost-service.ts
rm test-cost-service.ts
```

### Success Criteria

- [ ] Cost estimation works
- [ ] Budget checking works
- [ ] Budget status accurate
- [ ] Alerts fire at thresholds
- [ ] Cost recording updates database
- [ ] Prevents overspend

---

## Task 1.3.3: Budget Enforcement Middleware

**Estimated Time:** 60 minutes

### Objectives

Create middleware to check budget before allowing requests.

### Steps

**Add to `backend/src/middleware/rateLimit.ts`:**

```typescript
import { CostService } from '../services/costService';
import { getTierLimits } from './rateLimit';

/**
 * Check if we can afford this request
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
```

### Verification

```bash
# Test budget enforcement
cd backend
cat > test-budget-middleware.ts << 'EOF'
import express from 'express';
import { budgetCheck } from './src/middleware/rateLimit';
import { closePool } from './src/config/database';
import redis from './src/config/redis';

const app = express();
app.use(express.json());

app.post('/test-budget', budgetCheck, (req, res) => {
  res.json({ message: 'Request allowed' });
});

const server = app.listen(3002);

async function test() {
  console.log('Testing budget middleware...\n');

  const response = await fetch('http://localhost:3002/test-budget', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Test message' }),
  });

  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Response:', data);

  server.close();
  await closePool();
  redis.disconnect();
}

test();
EOF

npx tsx test-budget-middleware.ts
rm test-budget-middleware.ts
```

### Success Criteria

- [ ] Budget checked before request
- [ ] Requests blocked when budget exceeded
- [ ] Cost attached to request
- [ ] Error messages helpful
- [ ] 503 status when over budget

---

## Phase 1.3 Completion Checklist

### Rate Limiting
- [ ] Redis connected
- [ ] IP-based rate limiting works
- [ ] User-based rate limiting works
- [ ] Tier-based limits enforced
- [ ] Anonymous users limited
- [ ] Rate limit headers set
- [ ] 429 responses correct

### Cost Control
- [ ] Cost estimation accurate
- [ ] Budget tracking works
- [ ] Alerts fire at thresholds
- [ ] Budget enforcement works
- [ ] Requests blocked when over budget
- [ ] Cost recording updates database

### Integration
- [ ] Works with auth system
- [ ] Integrates with user tiers
- [ ] Redis performance acceptable
- [ ] No memory leaks
- [ ] Error handling robust

## Common Issues

### Issue: Redis connection refused

**Solution:**
```bash
docker-compose ps redis
docker-compose restart redis
```

### Issue: Rate limits too strict in development

**Solution:**
```bash
# .env
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_FREE_PER_DAY=1000
```

## Rollback Procedure

```bash
rm backend/src/middleware/rateLimit.ts
rm backend/src/services/costService.ts
rm backend/src/config/redis.ts
```

## Next Steps

1. ✅ Verify all checklist items
2. ✅ Test rate limits under load
3. ✅ Verify budget enforcement
4. ✅ Commit: `feat(rate-limit): complete Phase 1.3`
5. ➡️ Proceed to [Phase 1.4: Claude SDK](PHASE_1.4_CLAUDE_SDK.md)

---

**Status:** ⏸️ Not Started
**Last Updated:** 2025-11-01
**Next Phase:** [Phase 1.4: Claude Agent SDK Integration](PHASE_1.4_CLAUDE_SDK.md)
