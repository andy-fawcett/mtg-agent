# Security Architecture

## Overview

This document defines the security architecture for the MTG Agent web application, which exposes Claude Agent SDK capabilities to public users.

## Threat Model

### Assets to Protect

1. **Anthropic API Keys** - Critical: Exposure leads to unauthorized usage and costs
2. **User Data** - Personal information, chat history, session data
3. **Infrastructure** - Backend servers, databases, cloud resources
4. **Budget** - API usage costs, compute resources
5. **Service Availability** - Protection against DoS/DDoS

### Threat Actors

1. **Malicious Users** - Attempting to abuse the service, extract data, or cause harm
2. **Automated Bots** - Scripts attempting to scrape, spam, or exhaust resources
3. **Cost Exploiters** - Users attempting to generate excessive API costs
4. **Prompt Injectors** - Attempting to manipulate agent behavior
5. **Data Harvesters** - Attempting to extract training data or sensitive information

### Attack Vectors

1. **API Key Exposure**
   - Risk: Client-side code inspection
   - Risk: Network traffic interception
   - Risk: Leaked credentials in version control

2. **Prompt Injection**
   - Risk: Users manipulating agent instructions
   - Risk: Bypassing safety constraints
   - Risk: Data exfiltration through prompts

3. **Resource Exhaustion**
   - Risk: Excessive API calls draining budget
   - Risk: Large context windows consuming tokens
   - Risk: DoS through repeated requests

4. **Authentication Bypass**
   - Risk: Unauthorized access to premium features
   - Risk: Bypassing rate limits
   - Risk: Session hijacking

5. **Data Leakage**
   - Risk: Cross-user data exposure
   - Risk: System prompt leakage
   - Risk: Internal tool/skill exposure

## Security Layers

### Layer 1: Network & Transport Security

**HTTPS/TLS Only**
- All traffic encrypted in transit
- HSTS headers enforced
- Valid SSL certificates required

**CORS Configuration**
- Whitelist specific origins
- No wildcard origins in production
- Credentials included only for trusted domains

**DDoS Protection**
- Cloudflare or equivalent CDN
- Rate limiting at edge
- Geographic restrictions if needed

### Layer 2: Authentication & Authorization

**User Authentication**
- OAuth 2.0 integration (Google, GitHub, etc.) OR
- Email/password with strong requirements
- Session management with secure cookies (HttpOnly, Secure, SameSite)
- Automatic session expiration (30 minutes idle)

**Authorization Levels**
- Anonymous: Very limited (e.g., 3 messages per day)
- Authenticated: Standard tier (e.g., 50 messages per day)
- Premium: Higher limits with payment verification

**Session Security**
- Server-side session storage
- Session rotation after authentication
- IP binding for additional security
- Device fingerprinting for anomaly detection

### Layer 3: API & Backend Security

**API Key Protection**
- Keys stored in environment variables (never in code)
- Backend-only access (zero client exposure)
- Key rotation capability
- Separate keys for dev/staging/prod
- Anthropic API key permissions scoped minimally

**Input Validation**
- Maximum message length (e.g., 2000 characters)
- Content type validation
- SQL injection prevention (if using SQL)
- XSS prevention on all outputs
- Rejection of suspicious patterns

**Backend Isolation**
- Backend API runs on separate domain/subdomain
- No direct public access to Agent SDK
- Database in private network
- Principle of least privilege for all services

### Layer 4: Rate Limiting & Cost Controls

**Multi-Level Rate Limiting**

1. **Per-IP Limits**
   - 10 requests per minute
   - 100 requests per hour
   - 1000 requests per day

2. **Per-User Limits**
   - Authenticated: 50 messages per day
   - Anonymous: 3 messages per day
   - Premium: Custom limits

3. **Global Limits**
   - Maximum concurrent requests
   - Queue system for high load
   - Circuit breaker for API failures

**Cost Controls**
- Maximum token limit per request (e.g., 4000 tokens)
- Maximum context window size
- Daily budget caps with alerting
- Per-user spending tracking
- Automatic throttling at budget thresholds

**Monitoring & Alerts**
- Real-time cost tracking
- Alert at 50%, 75%, 90% of daily budget
- Alert on unusual usage patterns
- Alert on authentication failures

### Layer 5: Agent SDK Security

**Agent Constraints**
- Agents limited to MTG-specific operations
- No file system access
- No network access (except approved APIs)
- No code execution capabilities
- No access to environment variables

**Tool Restrictions**
- Whitelist-only tool access
- All tools validated and sandboxed
- No tools that access sensitive data
- Read-only tools preferred
- All tool inputs validated

**Skill Limitations**
- Skills scoped to MTG domain
- No admin/system skills exposed
- Skills cannot modify agent constraints
- Skill outputs sanitized

**Prompt Engineering**
- System prompts hardcoded (not user-modifiable)
- Clear boundaries in instructions
- Safety constraints emphasized
- User content clearly demarcated
- Anti-jailbreaking instructions

### Layer 6: Data Security

**Data Storage**
- Encrypt sensitive data at rest (AES-256)
- User chat history encrypted
- PII minimization - collect only necessary data
- Data retention policies (e.g., 30 days)
- Secure deletion after retention period

**Data Access**
- Principle of least privilege
- Audit logging for all access
- No cross-user data access
- Anonymization for analytics

**Privacy**
- Clear privacy policy
- User consent for data collection
- GDPR/CCPA compliance if applicable
- User data export capability
- User data deletion on request

### Layer 7: Monitoring & Incident Response

**Logging**
- All API requests logged
- Authentication events logged
- Rate limit violations logged
- Error conditions logged
- Logs stored securely with retention policy

**Monitoring**
- Real-time dashboards
- Anomaly detection
- Failed authentication tracking
- Cost tracking
- Performance metrics

**Incident Response**
- Automated alerts for critical issues
- Manual review process for suspicious activity
- API key rotation procedure
- User ban capability
- Rollback procedures

## Security Checklist

### Development Phase
- [ ] No API keys in source code
- [ ] Environment variables for all secrets
- [ ] Input validation on all endpoints
- [ ] Output sanitization implemented
- [ ] HTTPS enforced
- [ ] CORS properly configured
- [ ] Rate limiting implemented
- [ ] Authentication system tested
- [ ] Agent constraints verified
- [ ] Security headers configured

### Pre-Deployment
- [ ] Security audit completed
- [ ] Penetration testing performed
- [ ] Cost controls tested
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Incident response plan documented
- [ ] Backup and recovery tested
- [ ] Privacy policy published
- [ ] Terms of service published

### Post-Deployment
- [ ] Monitor logs daily
- [ ] Review cost reports daily
- [ ] Check for security updates weekly
- [ ] Rotate API keys quarterly
- [ ] Security audit annually
- [ ] Update dependencies regularly

## Technology Recommendations

**Backend Framework Options**
- Node.js + Express (with helmet, rate-limit packages)
- Python + FastAPI (with slowapi for rate limiting)
- Go + Gin/Echo (built-in performance, easy to secure)

**Database Options**
- PostgreSQL (for relational data, user management)
- Redis (for session storage, rate limiting, caching)

**Authentication**
- Auth0 (managed service, enterprise-ready)
- NextAuth.js (if using Next.js)
- Passport.js (Node.js, flexible)
- Custom JWT implementation (more control)

**Hosting Recommendations**
- Vercel/Netlify (frontend)
- Railway/Render/Fly.io (backend)
- AWS/GCP/Azure (enterprise scale)
- Cloudflare (CDN + DDoS protection)

**Monitoring Tools**
- Sentry (error tracking)
- LogRocket/DataDog (full monitoring)
- CloudWatch/Stackdriver (if on AWS/GCP)
- Prometheus + Grafana (self-hosted)

## Conclusion

This security architecture implements defense-in-depth principles with multiple layers of protection. The most critical aspect is ensuring API keys never reach the client and implementing robust rate limiting to prevent abuse and control costs.

Regular security reviews and updates are essential as threats evolve.
