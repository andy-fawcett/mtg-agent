# Security Checklist - MTG Agent

## Overview

Use this checklist before deploying to production. Every item should be verified.

## 🔐 API Key Security

### Development
- [ ] API keys stored in `.env` file (never in code)
- [ ] `.env` file added to `.gitignore`
- [ ] No API keys in Git history (`git log --all -S "sk-ant-"`)
- [ ] Different API keys for dev/staging/prod
- [ ] API keys loaded from environment variables with validation

### Production
- [ ] API keys stored in platform environment variables (Railway, Render, etc.)
- [ ] API keys never sent to frontend/client
- [ ] API keys not logged anywhere
- [ ] API keys not in error messages
- [ ] Key rotation procedure documented
- [ ] Team members know how to rotate keys

## 🛡️ Backend Security

### HTTPS/SSL
- [ ] HTTPS enforced (no HTTP traffic allowed)
- [ ] Valid SSL certificate installed
- [ ] HSTS header enabled
- [ ] Certificate auto-renewal configured

### CORS Configuration
- [ ] CORS restricted to specific frontend domain (no wildcards)
- [ ] `credentials: true` only for trusted origins
- [ ] Preflight requests handled correctly
- [ ] Methods restricted (only GET, POST as needed)

### Security Headers
- [ ] `helmet` middleware installed and configured
- [ ] `X-Frame-Options: DENY` set
- [ ] `X-Content-Type-Options: nosniff` set
- [ ] `X-XSS-Protection: 1; mode=block` set
- [ ] `Strict-Transport-Security` header set
- [ ] Content-Security-Policy configured

### Input Validation
- [ ] All user inputs validated before processing
- [ ] Message length limits enforced (e.g., 2000 chars)
- [ ] Type checking on all inputs
- [ ] Suspicious patterns detected (jailbreak attempts)
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output sanitization)

### Output Sanitization
- [ ] HTML/script tags removed from responses
- [ ] Response length limited
- [ ] Prompt leakage prevention
- [ ] API keys/secrets not in responses
- [ ] Error messages don't reveal internals

## 🚦 Rate Limiting

### Implementation
- [ ] Edge-level rate limiting (Cloudflare/CDN)
- [ ] Application-level per-IP rate limiting
- [ ] Per-user rate limiting implemented
- [ ] Rate limits vary by user tier
- [ ] Rate limit responses include Retry-After header
- [ ] Redis configured for distributed rate limiting

### Limits Configured
- [ ] Anonymous: Max 3 messages/day
- [ ] Free tier: Max 50 messages/day
- [ ] Premium tier: Higher limits defined
- [ ] Per-minute limits (10 req/min)
- [ ] Per-hour limits (100 req/hour)

## 💰 Cost Controls

### Budget Management
- [ ] Daily budget cap configured (e.g., $10/day)
- [ ] Cost tracking implemented
- [ ] Alerts at 50% budget threshold
- [ ] Alerts at 75% budget threshold
- [ ] Alerts at 90% budget threshold
- [ ] Circuit breaker at 100% budget
- [ ] Cost estimation before requests
- [ ] Token limits enforced per tier

### Monitoring
- [ ] Real-time cost dashboard
- [ ] Daily cost reports
- [ ] Per-user cost tracking
- [ ] Unusual usage detection
- [ ] Alert email/SMS configured

## 🔑 Authentication & Authorization

### User Authentication
- [ ] Authentication middleware on protected routes
- [ ] Password hashing with bcrypt (cost factor ≥12) OR
- [ ] OAuth configured with trusted providers
- [ ] Session management secure (httpOnly, secure, sameSite)
- [ ] Session secrets are random and secure (32+ bytes)
- [ ] Session expiration configured (7 days max, rolling on activity)

### Password Security (if using email/password)
- [ ] Minimum 12 character requirement
- [ ] Complexity requirements enforced
- [ ] Common passwords blocked
- [ ] Password reset flow implemented
- [ ] Account lockout after 5 failed attempts
- [ ] Lockout duration: 15 minutes

### Authorization
- [ ] User tier system implemented
- [ ] Feature access by tier enforced
- [ ] Anonymous tier has strict limits
- [ ] Premium features protected
- [ ] Admin routes protected

## 🤖 Agent SDK Security

### Agent Configuration
- [ ] System prompt hardcoded server-side
- [ ] System prompt includes anti-jailbreak instructions
- [ ] User input clearly separated from instructions
- [ ] Token limits enforced (maxTokens set per tier)
- [ ] Timeout configured (30 seconds max)
- [ ] No user-modifiable system instructions

### Tools
- [ ] Whitelist-only tool registration
- [ ] NO file system access tools
- [ ] NO code execution tools
- [ ] NO database write tools
- [ ] NO environment variable access tools
- [ ] All tool inputs validated
- [ ] All tool outputs sanitized
- [ ] Tool timeouts enforced (5 seconds)

### Skills
- [ ] Skills limited to MTG domain
- [ ] No admin/system skills
- [ ] Read-only operations preferred
- [ ] Skill permissions validated
- [ ] Skill outputs sanitized

### Subagents (if used)
- [ ] Subagents inherit parent constraints
- [ ] Isolated execution (no cross-contamination)
- [ ] Limited tool access per subagent purpose
- [ ] Cannot create nested subagents
- [ ] Same tier restrictions apply

## 📊 Logging & Monitoring

### Logging
- [ ] All API requests logged
- [ ] Authentication events logged
- [ ] Rate limit violations logged
- [ ] Errors logged with context
- [ ] NO sensitive data in logs (passwords, API keys)
- [ ] NO full user messages in logs (privacy)
- [ ] Log rotation configured
- [ ] Log retention policy (30 days)

### Error Tracking
- [ ] Sentry (or equivalent) configured
- [ ] Error alerts configured
- [ ] Error grouping enabled
- [ ] Source maps uploaded (if using TypeScript)
- [ ] Environment properly tagged

### Uptime Monitoring
- [ ] Health check endpoint implemented
- [ ] Uptime monitoring service configured (UptimeRobot, etc.)
- [ ] Downtime alerts configured
- [ ] Response time tracking

### Metrics Dashboard
- [ ] Request rate tracked
- [ ] Error rate tracked
- [ ] Response time tracked
- [ ] Cost per user tracked
- [ ] Active users tracked

## 🗄️ Database Security

### Configuration
- [ ] Database in private network (not public)
- [ ] Strong database password
- [ ] Connection pooling configured
- [ ] SSL/TLS for database connections
- [ ] Prepared statements (no raw SQL from user input)

### Backups
- [ ] Automated daily backups
- [ ] Backup restoration tested
- [ ] Backups stored securely
- [ ] Backup retention policy (30 days)
- [ ] Off-site backup storage

### Data Privacy
- [ ] PII minimization (collect only what's needed)
- [ ] Data encrypted at rest
- [ ] User data deletion capability
- [ ] Privacy policy published
- [ ] GDPR/CCPA compliance (if applicable)

## 🚀 Deployment

### Environment
- [ ] Production environment separated from dev/staging
- [ ] Environment variables set correctly
- [ ] NODE_ENV=production
- [ ] Debug mode disabled
- [ ] Source maps not exposed in production

### Secrets Management
- [ ] All secrets in environment variables (not in code)
- [ ] Secrets manager used (if enterprise)
- [ ] API keys rotated quarterly
- [ ] Old secrets revoked after rotation

### Infrastructure
- [ ] Load balancer configured (if scaling)
- [ ] Auto-scaling configured (if needed)
- [ ] CDN configured (Cloudflare)
- [ ] DDoS protection enabled
- [ ] Firewall rules configured

## 🧪 Testing

### Security Testing
- [ ] Jailbreak attempts tested
- [ ] SQL injection tested
- [ ] XSS attacks tested
- [ ] CSRF protection tested
- [ ] Rate limiting tested
- [ ] Authentication bypass attempts tested

### Penetration Testing
- [ ] Security headers validated (securityheaders.com)
- [ ] SSL configuration tested (ssllabs.com)
- [ ] OWASP Top 10 vulnerabilities checked
- [ ] Third-party security audit (if budget allows)

### Load Testing
- [ ] Concurrent users tested
- [ ] Rate limits verified under load
- [ ] Database performance tested
- [ ] Circuit breaker tested

## 📱 Frontend Security

### Code Security
- [ ] No API keys in frontend code
- [ ] No secrets in localStorage
- [ ] No sensitive data in URL parameters
- [ ] XSS prevention (React escapes by default, but verify)
- [ ] HTTPS enforced

### CAPTCHA (for anonymous)
- [ ] CAPTCHA implemented for anonymous users
- [ ] reCAPTCHA v3 or equivalent
- [ ] CAPTCHA verified server-side

## 📋 Compliance & Legal

### Documentation
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Cookie policy (if using cookies)
- [ ] Data processing agreement (if collecting EU data)

### User Rights
- [ ] User data export capability
- [ ] User data deletion capability
- [ ] Account deactivation capability
- [ ] Email unsubscribe capability

## 🚨 Incident Response

### Preparation
- [ ] Incident response plan documented
- [ ] Emergency contact list maintained
- [ ] Backup restoration procedure tested
- [ ] API key rotation procedure documented
- [ ] Team trained on incident response

### Detection
- [ ] Anomaly detection configured
- [ ] Failed login tracking
- [ ] Unusual cost patterns detected
- [ ] Security event alerts configured

### Response Procedures
- [ ] Steps to revoke compromised API key
- [ ] Steps to restore from backup
- [ ] Steps to notify affected users
- [ ] Post-mortem template ready

## ✅ Final Pre-Launch Checklist

### Day Before Launch
- [ ] All above items checked
- [ ] Secrets rotated
- [ ] Backups verified
- [ ] Monitoring tested
- [ ] Team briefed

### Launch Day
- [ ] Monitor dashboard actively
- [ ] Check logs frequently
- [ ] Verify all alerts working
- [ ] Test all critical paths
- [ ] Have rollback plan ready

### First Week
- [ ] Daily cost reviews
- [ ] Daily security log reviews
- [ ] User feedback monitoring
- [ ] Performance monitoring
- [ ] Adjust rate limits based on actual usage

## 📈 Ongoing Security

### Daily
- [ ] Review cost dashboard
- [ ] Check error logs
- [ ] Monitor unusual activity

### Weekly
- [ ] Review security logs
- [ ] Check for failed authentications
- [ ] Review user tier usage
- [ ] Update dependencies

### Monthly
- [ ] Security patch updates
- [ ] Cost optimization review
- [ ] Access control review
- [ ] Backup restoration test

### Quarterly
- [ ] Rotate API keys
- [ ] Security audit
- [ ] Penetration testing
- [ ] Update documentation
- [ ] Team security training

## 🆘 Emergency Contacts

Document these before launch:

- [ ] Primary on-call engineer
- [ ] Backup on-call engineer
- [ ] Anthropic support contact
- [ ] Hosting platform support
- [ ] Database administrator
- [ ] Security team lead

## Sign-Off

Before deploying to production, the following people should review and approve:

- [ ] Lead Developer
- [ ] Security Engineer (if available)
- [ ] DevOps/Infrastructure Engineer
- [ ] Product Manager
- [ ] Legal/Compliance (if required)

---

**Date Reviewed:** ________________

**Reviewed By:** ________________

**Production Deployment Approved:** ☐ Yes ☐ No

**Notes/Exceptions:**
