# Phase 1: MVP - Internal Use Only

**Status:** ⏸️ Not Started
**Duration Estimate:** 2 weeks (40-60 hours)
**Actual Duration:** [Fill when complete]
**Prerequisites:** None (First phase)
**Target Completion:** 2025-11-15

## Overview

Build a working MTG chat assistant for internal testing and concept validation. This phase establishes the secure foundation that all future phases will build upon. The system will run locally via Docker and include authentication, rate limiting, and cost controls.

## Objectives

- **Secure Claude Integration:** Working MTG chat with hardened system prompts and no API key exposure
- **Multi-Layer Authentication:** Email/password auth + anonymous trials (3 messages/day)
- **Cost Protection:** Daily budget caps, real-time tracking, and automatic shutoff at limits
- **Rate Limiting:** IP-based and user-based limits to prevent abuse
- **Local Deployment:** Fully containerized with Docker Compose for easy setup

## Why This Phase

### Business Justification
- **Validate Concept:** Ensure Claude can provide valuable MTG assistance before investing in advanced features
- **Learn User Needs:** Gather feedback from trusted users to guide feature priorities
- **Prove Security:** Demonstrate we can protect API keys and control costs before public release
- **Risk Mitigation:** Build incrementally with ability to pivot based on early feedback

### Technical Justification
- **Foundation First:** Establishing patterns for auth, rate limiting, and cost controls that Phase 2-5 will extend
- **Security by Design:** Implementing security from day one rather than retrofitting later
- **Modularity:** Clean architecture makes adding MTG tools (Phase 3) straightforward
- **DevEx:** Docker setup ensures consistent environments and easy onboarding

### Dependencies
- **Builds Upon:** Project documentation (already complete)
- **Enables:** Phase 2 (Security Hardening), Phase 3 (MTG Features)
- **Blocks:** Nothing - first phase sets the foundation

## Sub-Phases

### Phase 1.0: Foundation & Project Setup
**Time Estimate:** 4-6 hours
**Status:** ⏸️ Not Started
**[View Details](PHASE_1.0_FOUNDATION.md)**

Set up project structure, TypeScript configuration, Docker Compose, and basic Express server.

**Key Deliverables:**
- Backend project structure with TypeScript
- Docker Compose (PostgreSQL + Redis)
- Basic Express server with health endpoint
- Environment variable configuration
- Hot-reload development environment

**Verification:**
- `npm run dev` starts server without errors
- Docker containers running and healthy
- Health endpoint returns 200
- Environment variables load correctly

---

### Phase 1.1: Database Layer
**Time Estimate:** 6-8 hours
**Status:** ⏸️ Not Started
**[View Details](PHASE_1.1_DATABASE.md)**

PostgreSQL schema, migrations, and user management with type-safe operations.

**Key Deliverables:**
- Database schema (users, sessions, chat_logs)
- Migration scripts
- User model with TypeScript types
- CRUD operations for users
- Connection pooling

**Verification:**
- Can create users programmatically
- Can query users by email
- Indexes exist and performant
- Connection pool working

---

### Phase 1.2: Authentication & Authorization
**Time Estimate:** 6-7 hours
**Status:** ⏸️ Not Started
**[View Details](PHASE_1.2_AUTH.md)**

Session-based authentication with Redis, bcrypt password hashing, and tier-based authorization.

**Architectural Decision:** Using server-side sessions with Redis for immediate user revocation and cost control.

**Key Deliverables:**
- User registration with validation
- Login with session creation
- Logout with immediate session destruction
- Auth middleware for protected routes (requireAuth, optionalAuth, requireTier)
- Password strength requirements
- User tier system (anonymous, free, premium)

**Verification:**
- Can register new users
- Can login and create session
- Can logout and destroy session
- Protected routes reject requests without session
- Passwords hashed with bcrypt
- Sessions stored in Redis

---

### Phase 1.3: Rate Limiting & Cost Controls
**Time Estimate:** 6-8 hours
**Status:** ⏸️ Not Started
**[View Details](PHASE_1.3_RATE_LIMITING.md)**

Multi-layer rate limiting with Redis and budget tracking to prevent abuse and runaway costs.

**Key Deliverables:**
- IP-based rate limiting (10 req/min)
- User-based rate limiting (by tier)
- Cost estimation before requests
- Daily budget tracking
- Budget cap enforcement
- Alert system for budget thresholds (50%, 75%, 90%)

**Verification:**
- Rate limits enforced correctly
- Costs tracked accurately
- Budget caps prevent overspend
- Alerts fire at thresholds

---

### Phase 1.4: Claude Agent SDK Integration
**Time Estimate:** 6-8 hours
**Status:** ⏸️ Not Started
**[View Details](PHASE_1.4_CLAUDE_SDK.md)**

Secure integration with Claude API for MTG chat with hardened prompts and safety controls.

**Key Deliverables:**
- Anthropic SDK initialization
- Hardened MTG system prompt
- Jailbreak attempt detection
- Output sanitization
- Token counting and limits
- Error handling and retries

**Verification:**
- Can chat about MTG successfully
- Jailbreak attempts blocked
- Output sanitized properly
- Token limits enforced
- Errors handled gracefully

---

### Phase 1.5: API Endpoints & Validation
**Time Estimate:** 4-6 hours
**Status:** ⏸️ Not Started
**[View Details](PHASE_1.5_API.md)**

Complete REST API with comprehensive input validation using Zod.

**Key Deliverables:**
- POST /api/auth/register
- POST /api/auth/login
- POST /api/chat
- GET /health
- Request validation with Zod schemas
- Error handling middleware
- Security headers (helmet)

**Verification:**
- All endpoints respond correctly
- Invalid input rejected
- Error messages helpful but secure
- Security headers present

---

### Phase 1.6: Frontend Application
**Time Estimate:** 8-12 hours
**Status:** ⏸️ Not Started
**[View Details](PHASE_1.6_FRONTEND.md)**

Next.js frontend with chat interface, authentication pages, and responsive design.

**Key Deliverables:**
- Next.js 14 app setup
- Chat interface component
- Login/register pages
- Anonymous mode UI
- Rate limit display
- Error handling
- Responsive design (mobile + desktop)

**Verification:**
- Can login via UI
- Can send chat messages
- Rate limits displayed
- Works on mobile
- Errors shown clearly

---

### Phase 1.7: Integration & End-to-End Testing
**Time Estimate:** 6-8 hours
**Status:** ⏸️ Not Started
**[View Details](PHASE_1.7_TESTING.md)**

Comprehensive testing of the complete system including security, performance, and edge cases.

**Key Deliverables:**
- Integration test suite
- Security testing (jailbreaks, rate limits)
- Load testing (100 concurrent users)
- Error scenario testing
- Documentation updates
- Deployment guide

**Verification:**
- All tests pass
- Handles 100 concurrent users
- Costs stay under $1/day
- No security vulnerabilities
- Ready for Phase 2

---

## Technology Stack

**Backend:**
- **Runtime:** Node.js 20+
- **Framework:** Express.js 4.x
- **Language:** TypeScript 5.x
- **Database:** PostgreSQL 15
- **Cache:** Redis 7
- **API:** Claude 4.5 Sonnet via @anthropic-ai/sdk

**Frontend:**
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5.x
- **Styling:** TailwindCSS 3.x
- **HTTP Client:** Fetch API

**DevOps:**
- **Containerization:** Docker + Docker Compose
- **Process Manager:** tsx (development)
- **Environment:** dotenv

**Key Dependencies:**
```json
{
  "express": "^4.18.0",
  "typescript": "^5.3.0",
  "@anthropic-ai/sdk": "^0.10.0",
  "pg": "^8.11.0",
  "ioredis": "^5.3.0",
  "bcrypt": "^5.1.0",
  "express-session": "^1.17.3",
  "connect-redis": "^7.1.0",
  "zod": "^3.22.0",
  "helmet": "^7.1.0",
  "cors": "^2.8.5",
  "next": "^14.0.0",
  "react": "^18.2.0",
  "tailwindcss": "^3.4.0"
}
```

## Architecture Decisions

### Decision 1: Authentication Method
**Decision:** Server-side sessions with Redis

**Rationale:**
- Immediate user revocation for cost control
- Redis infrastructure already available
- Simple security model for MVP

---

### Decision 2: Monolith vs Microservices
**Context:** Should backend be one app or split into services?

**Options Considered:**
- **Option A (Monolith):** Single Express app
  - Pros: Simple, fast iteration, easier debugging
  - Cons: Harder to scale independently

- **Option B (Microservices):** Separate auth, chat, admin services
  - Pros: Independent scaling, tech flexibility
  - Cons: Complex, overkill for MVP, harder to debug

**Decision:** Option A (Monolith)

**Rationale:**
- MVP traffic easily handled by monolith
- Faster development velocity
- Can split in Phase 4 if needed
- Docker makes scaling horizontal easy

**Consequences:**
- All services scale together
- Simpler deployment
- May need to refactor in Phase 5 at high scale

---

### Decision 3: TypeScript vs JavaScript
**Context:** Use TypeScript or plain JavaScript?

**Options Considered:**
- **Option A (TypeScript):** Type-safe, catches errors at compile time
- **Option B (JavaScript):** Faster to write, no compilation

**Decision:** TypeScript (strict mode)

**Rationale:**
- Catches bugs before runtime
- Better IDE support
- Self-documenting code
- Standard for professional projects
- Minimal overhead with tsx

**Consequences:**
- Learning curve if unfamiliar
- Build step required
- Better code quality and maintainability

---

## Success Criteria

Phase 1 is complete when ALL of the following are true:

### Functional Requirements
- [ ] Can register new user accounts
- [ ] Can login and create session
- [ ] Can chat about MTG rules and strategies
- [ ] Anonymous users can try 3 messages
- [ ] Rate limits prevent abuse
- [ ] Costs tracked in real-time
- [ ] Budget cap prevents overspend

### Technical Requirements
- [ ] All code follows TypeScript strict mode
- [ ] All TypeScript compiles without errors
- [ ] All sub-phases completed
- [ ] All verification steps pass
- [ ] No linting errors or warnings
- [ ] Database schema applied correctly
- [ ] Docker Compose starts all services

### Documentation Requirements
- [ ] All code has inline comments
- [ ] README files updated
- [ ] API endpoints documented
- [ ] Environment variables documented
- [ ] Setup instructions complete

### Security Requirements
- [ ] API keys never exposed to client
- [ ] Passwords hashed with bcrypt (cost 12+)
- [ ] Session secrets are randomized
- [ ] Input validation on all endpoints
- [ ] Output sanitization working
- [ ] CORS configured correctly
- [ ] Security headers present (helmet)
- [ ] .env not in Git

### Testing Requirements
- [ ] Can run full system with `docker-compose up`
- [ ] Health endpoint returns 200
- [ ] Can register via API
- [ ] Can login via API
- [ ] Can chat via API
- [ ] Rate limits trigger correctly
- [ ] Budget tracking accurate
- [ ] Jailbreak attempts blocked

### Performance Requirements
- [ ] Chat response < 3s (p95)
- [ ] Login response < 200ms
- [ ] Registration < 300ms
- [ ] Memory usage < 512MB
- [ ] Handles 10 concurrent users smoothly

### Deployment Requirements
- [ ] Fresh clone can start with `docker-compose up`
- [ ] Environment variables documented
- [ ] No manual database setup required
- [ ] Migrations run automatically
- [ ] Services restart after crashes

## Risk Assessment

### High Risks

**Risk:** API key accidentally exposed in client code
- **Likelihood:** Medium
- **Impact:** Critical (Unlimited cost exposure)
- **Mitigation:**
  - Never import @anthropic-ai/sdk in frontend
  - Code review every commit
  - Automated scanning for API keys in git history
- **Contingency:** Immediately revoke key, generate new one, audit usage logs

**Risk:** Costs spiral out of control during testing
- **Likelihood:** Medium
- **Impact:** High ($100s in charges)
- **Mitigation:**
  - Set daily budget to $1 during development
  - Real-time alerts at 50%, 75%, 90%
  - Circuit breaker at 100%
  - Monitor costs daily
- **Contingency:** Emergency API disable, contact Anthropic

**Risk:** Development takes longer than estimated
- **Likelihood:** Medium
- **Impact:** Medium (Delayed launch)
- **Mitigation:**
  - Time estimates include buffer
  - Track actual vs estimated time
  - Adjust scope if needed
- **Contingency:** Reduce scope, defer frontend polish, simplify features

### Medium Risks

**Risk:** Docker issues on different operating systems
- **Likelihood:** Medium
- **Impact:** Low (Blocks some developers)
- **Mitigation:** Test on macOS, Windows, Linux
- **Contingency:** Provide native setup instructions as fallback

**Risk:** Database schema needs major changes mid-development
- **Likelihood:** Low
- **Impact:** Medium (Lost time)
- **Mitigation:** Careful schema design upfront, use migrations
- **Contingency:** Write migration, accept iteration time

**Risk:** Next.js learning curve slows frontend development
- **Likelihood:** Low (if experienced with React)
- **Impact:** Low
- **Mitigation:** Stick to simple patterns, use documentation
- **Contingency:** Simplify UI, use plain React if needed

## Performance Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Chat Response (p95) | < 3s | Load testing with realistic prompts |
| Login Response (p95) | < 200ms | API testing with curl/postman |
| Registration (p95) | < 300ms | API testing |
| Memory Usage (backend) | < 512MB | Docker stats during load test |
| Database Queries | < 50ms | PostgreSQL query logs |
| API Throughput | > 10 req/sec | Load testing with Apache Bench |
| Docker Startup | < 30s | Time `docker-compose up` |

## Testing Strategy

### Unit Testing
**Coverage Target:** 70%+ (focusing on critical paths)
**Tools:** Jest, ts-jest
**Focus Areas:**
- Authentication logic (session management, password hashing)
- Rate limiting calculations
- Cost estimation functions
- Input validation schemas (Zod)
- Utility functions

**Example Tests:**
```typescript
describe('Auth Service', () => {
  it('should hash passwords with bcrypt', async () => {
    const password = 'SecurePass123!';
    const hash = await hashPassword(password);
    expect(await verifyPassword(password, hash)).toBe(true);
  });

  it('should create valid sessions', async () => {
    const mockSession = { userId: undefined, tier: undefined };
    await createSession(mockSession, { userId: '123', tier: 'free' });
    expect(mockSession.userId).toBe('123');
  });
});
```

### Integration Testing
**Tools:** Supertest, test database
**Focus Areas:**
- API endpoint flows (register → login → chat)
- Database operations with real queries
- Redis rate limiting under load
- Error handling across services

**Example Tests:**
```typescript
describe('POST /api/auth/register', () => {
  it('should create user and initialize session', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'SecurePass123!' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('test@example.com');
  });
});
```

### Manual Testing Checklist
- [ ] Register new user via frontend
- [ ] Login via frontend
- [ ] Send MTG question and get response
- [ ] Try to send more than rate limit
- [ ] Try anonymous mode (3 messages max)
- [ ] Try jailbreak prompts (should be blocked)
- [ ] Check database has correct data
- [ ] Verify costs tracked in database
- [ ] Test error scenarios (invalid input)
- [ ] Test on mobile browser

### Security Testing
- [ ] API keys not in browser DevTools
- [ ] API keys not in Git history (`git log --all -S "sk-ant-"`)
- [ ] Passwords not stored in plaintext
- [ ] Sessions cannot be forged
- [ ] Rate limits cannot be bypassed
- [ ] SQL injection attempts fail
- [ ] XSS attempts sanitized

### Load Testing
```bash
# Test authentication endpoint
ab -n 1000 -c 10 -p login.json -T application/json \
  http://localhost:3000/api/auth/login

# Test health endpoint
ab -n 10000 -c 100 http://localhost:3000/health

# Expected results:
# - 99%+ success rate
# - p95 latency < 200ms
# - No memory leaks
```

## Common Issues & Troubleshooting

### Issue: Port 5432 already in use
**Symptoms:**
- Docker Compose fails to start PostgreSQL
- Error: "port is already allocated"

**Root Cause:** Another PostgreSQL instance running locally

**Solution:**
```bash
# Find process using port 5432
lsof -i :5432

# Stop local PostgreSQL (macOS)
brew services stop postgresql@15

# Or change port in docker-compose.yml
ports:
  - "5433:5432"  # Map to different host port
```

**Prevention:** Document local port conflicts in README

---

### Issue: TypeScript compilation errors after npm install
**Symptoms:**
- `npm run dev` fails
- Type errors in node_modules

**Root Cause:** Mismatched @types packages

**Solution:**
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install

# Verify TypeScript version
npx tsc --version

# Check for duplicate types
npm ls @types/node
```

---

### Issue: Cannot connect to database from backend
**Symptoms:**
- Connection refused errors
- "ECONNREFUSED 127.0.0.1:5432"

**Root Cause:** Wrong hostname (using localhost instead of service name)

**Solution:**
```typescript
// ❌ Wrong (when running in Docker)
const db = new Pool({ host: 'localhost' });

// ✅ Correct (use service name from docker-compose.yml)
const db = new Pool({ host: 'postgres' });

// For local development outside Docker
const db = new Pool({
  host: process.env.DB_HOST || 'localhost'
});
```

---

### Issue: Rate limits not working
**Symptoms:**
- Can send unlimited requests
- No 429 errors

**Root Cause:** Redis not connected or rate limit middleware not applied

**Solution:**
```bash
# Check Redis is running
docker-compose ps redis
redis-cli ping

# Verify middleware order in Express
app.use('/api/chat', rateLimitMiddleware, chatHandler);
```

---

## Phase Completion Checklist

### Code Quality
- [ ] All TypeScript strict mode enabled
- [ ] No `any` types (except where necessary)
- [ ] All functions have return types
- [ ] No TODO comments left
- [ ] No console.log statements in production code
- [ ] Error handling comprehensive
- [ ] Logging meaningful and structured

### Testing
- [ ] Unit tests written for critical functions
- [ ] Integration tests for API endpoints
- [ ] Manual testing complete
- [ ] Security testing done
- [ ] Load testing done (10 concurrent users minimum)
- [ ] All tests documented

### Documentation
- [ ] This README updated with actual metrics
- [ ] All sub-phase docs complete
- [ ] Code comments explain "why" not "what"
- [ ] API endpoints documented
- [ ] Environment variables documented
- [ ] Setup guide tested on fresh machine

### Git & Version Control
- [ ] All changes committed with meaningful messages
- [ ] No secrets in Git history
- [ ] .gitignore properly configured
- [ ] Branch clean (no merge conflicts)

### Security
- [ ] Security checklist items completed
- [ ] No API keys in code or Git
- [ ] Dependencies up to date
- [ ] No known vulnerabilities (`npm audit`)
- [ ] Passwords hashed with bcrypt
- [ ] Sessions use secure secrets

### Deployment
- [ ] `docker-compose up` works on fresh checkout
- [ ] Environment variables documented in .env.example
- [ ] Database migrations run automatically
- [ ] Services restart on failure
- [ ] Health checks work

### User Experience
- [ ] Chat responds in < 3s
- [ ] Error messages helpful
- [ ] Mobile responsive
- [ ] Rate limits explained to users
- [ ] Anonymous trial clearly communicated

## Metrics & Outcomes

### Planned vs Actual

| Metric | Planned | Actual | Variance |
|--------|---------|--------|----------|
| Duration | 2 weeks | ___ | ___ |
| Total Hours | 40-60 | ___ | ___ |
| Backend LOC | ~2000 | ___ | ___ |
| Frontend LOC | ~800 | ___ | ___ |
| Test Coverage | 70% | ___% | ___ |
| Bugs Found | - | ___ | ___ |
| Daily Cost | <$1 | $__ | ___ |

### Lessons Learned

**What Went Well:**
- [To be filled after completion]

**What Could Be Improved:**
- [To be filled after completion]

**Insights for Phase 2:**
- [To be filled after completion]

## Related Documentation

- [Overall Roadmap](../ROADMAP.md)
- [Security Architecture](../../SECURITY_ARCHITECTURE.md)
- [Backend Architecture](../../BACKEND_ARCHITECTURE.md)
- [API Security](../../API_SECURITY.md)
- [Next Phase: Security Hardening](../PHASE_2_SECURITY/README.md)

## Timeline

```
Week 1:
├── Day 1: Phase 1.0 (Foundation) + Phase 1.1 (Database)
├── Day 2: Phase 1.2 (Authentication)
├── Day 3: Phase 1.3 (Rate Limiting) + Phase 1.4 (Claude SDK)
├── Day 4: Phase 1.5 (API Endpoints)
└── Day 5: Phase 1.6 (Frontend) start

Week 2:
├── Day 1-2: Phase 1.6 (Frontend) complete
├── Day 3: Phase 1.7 (Testing)
├── Day 4: Bug fixes and polish
└── Day 5: Documentation and handoff
```

## Sign-Off

**Development Complete:** ☐
- Completed by: _______________
- Date: _______________

**Testing Complete:** ☐
- Completed by: _______________
- Date: _______________

**Documentation Complete:** ☐
- Completed by: _______________
- Date: _______________

**Phase Approved for Phase 2:** ☐
- Approved by: _______________
- Date: _______________

---

**Phase Status:** ⏸️ Not Started
**Last Updated:** 2025-11-01
**Next Phase:** [Phase 2: Security Hardening](../PHASE_2_SECURITY/README.md)
