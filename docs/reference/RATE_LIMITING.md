# Rate Limiting & Cost Controls

## Overview

Rate limiting and cost controls are critical for preventing abuse and managing expenses when exposing Claude Agent SDK to public users. This document outlines a multi-layered approach to protect both availability and budget.

## Why Rate Limiting is Critical

**Without rate limiting:**
- Single user can exhaust your API budget in hours
- Bots can spam requests continuously
- Costs can spiral out of control ($1000s/day)
- Service becomes unavailable for legitimate users
- No defense against DoS attacks

## Multi-Layer Rate Limiting Strategy

### Layer 1: Edge/CDN Level

**Purpose:** Stop attacks before they reach your backend

**Implementation (Cloudflare example):**
- 100 requests per minute per IP
- Automatic bot detection
- Challenge (CAPTCHA) on suspicious activity
- Geographic blocking if needed

**Configuration:**
```javascript
// Cloudflare Workers example
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const ip = request.headers.get('CF-Connecting-IP')

  // Rate limit: 100 req/min per IP
  const rateLimitKey = `rate_limit:${ip}`
  const count = await RATE_LIMIT_KV.get(rateLimitKey)

  if (count && parseInt(count) > 100) {
    return new Response('Rate limit exceeded', { status: 429 })
  }

  // Increment counter
  await RATE_LIMIT_KV.put(rateLimitKey, (parseInt(count) || 0) + 1, {
    expirationTtl: 60  // 1 minute
  })

  return fetch(request)
}
```

### Layer 2: Application Level (Per-IP)

**Purpose:** Protect backend resources from IP-based abuse

**Limits:**
- 10 requests per minute per IP
- 100 requests per hour per IP
- 500 requests per day per IP

**Implementation (Express + rate-limiter-flexible):**

```javascript
const { RateLimiterRedis } = require('rate-limiter-flexible');
const Redis = require('ioredis');

const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});

// Per-minute limiter
const rateLimiterMinute = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rl_minute',
  points: 10,  // 10 requests
  duration: 60,  // per 1 minute
});

// Per-hour limiter
const rateLimiterHour = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rl_hour',
  points: 100,  // 100 requests
  duration: 3600,  // per 1 hour
});

// Per-day limiter
const rateLimiterDay = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rl_day',
  points: 500,  // 500 requests
  duration: 86400,  // per 1 day
});

// Middleware
async function rateLimitMiddleware(req, res, next) {
  const ip = req.ip;

  try {
    // Check all limiters
    await rateLimiterMinute.consume(ip);
    await rateLimiterHour.consume(ip);
    await rateLimiterDay.consume(ip);

    next();
  } catch (rateLimiterRes) {
    const retryAfter = Math.round(rateLimiterRes.msBeforeNext / 1000) || 1;

    res.set('Retry-After', String(retryAfter));
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: retryAfter
    });
  }
}

app.use('/api/', rateLimitMiddleware);
```

### Layer 3: Application Level (Per-User)

**Purpose:** Enforce fair usage per authenticated user

**Tier-based limits:**

```javascript
const USER_TIERS = {
  anonymous: {
    messagesPerDay: 3,
    maxTokensPerRequest: 1000,
    maxContextWindow: 2000,
  },
  free: {
    messagesPerDay: 50,
    maxTokensPerRequest: 2000,
    maxContextWindow: 4000,
  },
  premium: {
    messagesPerDay: 500,
    maxTokensPerRequest: 4000,
    maxContextWindow: 8000,
  },
  enterprise: {
    messagesPerDay: 10000,
    maxTokensPerRequest: 8000,
    maxContextWindow: 16000,
  }
};

async function checkUserRateLimit(userId, userTier) {
  const limits = USER_TIERS[userTier] || USER_TIERS.anonymous;

  // Check daily message count
  const today = new Date().toISOString().split('T')[0];
  const key = `user_messages:${userId}:${today}`;

  const messageCount = await redisClient.get(key);
  const count = parseInt(messageCount) || 0;

  if (count >= limits.messagesPerDay) {
    throw new Error(`Daily limit of ${limits.messagesPerDay} messages exceeded`);
  }

  // Increment counter
  await redisClient.incr(key);
  await redisClient.expire(key, 86400);  // Expire after 24 hours

  return {
    remaining: limits.messagesPerDay - count - 1,
    limit: limits.messagesPerDay,
    maxTokens: limits.maxTokensPerRequest
  };
}
```

### Layer 4: Cost-Based Limits

**Purpose:** Prevent runaway costs regardless of request count

**Implementation:**

```javascript
// Cost tracking
async function trackAndCheckCost(userId, estimatedCost) {
  // Daily budget limit (in cents)
  const DAILY_BUDGET = 1000;  // $10/day

  const today = new Date().toISOString().split('T')[0];
  const costKey = `daily_cost:${today}`;

  // Get current spend
  const currentSpend = await redisClient.get(costKey);
  const spend = parseFloat(currentSpend) || 0;

  // Check if adding this request would exceed budget
  if (spend + estimatedCost > DAILY_BUDGET) {
    throw new Error('Daily budget exceeded');
  }

  // Track the cost (even if request fails, to prevent retry loops)
  await redisClient.incrby(costKey, Math.ceil(estimatedCost));
  await redisClient.expire(costKey, 86400);

  return {
    budgetRemaining: DAILY_BUDGET - spend - estimatedCost,
    budgetLimit: DAILY_BUDGET
  };
}

// Estimate cost before making request
function estimateRequestCost(messageLength, maxTokens) {
  // Claude pricing (as of 2024, adjust as needed):
  // Input: $3 per million tokens
  // Output: $15 per million tokens

  // Rough estimation: 1 token ≈ 4 characters
  const estimatedInputTokens = messageLength / 4;
  const estimatedOutputTokens = maxTokens;

  const inputCost = (estimatedInputTokens / 1000000) * 3 * 100;  // in cents
  const outputCost = (estimatedOutputTokens / 1000000) * 15 * 100;  // in cents

  return inputCost + outputCost;
}

// Usage in request handler
app.post('/api/chat', async (req, res) => {
  const user = await authenticateUser(req);
  const { message } = req.body;

  // Get user limits
  const rateLimitInfo = await checkUserRateLimit(user.id, user.tier);

  // Estimate and check cost
  const estimatedCost = estimateRequestCost(
    message.length,
    rateLimitInfo.maxTokens
  );

  await trackAndCheckCost(user.id, estimatedCost);

  // Proceed with Claude API call...
});
```

## Budget Monitoring & Alerts

### Real-Time Cost Tracking

```javascript
class CostMonitor {
  constructor() {
    this.dailyBudget = 1000;  // $10 in cents
    this.alertThresholds = [50, 75, 90];  // Percentage thresholds
    this.alertedAt = new Set();
  }

  async getCurrentSpend() {
    const today = new Date().toISOString().split('T')[0];
    const costKey = `daily_cost:${today}`;
    const spend = await redisClient.get(costKey);
    return parseFloat(spend) || 0;
  }

  async checkAndAlert() {
    const currentSpend = await this.getCurrentSpend();
    const percentUsed = (currentSpend / this.dailyBudget) * 100;

    for (const threshold of this.alertThresholds) {
      if (percentUsed >= threshold && !this.alertedAt.has(threshold)) {
        await this.sendAlert(threshold, currentSpend);
        this.alertedAt.add(threshold);
      }
    }

    // Reset daily
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      this.alertedAt.clear();
    }
  }

  async sendAlert(threshold, currentSpend) {
    const message = `🚨 Budget Alert: ${threshold}% of daily budget used ($${currentSpend/100})`;

    // Send via email, Slack, SMS, etc.
    await sendNotification({
      channel: 'slack',
      message: message,
      severity: threshold >= 90 ? 'critical' : 'warning'
    });

    console.error(message);
  }

  async shouldThrottle() {
    const currentSpend = await this.getCurrentSpend();
    const percentUsed = (currentSpend / this.dailyBudget) * 100;

    // Start throttling at 90%
    if (percentUsed >= 90) {
      return true;
    }

    return false;
  }
}

// Run check every 5 minutes
const costMonitor = new CostMonitor();
setInterval(() => costMonitor.checkAndAlert(), 5 * 60 * 1000);
```

### Circuit Breaker Pattern

**Purpose:** Stop all requests if budget is exceeded

```javascript
class CircuitBreaker {
  constructor() {
    this.state = 'CLOSED';  // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.failureThreshold = 5;
    this.resetTimeout = 60000;  // 1 minute
  }

  async call(fn) {
    if (this.state === 'OPEN') {
      // Check if we should try again
      if (Date.now() - this.openedAt > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN - service temporarily unavailable');
      }
    }

    try {
      const result = await fn();

      // Success - reset if we were half-open
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;

      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        this.openedAt = Date.now();
        await sendAlert('Circuit breaker opened - too many failures');
      }

      throw error;
    }
  }
}

const circuitBreaker = new CircuitBreaker();

// Usage
app.post('/api/chat', async (req, res) => {
  try {
    const response = await circuitBreaker.call(async () => {
      // Your Claude API call here
      return await callClaudeAPI(req.body.message);
    });

    res.json(response);
  } catch (error) {
    res.status(503).json({
      error: 'Service temporarily unavailable'
    });
  }
});
```

## Request Queuing for High Load

**Purpose:** Handle traffic spikes gracefully without rejection

```javascript
const Queue = require('bull');

const chatQueue = new Queue('chat-requests', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  }
});

// Add job to queue instead of processing immediately
app.post('/api/chat', async (req, res) => {
  const user = await authenticateUser(req);

  // Check if user has too many queued requests
  const queuedCount = await chatQueue.count();
  if (queuedCount > 100) {
    return res.status(503).json({
      error: 'Service is busy, please try again later'
    });
  }

  // Add to queue
  const job = await chatQueue.add({
    userId: user.id,
    message: req.body.message,
    tier: user.tier
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });

  // Return job ID for status checking
  res.json({
    jobId: job.id,
    status: 'queued',
    position: queuedCount
  });
});

// Process queue with concurrency limit
chatQueue.process(5, async (job) => {  // Only 5 concurrent requests
  const { userId, message, tier } = job.data;

  // Apply rate limits
  await checkUserRateLimit(userId, tier);

  // Call Claude API
  const response = await callClaudeAPI(message);

  // Store result
  await storeResponse(userId, job.id, response);

  return response;
});

// Check job status endpoint
app.get('/api/chat/:jobId', async (req, res) => {
  const job = await chatQueue.getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const state = await job.getState();

  if (state === 'completed') {
    const response = await getStoredResponse(job.data.userId, job.id);
    return res.json({ status: 'completed', response });
  }

  res.json({ status: state });
});
```

## Token Limit Enforcement

**Purpose:** Prevent excessive token usage per request

```javascript
async function enforceTokenLimits(message, userTier) {
  const limits = USER_TIERS[userTier];

  // Estimate input tokens
  const estimatedInputTokens = message.length / 4;  // Rough estimate

  if (estimatedInputTokens > limits.maxContextWindow) {
    throw new Error(`Message too long. Max ${limits.maxContextWindow} tokens allowed.`);
  }

  // Return max output tokens for this tier
  return limits.maxTokensPerRequest;
}

// In Claude API call
const maxTokens = await enforceTokenLimits(message, user.tier);

const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: maxTokens,  // Enforced limit
  messages: [{
    role: 'user',
    content: message
  }]
});
```

## Monitoring Dashboard

**Key Metrics to Track:**

```javascript
// Collect metrics
class MetricsCollector {
  async collect() {
    const today = new Date().toISOString().split('T')[0];

    return {
      // Cost metrics
      dailySpend: await this.getDailySpend(),
      budgetRemaining: await this.getBudgetRemaining(),

      // Rate limit metrics
      requestsPerMinute: await this.getRequestRate('minute'),
      requestsPerHour: await this.getRequestRate('hour'),
      requestsPerDay: await this.getRequestRate('day'),

      // User metrics
      activeUsers: await this.getActiveUserCount(),
      anonymousRequests: await this.getAnonymousRequestCount(),

      // Token metrics
      avgTokensPerRequest: await this.getAvgTokens(),
      totalTokensToday: await this.getTotalTokens(),

      // Error metrics
      rateLimitHits: await this.getRateLimitHits(),
      budgetExceeded: await this.getBudgetExceededCount(),
      apiErrors: await this.getAPIErrorCount(),

      // Performance
      avgResponseTime: await this.getAvgResponseTime(),
      queueLength: await chatQueue.count(),
    };
  }
}

// Expose metrics endpoint (protect with auth!)
app.get('/admin/metrics', requireAdmin, async (req, res) => {
  const metrics = await new MetricsCollector().collect();
  res.json(metrics);
});
```

## Recommended Limits by User Tier

```javascript
const RECOMMENDED_LIMITS = {
  anonymous: {
    messagesPerDay: 3,
    messagesPerHour: 2,
    maxTokensPerRequest: 1000,
    maxMessageLength: 500,
    requireCaptcha: true
  },

  free: {
    messagesPerDay: 50,
    messagesPerHour: 20,
    maxTokensPerRequest: 2000,
    maxMessageLength: 1000,
    requireCaptcha: false
  },

  premium: {
    messagesPerDay: 500,
    messagesPerHour: 100,
    maxTokensPerRequest: 4000,
    maxMessageLength: 2000,
    requireCaptcha: false,
    priority: true  // Process before free tier in queue
  },

  enterprise: {
    messagesPerDay: 10000,
    messagesPerHour: 1000,
    maxTokensPerRequest: 8000,
    maxMessageLength: 4000,
    requireCaptcha: false,
    priority: true,
    dedicatedCapacity: true
  }
};
```

## Emergency Controls

### Manual Override

```javascript
// Emergency stop switch
let EMERGENCY_STOP = false;

app.use('/api/chat', (req, res, next) => {
  if (EMERGENCY_STOP) {
    return res.status(503).json({
      error: 'Service temporarily unavailable for maintenance'
    });
  }
  next();
});

// Admin endpoint to toggle
app.post('/admin/emergency-stop', requireAdmin, (req, res) => {
  EMERGENCY_STOP = req.body.enabled;
  res.json({ emergencyStop: EMERGENCY_STOP });
});
```

## Testing Rate Limits

```bash
# Test rate limits with curl
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "test"}' \
    -w "\nStatus: %{http_code}\n"
  sleep 1
done

# Should see 429 responses after exceeding limit
```

## Checklist

### Implementation
- [ ] Edge-level rate limiting configured
- [ ] IP-based rate limiting implemented
- [ ] User-based rate limiting implemented
- [ ] Cost tracking implemented
- [ ] Budget alerts configured
- [ ] Circuit breaker implemented
- [ ] Token limits enforced
- [ ] Queue system for high load

### Monitoring
- [ ] Real-time cost dashboard
- [ ] Alert at 50% budget
- [ ] Alert at 75% budget
- [ ] Alert at 90% budget
- [ ] Daily budget reports
- [ ] Rate limit metrics tracked
- [ ] Error rate monitoring

### Testing
- [ ] Rate limits tested
- [ ] Budget caps tested
- [ ] Queue behavior tested
- [ ] Alert system tested
- [ ] Recovery procedures tested

## Conclusion

Multi-layer rate limiting combined with aggressive cost monitoring is essential for public-facing Claude API applications. The key is to fail fast, fail gracefully, and always know your current spend. Start with conservative limits and gradually increase based on actual usage patterns and budget.
