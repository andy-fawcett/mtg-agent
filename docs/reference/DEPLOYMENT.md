# Deployment Guide

> **📦 Package Manager Note:** This guide uses npm commands for examples. **This project uses pnpm v10+ for enhanced security.** Replace `npm install` with `pnpm install` and `npm run` with `pnpm run`. See [NPM Security Guide](NPM_SECURITY.md) for why we use pnpm and how it prevents supply chain attacks.

## Overview

This guide covers secure deployment of the MTG Agent application to production, with emphasis on security best practices and cost control.

## Platform Recommendations

### Option 1: Railway (Recommended for MVP)

**Pros:**
- Simple deployment
- Built-in PostgreSQL and Redis
- Automatic HTTPS
- Reasonable pricing
- Environment variable management
- Auto-scaling

**Pricing:** ~$5-20/month for starter setup

**Setup:**

1. Install Railway CLI:
```bash
npm install -g @railway/cli
railway login
```

2. Initialize project:
```bash
cd mtg-agent
railway init
```

3. Add services:
```bash
railway add --database postgresql
railway add --database redis
```

4. Set environment variables:
```bash
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway variables set SESSION_SECRET=$(openssl rand -hex 32)
railway variables set FRONTEND_URL=https://yourdomain.com
```

5. Deploy:
```bash
railway up
```

### Option 2: Render

**Pros:**
- Free tier available
- Automatic deployments from Git
- Built-in databases
- Easy to use

**Pricing:** Free tier + $7/month for PostgreSQL

**Setup:**

1. Create account at render.com
2. Connect GitHub repository
3. Create Web Service:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Add environment variables
4. Create PostgreSQL database
5. Create Redis instance
6. Deploy

### Option 3: Fly.io

**Pros:**
- Global edge deployment
- Good performance
- Flexible scaling
- Competitive pricing

**Setup:**

1. Install Fly CLI:
```bash
curl -L https://fly.io/install.sh | sh
```

2. Launch app:
```bash
fly launch
```

3. Add databases:
```bash
fly postgres create
fly redis create
```

4. Set secrets:
```bash
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
```

5. Deploy:
```bash
fly deploy
```

### Option 4: Self-Hosted (VPS)

**Platforms:** DigitalOcean, Linode, Hetzner

**Setup:**

1. Provision server (Ubuntu 22.04)
2. Install Docker and Docker Compose
3. Clone repository
4. Configure environment variables
5. Run with docker-compose
6. Set up Nginx reverse proxy
7. Configure SSL with Let's Encrypt

## Pre-Deployment Checklist

### Code Preparation

- [ ] All dependencies pinned to specific versions
- [ ] TypeScript compiled without errors
- [ ] All tests passing
- [ ] No console.log statements in production code
- [ ] Error handling comprehensive
- [ ] Logging configured properly

### Security Configuration

- [ ] API keys in environment variables (not in code)
- [ ] .env file not committed to Git
- [ ] .gitignore configured properly
- [ ] HTTPS enforced
- [ ] CORS configured for production domain only
- [ ] Security headers configured (helmet.js)
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention verified
- [ ] XSS prevention verified

### Database Setup

- [ ] Database schema created
- [ ] Indexes added for performance
- [ ] Connection pooling configured
- [ ] Backup strategy configured
- [ ] Migration scripts ready

### Monitoring & Logging

- [ ] Error tracking configured (Sentry)
- [ ] Logging service configured
- [ ] Cost monitoring alerts set up
- [ ] Health check endpoint implemented
- [ ] Uptime monitoring configured

## Environment Variables Setup

### Production Environment Variables

```bash
# Server
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourdomain.com

# Database (provided by hosting platform)
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379

# Anthropic
ANTHROPIC_API_KEY=sk-ant-api-key-here

# Session secret (generate with: openssl rand -hex 32)
SESSION_SECRET=your-random-session-secret

# OAuth (if using)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Monitoring
SENTRY_DSN=your-sentry-dsn

# Cost Controls
DAILY_BUDGET_CENTS=1000  # $10/day
ALERT_EMAIL=your-email@example.com

# Features
ENABLE_ANONYMOUS_ACCESS=true
ENABLE_EMAIL_AUTH=true
ENABLE_OAUTH=true
```

### Generating Secrets

```bash
# Generate SESSION_SECRET
openssl rand -hex 32

# Generate session secret
openssl rand -hex 32

# Generate API key (if needed)
openssl rand -base64 32
```

## Database Migration

### Initial Schema Setup

```bash
# Create migration script
# migrations/001_initial_schema.sql

-- Run migration
psql $DATABASE_URL -f migrations/001_initial_schema.sql
```

### Using a Migration Tool

```bash
# Install Prisma (or TypeORM, Sequelize, etc.)
npm install prisma

# Initialize
npx prisma init

# Create schema
# Edit prisma/schema.prisma

# Generate migration
npx prisma migrate dev --name init

# Deploy to production
npx prisma migrate deploy
```

## SSL/HTTPS Configuration

### Automatic (Most Platforms)

Railway, Render, Vercel, and Fly.io provide automatic HTTPS. No configuration needed.

### Manual (Self-Hosted)

**Using Nginx + Let's Encrypt:**

```nginx
# /etc/nginx/sites-available/mtg-agent

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Install SSL certificate:**

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## CDN Configuration

### Cloudflare (Recommended)

1. Sign up at cloudflare.com
2. Add your domain
3. Update nameservers at your registrar
4. Configure settings:
   - SSL/TLS: Full (strict)
   - Enable "Always Use HTTPS"
   - Enable HTTP/2 and HTTP/3
   - Enable Brotli compression
   - Configure rate limiting rules
   - Enable DDoS protection

### Rate Limiting Rules (Cloudflare)

```
Rate Limiting Rule 1: Global API
- Path: /api/*
- Requests: 100 per minute
- Action: Challenge (CAPTCHA)

Rate Limiting Rule 2: Chat Endpoint
- Path: /api/chat
- Requests: 10 per minute
- Action: Block
```

## Monitoring Setup

### Sentry (Error Tracking)

```bash
npm install @sentry/node
```

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,  // 10% of requests
});

// Add to Express
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

### Cost Monitoring

```typescript
// Daily cost alert
import nodemailer from 'nodemailer';

async function sendCostAlert(percentage: number, amount: number) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.ALERT_EMAIL,
      pass: process.env.ALERT_EMAIL_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.ALERT_EMAIL,
    to: process.env.ALERT_EMAIL,
    subject: `Cost Alert: ${percentage}% of daily budget used`,
    text: `Current spend: $${amount/100}\nDaily budget: $${process.env.DAILY_BUDGET_CENTS/100}`,
  });
}
```

### Uptime Monitoring

**Services:**
- UptimeRobot (free)
- Pingdom
- StatusCake

**Health Check Endpoint:**

```typescript
app.get('/health', async (req, res) => {
  // Check database
  try {
    await db.query('SELECT 1');
  } catch (error) {
    return res.status(503).json({ status: 'unhealthy', database: 'down' });
  }

  // Check Redis
  try {
    await redis.ping();
  } catch (error) {
    return res.status(503).json({ status: 'unhealthy', redis: 'down' });
  }

  res.json({ status: 'healthy' });
});
```

## Scaling Considerations

### Horizontal Scaling

```yaml
# docker-compose.yml for multiple backend instances

services:
  backend-1:
    build: ./backend
    environment:
      - INSTANCE_ID=1

  backend-2:
    build: ./backend
    environment:
      - INSTANCE_ID=2

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - backend-1
      - backend-2
```

### Database Scaling

- Connection pooling (max 20 connections per instance)
- Read replicas for analytics queries
- Separate database for logs (TimescaleDB for time-series)

### Redis Scaling

- Redis Cluster for high availability
- Separate Redis instances for:
  - Rate limiting
  - Session storage
  - Queue management

## Backup Strategy

### Database Backups

```bash
# Automated daily backup script
#!/bin/bash

BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

# Create backup
pg_dump $DATABASE_URL > $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Upload to S3 (optional)
aws s3 cp $BACKUP_FILE.gz s3://your-bucket/backups/

# Delete old backups (keep 30 days)
find $BACKUP_DIR -type f -mtime +30 -delete
```

### Automated Backups (Platform-Specific)

- **Railway:** Automatic daily backups
- **Render:** Point-in-time recovery
- **Fly.io:** Volume snapshots

## Rollback Procedure

### Quick Rollback

```bash
# Railway
railway rollback

# Fly.io
fly releases
fly releases rollback <version>

# Docker
docker-compose down
docker-compose up -d --build <previous-image-tag>
```

### Database Rollback

```bash
# Restore from backup
psql $DATABASE_URL < backup_20240101_120000.sql
```

## Post-Deployment Verification

### Smoke Tests

```bash
# Health check
curl https://api.yourdomain.com/health

# Auth endpoint
curl -X POST https://api.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Chat endpoint (with valid token)
curl -X POST https://api.yourdomain.com/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"What is Flying in MTG?"}'
```

### Performance Tests

```bash
# Install Apache Bench
sudo apt install apache2-utils

# Test endpoint
ab -n 100 -c 10 https://api.yourdomain.com/health
```

### Security Scan

```bash
# SSL test
https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com

# Security headers
https://securityheaders.com/?q=yourdomain.com
```

## Monitoring Dashboard

### Key Metrics to Track

1. **Availability**
   - Uptime percentage
   - Response time
   - Error rate

2. **Performance**
   - Average response time
   - P95/P99 latency
   - Throughput (requests/sec)

3. **Cost**
   - Daily API spend
   - Cost per user
   - Token usage trends

4. **Usage**
   - Active users
   - Requests per tier
   - Popular features

5. **Errors**
   - Error rate by endpoint
   - Failed authentication attempts
   - Rate limit hits

## Troubleshooting

### High Costs

1. Check cost monitoring dashboard
2. Review top users by token usage
3. Verify rate limits are working
4. Check for runaway loops in code
5. Consider reducing max_tokens per tier

### Slow Performance

1. Check database query performance
2. Review Redis hit rate
3. Check for N+1 queries
4. Add database indexes
5. Enable caching

### High Error Rate

1. Check Sentry for error details
2. Review logs for patterns
3. Check database connection pool
4. Verify API key is valid
5. Check external API status (Scryfall, etc.)

## Security Incident Response

### If API Key is Compromised

1. Immediately revoke key in Anthropic Console
2. Generate new key
3. Update environment variables
4. Deploy updated configuration
5. Review logs for suspicious activity
6. Contact Anthropic support if needed

### If Database is Compromised

1. Take affected servers offline
2. Restore from known-good backup
3. Rotate all secrets
4. Review access logs
5. Notify affected users
6. Conduct security audit

## Conclusion

Secure deployment requires attention to multiple layers: infrastructure, application security, monitoring, and cost controls. Start with a simple platform like Railway, implement comprehensive monitoring from day one, and scale gradually based on actual usage.

Remember: Security and cost control are ongoing processes, not one-time tasks.
