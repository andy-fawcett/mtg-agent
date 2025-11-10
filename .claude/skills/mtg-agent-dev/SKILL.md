# MTG Agent Development Context

**Skill Name:** mtg-agent-dev
**Purpose:** Provide intelligent context for MTG Agent project development
**When to Use:** Automatically loaded by `/start` command, or manually when working on specific aspects

---

## Overview

This skill provides you with comprehensive project context, helping you understand:
- Current architecture and technology decisions
- Security requirements for the current phase
- Code patterns and examples to follow
- Common pitfalls and how to avoid them
- Verification steps to ensure quality

---

## Project Architecture

### System Design

```
┌─────────────────────┐
│   User Browser      │
│  (Next.js Frontend) │
└──────────┬──────────┘
           │ HTTPS (No API Keys)
           ↓
┌─────────────────────┐
│   Backend Proxy     │
│  (Express + TypeScript)
│  - Authentication   │
│  - Rate Limiting    │
│  - Validation       │
│  - Cost Tracking    │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Claude Agent SDK   │
│  - System Prompts   │
│  - Jailbreak Guard  │
│  - Skills & Tools   │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   Anthropic API     │
│  (Claude 4.5 Sonnet)│
└─────────────────────┘

Supporting Services:
- PostgreSQL (user data, chat logs, cost tracking)
- Redis (rate limiting, sessions, caching)
```

### Technology Stack

**Backend:**
- Node.js 20+ with TypeScript 5.x (strict mode)
- Express.js 4.x for REST API
- PostgreSQL 15 for persistent data
- Redis 7 for caching and rate limiting
- Anthropic SDK for Claude integration
- Docker + Docker Compose for local dev

**Frontend:**
- Next.js 14 (App Router)
- TypeScript + TailwindCSS
- React 18

**Security Stack:**
- bcrypt (password hashing, cost 12+)
- express-session + connect-redis (session-based auth)
- helmet (security headers)
- Zod (input validation)
- rate-limiter-flexible (Redis-backed rate limiting)

---

## Security Principles

### Critical Rules (NEVER VIOLATE)

1. **API Key Protection**
   - ❌ NEVER import `@anthropic-ai/sdk` in frontend code
   - ✅ ALWAYS keep API keys server-side only
   - ✅ ALWAYS use environment variables
   - ✅ ALWAYS gitignore .env files

2. **Supply Chain Security**
   - ❌ NEVER use npm (vulnerable to supply chain attacks)
   - ✅ ALWAYS use pnpm v10+ with postinstall scripts disabled
   - ✅ ALWAYS use `minimum-release-age=4320` (3 days)
   - ✅ ALWAYS audit with `pnpm audit` before installing

3. **Input Validation**
   - ✅ ALWAYS validate with Zod schemas
   - ✅ ALWAYS sanitize user inputs
   - ✅ ALWAYS limit input sizes (e.g., 2000 chars for messages)
   - ❌ NEVER trust user input

4. **Authentication**
   - ✅ ALWAYS hash passwords with bcrypt (cost 12+)
   - ✅ ALWAYS use strong SESSION_SECRET (32+ characters)
   - ✅ ALWAYS validate sessions on protected routes
   - ✅ ALWAYS use HttpOnly, Secure, SameSite cookies
   - ❌ NEVER store passwords in plaintext
   - ✅ ALWAYS use session-based auth (express-session + connect-redis)

5. **Jailbreak Prevention**
   - ✅ ALWAYS hardcode system prompts server-side
   - ✅ ALWAYS detect jailbreak attempts
   - ✅ ALWAYS separate user content from instructions
   - ❌ NEVER allow users to modify system prompts

---

## Code Patterns

### TypeScript Strict Mode

```typescript
// ✅ CORRECT - Explicit return types
export function calculateCost(tokens: number): number {
  return (tokens / 1000) * 0.003;
}

// ❌ WRONG - Implicit any
export function calculateCost(tokens) {
  return (tokens / 1000) * 0.003;
}

// ✅ CORRECT - Proper error handling
export async function createUser(
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  // Implementation
}

// ❌ WRONG - No return type
export async function createUser(email, password) {
  // Implementation
}
```

### Environment Variables

```typescript
// ✅ CORRECT - Validate required env vars at startup
import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'ANTHROPIC_API_KEY',
  'SESSION_SECRET',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// ❌ WRONG - No validation, app crashes later
const apiKey = process.env.ANTHROPIC_API_KEY;
```

### Error Handling

```typescript
// ✅ CORRECT - Secure error responses
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// ❌ WRONG - Leaks stack traces in production
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message,
    stack: err.stack, // SECURITY ISSUE!
  });
});
```

### Input Validation with Zod

```typescript
// ✅ CORRECT - Comprehensive validation
import { z } from 'zod';

const chatMessageSchema = z.object({
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message too long')
    .trim(),
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = chatMessageSchema.parse(req.body);
    // Process message
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    throw error;
  }
});

// ❌ WRONG - No validation
app.post('/api/chat', async (req, res) => {
  const { message } = req.body; // Dangerous!
  // Process message
});
```

---

## Common Pitfalls

### 1. API Key Exposure
**Pitfall:** Accidentally importing Anthropic SDK in frontend
**Detection:** `grep -r "@anthropic-ai/sdk" frontend/`
**Fix:** Only import in backend, use backend proxy for all AI calls

### 2. Using npm Instead of pnpm
**Pitfall:** Running `npm install` out of habit
**Detection:** Check for `package-lock.json` instead of `pnpm-lock.yaml`
**Fix:** Delete `package-lock.json` and `node_modules`, run `pnpm install`

### 3. Weak Session Secrets
**Pitfall:** Using short or predictable session secrets
**Detection:** Check `SESSION_SECRET` length: `echo $SESSION_SECRET | wc -c`
**Fix:** Generate with `openssl rand -hex 32`

### 4. Missing Rate Limits
**Pitfall:** Forgetting to apply rate limit middleware
**Detection:** Test with: `for i in {1..20}; do curl http://localhost:3000/api/chat; done`
**Fix:** Ensure middleware applied: `app.use('/api/chat', rateLimitMiddleware, chatHandler)`

### 5. SQL Injection
**Pitfall:** String concatenation in SQL queries
**Detection:** Search for string concatenation in queries
**Fix:** Use parameterized queries: `db.query('SELECT * FROM users WHERE email = $1', [email])`

---

## Phase-Specific Context

### Phase 1.0 (Foundation)
**Focus:** Project structure, Docker, TypeScript setup
**Key Files:** `backend/src/index.ts`, `docker-compose.yml`, `tsconfig.json`
**Verification:** Docker containers healthy, server responds to `/health`

### Phase 1.1 (Database)
**Focus:** PostgreSQL schema, migrations, models
**Key Files:** `backend/src/models/`, `backend/migrations/`
**Verification:** Can create users, query users, indexes exist

### Phase 1.2 (Authentication)
**Focus:** Session-based auth, bcrypt, registration/login
**Key Files:** `backend/src/services/auth.ts`, `backend/src/middleware/auth.ts`
**Verification:** Registration works, login creates session, protected routes enforce auth

### Phase 1.3 (Rate Limiting)
**Focus:** Redis rate limiting, budget tracking
**Key Files:** `backend/src/middleware/rateLimit.ts`, `backend/src/services/cost.ts`
**Verification:** Rate limits trigger, budget caps enforced

### Phase 1.4 (Claude SDK)
**Focus:** Anthropic SDK, system prompts, jailbreak detection
**Key Files:** `backend/src/services/claude.ts`, `backend/src/utils/jailbreak.ts`
**Verification:** Chat works, jailbreak attempts blocked

---

## Verification Commands

### Docker Services
```bash
# Check services are healthy
docker-compose ps | grep healthy

# Check PostgreSQL connection
psql $DATABASE_URL -c "SELECT 1;"

# Check Redis connection
redis-cli ping
```

### TypeScript
```bash
# Type check
pnpm run type-check

# Build
pnpm run build
```

### Server
```bash
# Start dev server
pnpm run dev

# Test health endpoint
curl http://localhost:3000/health
```

### Database
```bash
# List tables
psql $DATABASE_URL -c "\dt"

# Check migrations
psql $DATABASE_URL -c "SELECT * FROM migrations;"
```

### Security
```bash
# Check for API keys in frontend
grep -r "ANTHROPIC_API_KEY" frontend/

# Check .env is gitignored
git check-ignore .env backend/.env

# Security audit
pnpm audit
```

---

## Quick Reference

**Package Manager:** pnpm v10+ (NOT npm)
**TypeScript:** Strict mode always
**Node Version:** 20+
**Database:** PostgreSQL 15
**Cache:** Redis 7
**AI Model:** Claude 4.5 Sonnet (claude-3-5-sonnet-20241022)

**Default Ports:**
- Backend: 3000
- Frontend: 3001
- PostgreSQL: 5432
- Redis: 6379

**Critical Docs:**
- NPM Security: `docs/reference/NPM_SECURITY.md`
- Security Architecture: `docs/reference/SECURITY_ARCHITECTURE.md`
- Agent SDK Security: `docs/reference/AGENT_SDK_SECURITY.md`

---

This skill provides essential context for MTG Agent development. Reference it whenever you need to understand project patterns, security requirements, or verification procedures.
