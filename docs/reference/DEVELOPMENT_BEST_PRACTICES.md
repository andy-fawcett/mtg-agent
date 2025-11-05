# Development Best Practices & Expectations

This document outlines the development workflow, coding standards, and expectations for the MTG Agent project.

---

## 🎯 Development Philosophy

**Security First:** Every decision prioritizes security over convenience
**Type Safety:** TypeScript strict mode catches bugs before runtime
**Test Coverage:** 70%+ coverage ensures reliability
**Documentation:** Code explains "why" not "what"
**Incremental Progress:** Small, verified steps build confidence

---

## 🚀 Development Workflow

### Daily Workflow

1. **Start Your Session**
   ```bash
   # With Claude Code
   /start

   # Or check status
   /status
   ```

2. **Review Current Task**
   - Read the specific phase documentation
   - Understand success criteria
   - Note security requirements

3. **Implement**
   - Write code following standards below
   - Add inline comments explaining decisions
   - Write tests as you go

4. **Verify**
   - Run verification commands from phase doc
   - Check all success criteria
   - Test edge cases

5. **Document Progress**
   - Update checkboxes in phase docs
   - Update STATUS.md
   - Commit with descriptive message

6. **Move Forward**
   - Mark todo as complete
   - Move to next task
   - Update overall progress

### Task Completion Checklist

Before marking a task complete:
- [ ] Code compiles without errors (`pnpm run type-check`)
- [ ] Tests pass (`pnpm test`)
- [ ] Verification commands succeed
- [ ] Security requirements met
- [ ] Documentation updated
- [ ] Changes committed

---

## 📝 Coding Standards

### TypeScript Standards

**Strict Mode Always:**
```typescript
// ✅ CORRECT - Explicit types
export function calculateCost(tokens: number): number {
  return (tokens / 1000) * 0.003;
}

export interface User {
  id: string;
  email: string;
  tier: 'anonymous' | 'free' | 'premium';
}

// ❌ WRONG - Implicit any
export function calculateCost(tokens) {
  return (tokens / 1000) * 0.003;
}
```

**No `any` Types:**
```typescript
// ✅ CORRECT - Proper typing
export function processData(data: unknown): ProcessedData {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid data');
  }
  // Type narrowing...
  return processedData;
}

// ❌ WRONG - Using any
export function processData(data: any) {
  return data.something;  // No type safety!
}
```

**Return Types Required:**
```typescript
// ✅ CORRECT
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

### Naming Conventions

- **Variables/Functions:** camelCase (`getUserById`, `isAuthenticated`)
- **Classes/Interfaces:** PascalCase (`User`, `AuthService`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_TOKEN_LIMIT`, `DEFAULT_TIER`)
- **Files:** kebab-case (`auth-service.ts`, `rate-limit.ts`)
- **Database Tables:** snake_case (`user_sessions`, `chat_logs`)

### Code Organization

```typescript
// File structure for services
import { dependencies } from 'external';
import { internalModules } from '@/internal';

// Types and interfaces
interface ServiceConfig {
  // ...
}

// Constants
const DEFAULT_TIMEOUT = 5000;

// Main class or functions
export class AuthService {
  // Private properties first
  private config: ServiceConfig;

  // Constructor
  constructor(config: ServiceConfig) {
    this.config = config;
  }

  // Public methods
  public async authenticate(credentials: Credentials): Promise<AuthResult> {
    // Implementation
  }

  // Private methods
  private validateCredentials(credentials: Credentials): boolean {
    // Implementation
  }
}

// Helper functions at bottom
function helperFunction() {
  // Implementation
}
```

### Comments and Documentation

```typescript
// ✅ CORRECT - Explain WHY
// Use bcrypt with cost factor 12 to balance security and performance.
// Lower values are too fast for modern GPUs, higher values impact UX.
const hashedPassword = await bcrypt.hash(password, 12);

// Return early to prevent timing attacks that could reveal
// whether an email exists in our system
if (!user) {
  await simulateDelay(100);  // Constant time response
  throw new AuthError('Invalid credentials');
}

// ❌ WRONG - Explain WHAT (code is self-documenting)
// Hash the password
const hashedPassword = await bcrypt.hash(password, 12);

// Return if no user
if (!user) {
  throw new AuthError('Invalid credentials');
}
```

---

## 🔒 Security Requirements

### Critical Rules (NEVER VIOLATE)

1. **API Keys:**
   ```typescript
   // ✅ CORRECT - Backend only
   // backend/src/services/claude.ts
   import Anthropic from '@anthropic-ai/sdk';
   const client = new Anthropic({
     apiKey: process.env.ANTHROPIC_API_KEY
   });

   // ❌ WRONG - Frontend exposure
   // frontend/src/services/claude.ts
   import Anthropic from '@anthropic-ai/sdk';  // NEVER DO THIS!
   ```

2. **Package Manager:**
   ```bash
   # ✅ CORRECT
   pnpm install express

   # ❌ WRONG
   npm install express  # Security risk!
   ```

3. **Password Handling:**
   ```typescript
   // ✅ CORRECT
   const hashedPassword = await bcrypt.hash(password, 12);
   await db.users.create({ email, passwordHash: hashedPassword });

   // ❌ WRONG
   await db.users.create({ email, password });  // Plaintext!
   ```

4. **Input Validation:**
   ```typescript
   // ✅ CORRECT - Validate with Zod
   const schema = z.object({
     message: z.string().min(1).max(2000).trim(),
   });

   const { message } = schema.parse(req.body);

   // ❌ WRONG - No validation
   const { message } = req.body;
   ```

5. **SQL Queries:**
   ```typescript
   // ✅ CORRECT - Parameterized
   const user = await db.query(
     'SELECT * FROM users WHERE email = $1',
     [email]
   );

   // ❌ WRONG - SQL injection risk
   const user = await db.query(
     `SELECT * FROM users WHERE email = '${email}'`
   );
   ```

### Security Checklist

Before committing code:
- [ ] No API keys in client code
- [ ] No hardcoded secrets
- [ ] All inputs validated
- [ ] All outputs sanitized
- [ ] SQL queries parameterized
- [ ] Passwords hashed with bcrypt
- [ ] Error messages don't leak info
- [ ] Rate limiting applied
- [ ] CORS properly configured

---

## 🧪 Testing Standards

### Test Coverage Target: 70%+

**What to Test:**
- ✅ Authentication logic (JWT generation, verification)
- ✅ Password hashing and validation
- ✅ Rate limiting calculations
- ✅ Cost estimation functions
- ✅ Input validation schemas
- ✅ API endpoints (happy path + errors)
- ✅ Database operations
- ❌ Simple getters/setters
- ❌ Third-party library code

### Test Structure

```typescript
describe('AuthService', () => {
  describe('hashPassword', () => {
    it('should hash passwords with bcrypt', async () => {
      const password = 'SecurePass123!';
      const hash = await authService.hashPassword(password);

      expect(hash).not.toBe(password);
      expect(await bcrypt.compare(password, hash)).toBe(true);
    });

    it('should use cost factor 12', async () => {
      const hash = await authService.hashPassword('test');
      const rounds = await bcrypt.getRounds(hash);

      expect(rounds).toBe(12);
    });
  });

  describe('generateJWT', () => {
    it('should generate valid JWTs', () => {
      const token = authService.generateJWT({
        userId: '123',
        tier: 'free'
      });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe('123');
    });

    it('should expire in 7 days', () => {
      const token = authService.generateJWT({ userId: '123' });
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBe(7 * 24 * 60 * 60);  // 7 days
    });
  });
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm run test:coverage

# Run specific file
pnpm test auth-service.test.ts

# Watch mode
pnpm test --watch
```

---

## 🔍 Code Review Standards

### Before Submitting for Review

1. **Self-Review:**
   - Read your own diff carefully
   - Check for console.log statements
   - Verify no TODOs left
   - Ensure consistent formatting

2. **Run Checks:**
   ```bash
   pnpm run type-check  # TypeScript errors?
   pnpm run lint        # Linting issues?
   pnpm test            # Tests passing?
   pnpm audit           # Security vulnerabilities?
   ```

3. **Security Scan:**
   ```bash
   # Check for API keys
   grep -r "sk-ant-" . --exclude-dir=node_modules

   # Check .env not committed
   git status | grep .env
   ```

### What Reviewers Look For

- ✅ Code follows TypeScript strict mode
- ✅ Security requirements met
- ✅ Tests included and passing
- ✅ Documentation updated
- ✅ No hardcoded values
- ✅ Error handling comprehensive
- ✅ Performance considerations
- ✅ Commit messages descriptive

---

## 📊 Performance Guidelines

### Database Queries

```typescript
// ✅ CORRECT - Use indexes
CREATE INDEX idx_users_email ON users(email);

// ✅ CORRECT - Limit results
const users = await db.users.findMany({ take: 100 });

// ❌ WRONG - No limit
const users = await db.users.findMany();  // Could return millions!
```

### API Responses

```typescript
// ✅ CORRECT - Paginated
app.get('/api/users', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  const users = await db.users.paginate(page, limit);
  res.json(users);
});

// ❌ WRONG - No pagination
app.get('/api/users', async (req, res) => {
  const users = await db.users.findAll();
  res.json(users);
});
```

### Caching Strategy

```typescript
// ✅ CORRECT - Cache expensive operations
const cachedResult = await redis.get(cacheKey);
if (cachedResult) {
  return JSON.parse(cachedResult);
}

const result = await expensiveOperation();
await redis.setex(cacheKey, 3600, JSON.stringify(result));
return result;
```

---

## 🛠️ Development Tools

### Required Tools

- **Node.js:** 20+ LTS
- **pnpm:** 10+ (NOT npm)
- **Docker:** Latest stable
- **Git:** Latest stable
- **VS Code:** Recommended IDE

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-azuretools.vscode-docker",
    "PKief.material-icon-theme"
  ]
}
```

### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

---

## 📦 Dependency Management

### Using pnpm (REQUIRED)

```bash
# Install dependencies
pnpm install

# Add new dependency
pnpm add express

# Add dev dependency
pnpm add -D @types/express

# Update dependencies
pnpm update

# Security audit
pnpm audit

# Check for outdated packages
pnpm outdated
```

### When to Add Dependencies

**✅ Add When:**
- Well-maintained (recent updates)
- Popular (many downloads)
- Security-vetted (no known vulnerabilities)
- TypeScript types available
- Solves a complex problem better than custom code

**❌ Avoid When:**
- Simple functionality (e.g., don't add lodash for one function)
- Unmaintained (last update > 1 year ago)
- Security issues
- Large bundle size for small utility
- Custom solution is straightforward

---

## 🚨 Common Pitfalls

### 1. Using npm Instead of pnpm
**Why:** Security vulnerabilities (postinstall scripts)
**Fix:** Always use pnpm, add preinstall script to enforce

### 2. Forgetting to Validate Inputs
**Why:** XSS, SQL injection, DoS attacks
**Fix:** Use Zod schemas for all user input

### 3. Exposing API Keys
**Why:** Unlimited API costs, security breach
**Fix:** Keep all keys backend-only, never import Anthropic SDK in frontend

### 4. Weak Error Messages
**Why:** Either too revealing (security issue) or too vague (bad UX)
**Fix:** Generic in production, detailed in development

### 5. Not Testing Edge Cases
**Why:** Production bugs
**Fix:** Test null, undefined, empty strings, max values, etc.

---

## 📚 Additional Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Anthropic API Docs](https://docs.anthropic.com/)

---

## 💡 Tips for Success

1. **Read phase docs before coding** - Understand the full context
2. **Small commits, frequent pushes** - Makes review easier
3. **Test as you go** - Don't wait until the end
4. **Ask questions early** - Better than assumptions
5. **Use `/start` command** - Let Claude load context for you
6. **Security first, always** - No shortcuts on security

---

**Remember:** Quality over speed. It's better to do it right than do it fast.
