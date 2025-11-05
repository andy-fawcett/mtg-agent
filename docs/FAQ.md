# Frequently Asked Questions (FAQ)

Common issues and solutions for MTG Agent development.

---

## 🚀 Getting Started

### Q: Should I use npm or pnpm?

**A:** **ALWAYS use pnpm v10+** (NOT npm).

npm has known security vulnerabilities with postinstall scripts. pnpm v10+ disables these by default and supports `minimum-release-age` to prevent supply chain attacks.

```bash
# Install pnpm
npm install -g pnpm@latest

# Verify version
pnpm --version  # Should be 10.0+

# Use pnpm for all operations
pnpm install
pnpm add express
pnpm run dev
```

See [NPM Security Guide](reference/NPM_SECURITY.md) for details.

---

### Q: What if I accidentally used `npm install`?

**A:** Clean up and use pnpm:

```bash
# Remove npm artifacts
rm -rf node_modules package-lock.json

# Install with pnpm
cd backend
pnpm install

# Verify pnpm lockfile exists
ls pnpm-lock.yaml
```

---

### Q: Where do I start?

**A:** Use the `/start` command for context-aware development:

```bash
# With Claude Code
/start

# Or manually
1. Read docs/reference/NPM_SECURITY.md (CRITICAL)
2. Read docs/reference/SECURITY_ARCHITECTURE.md
3. Follow docs/implementation/PHASE_1_MVP/PHASE_1.0_FOUNDATION.md
```

---

## 🐳 Docker Issues

### Q: Port 5432 (PostgreSQL) already in use

**Symptom:**
```
Error: port is already allocated
```

**Solution:**
```bash
# Find what's using port 5432
lsof -i :5432

# Option 1: Stop local PostgreSQL
brew services stop postgresql@15  # macOS
sudo systemctl stop postgresql    # Linux

# Option 2: Change port in docker-compose.yml
ports:
  - "5433:5432"  # Use different host port
```

---

### Q: Docker containers won't start

**Symptoms:**
- `docker-compose ps` shows "Exit 1"
- Services keep restarting

**Solutions:**

```bash
# Check logs
docker-compose logs postgres
docker-compose logs redis

# Clean start
docker-compose down -v  # Warning: deletes data!
docker-compose up -d

# Check health
docker-compose ps
```

Common issues:
- Insufficient disk space
- Port conflicts
- Corrupted volumes

---

### Q: Can't connect to database from backend

**Symptom:**
```
Error: ECONNREFUSED 127.0.0.1:5432
```

**Solution:**

When running backend in Docker, use service name not localhost:

```typescript
// ❌ WRONG (when backend in Docker)
const db = new Pool({ host: 'localhost' });

// ✅ CORRECT (use Docker service name)
const db = new Pool({ host: 'postgres' });

// ✅ BEST (environment variable)
const db = new Pool({
  host: process.env.DATABASE_HOST || 'localhost'
});
```

---

## 🔧 TypeScript Issues

### Q: TypeScript compilation errors after `pnpm install`

**Symptom:**
```
error TS2304: Cannot find name 'RequestHandler'
```

**Solution:**

```bash
# Clear and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Verify TypeScript version
pnpm list typescript

# Check for duplicate @types
pnpm list | grep @types/node
```

---

### Q: VS Code shows TypeScript errors but `pnpm run type-check` passes

**Solution:**

```bash
# Use workspace TypeScript version
# In VS Code: Cmd/Ctrl + Shift + P
# Search: "TypeScript: Select TypeScript Version"
# Choose: "Use Workspace Version"

# Or restart TS server
# Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
```

---

### Q: How to fix "'any' type" errors?

**Wrong:**
```typescript
function getData(params) {  // Implicit 'any'
  return params.id;
}
```

**Right:**
```typescript
function getData(params: { id: string }): string {
  return params.id;
}
```

**For unknown types:**
```typescript
function processData(data: unknown): ProcessedData {
  // Type narrowing
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid data');
  }

  // Now TypeScript knows data is an object
  if ('id' in data && typeof data.id === 'string') {
    return { id: data.id };
  }

  throw new Error('Missing id');
}
```

---

## 🔐 Security Issues

### Q: How do I check if API keys are exposed?

**Solution:**

```bash
# Search for API keys in frontend
grep -r "ANTHROPIC_API_KEY" frontend/
grep -r "sk-ant-" frontend/ --exclude-dir=node_modules

# Should return nothing!

# Check .env is gitignored
git check-ignore .env backend/.env

# Check git history
git log --all -S "sk-ant-" --oneline
```

---

### Q: Rate limits not working

**Symptoms:**
- Can send unlimited requests
- No 429 errors

**Solutions:**

```bash
# 1. Check Redis is running
docker-compose ps redis
redis-cli ping  # Should return PONG

# 2. Verify middleware order
# In Express, middleware order matters!
```

```typescript
// ✅ CORRECT - Rate limit BEFORE handler
app.use('/api/chat', rateLimitMiddleware, chatHandler);

// ❌ WRONG - Rate limit AFTER handler
app.use('/api/chat', chatHandler, rateLimitMiddleware);
```

```bash
# 3. Test rate limit
for i in {1..15}; do
  curl http://localhost:3000/api/chat
done
# Should see 429 after limit hit
```

---

### Q: Passwords not hashing correctly

**Wrong:**
```typescript
// ❌ Cost factor too low (insecure)
const hash = await bcrypt.hash(password, 8);

// ❌ Not awaiting (returns promise!)
const hash = bcrypt.hash(password, 12);
```

**Right:**
```typescript
// ✅ Cost factor 12, properly awaited
const hash = await bcrypt.hash(password, 12);

// Verify
const isValid = await bcrypt.compare(password, hash);
```

---

## 🧪 Testing Issues

### Q: Tests failing with "Cannot find module"

**Solution:**

```bash
# Install dev dependencies
pnpm add -D @types/jest @types/node ts-jest

# Create/update jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
};
```

---

### Q: Database tests interfering with each other

**Solution:**

```typescript
// Use transactions and rollback
describe('User Service', () => {
  let db: Database;

  beforeEach(async () => {
    await db.query('BEGIN');
  });

  afterEach(async () => {
    await db.query('ROLLBACK');
  });

  it('should create user', async () => {
    // Test creates user
    // Automatically rolled back after test
  });
});
```

Or use a separate test database:
```bash
# .env.test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mtg_agent_test
```

---

## 📦 Dependency Issues

### Q: `pnpm audit` shows vulnerabilities

**Solution:**

```bash
# Check severity
pnpm audit

# Update dependencies
pnpm update

# If vulnerability in dev dependency (lower priority)
pnpm audit --prod

# For critical issues, update specific package
pnpm update <package-name>
```

---

### Q: "minimum-release-age" blocks a package I need

**Symptom:**
```
ERR_PNPM_PACKAGE_TOO_YOUNG
```

**Solution:**

```bash
# Temporary override for urgent installs
pnpm install --config.minimum-release-age=0 package-name

# Or reduce age temporarily in .npmrc
# Edit .npmrc: minimum-release-age=1440  # 1 day
```

**Security Note:** Only do this for trusted packages or critical security patches.

---

## ⚡ Performance Issues

### Q: Server startup is slow

**Check:**

```bash
# 1. TypeScript compilation
time pnpm run build

# 2. Database connection
time psql $DATABASE_URL -c "SELECT 1"

# 3. Redis connection
time redis-cli ping

# 4. Docker resource limits
docker stats
```

**Solutions:**
- Use `tsx` for faster development (no compilation)
- Ensure Docker has enough resources (Settings → Resources)
- Check for network issues with database

---

### Q: Chat responses are slow (>5s)

**Possible causes:**

1. **Network latency to Anthropic API**
   ```typescript
   // Add timeout
   const client = new Anthropic({
     apiKey: process.env.ANTHROPIC_API_KEY,
     timeout: 30000,  // 30s timeout
   });
   ```

2. **Large context windows**
   ```typescript
   // Limit context
   const response = await client.messages.create({
     max_tokens: 1000,  // Lower = faster
     // ...
   });
   ```

3. **Database queries in critical path**
   ```typescript
   // Use Redis caching
   const cached = await redis.get(`user:${userId}`);
   if (cached) return JSON.parse(cached);
   ```

---

## 🔄 Git Issues

### Q: Accidentally committed .env file

**Solution:**

```bash
# Remove from current commit
git rm --cached .env backend/.env

# Add to .gitignore if not already
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Remove .env from version control"

# Remove from history (WARNING: rewrites history!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env backend/.env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (only if repository is private and you're alone!)
git push origin --force --all
```

**Better:** Rotate all secrets in that .env file immediately!

---

### Q: Merge conflicts in pnpm-lock.yaml

**Solution:**

```bash
# Accept one version
git checkout --ours pnpm-lock.yaml   # Keep yours
# OR
git checkout --theirs pnpm-lock.yaml # Keep theirs

# Then regenerate lockfile
pnpm install

# Add and continue merge
git add pnpm-lock.yaml
git merge --continue
```

---

## 🌐 Frontend Issues

### Q: CORS errors when calling backend

**Symptom:**
```
Access to fetch at 'http://localhost:3000' from origin 'http://localhost:3001' has been blocked by CORS policy
```

**Solution:**

```typescript
// backend/src/index.ts
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
}));

// .env
FRONTEND_URL=http://localhost:3001
```

---

### Q: API calls work in dev but fail in production

**Check:**

1. **Environment variables**
   ```bash
   # Ensure production .env has correct values
   FRONTEND_URL=https://your-domain.com
   ```

2. **HTTPS vs HTTP**
   ```typescript
   // Use relative URLs in production
   const url = process.env.NODE_ENV === 'production'
     ? '/api/chat'  // Relative
     : 'http://localhost:3000/api/chat';  // Absolute for dev
   ```

---

## 💰 Cost Issues

### Q: Claude API costs too high

**Solutions:**

1. **Lower max_tokens**
   ```typescript
   const response = await client.messages.create({
     max_tokens: 1000,  // Was 4000
     // ...
   });
   ```

2. **Implement caching**
   ```typescript
   // Cache common responses
   const cacheKey = `chat:${messageHash}`;
   const cached = await redis.get(cacheKey);
   if (cached) return JSON.parse(cached);
   ```

3. **Tighter rate limits**
   ```typescript
   // Reduce limits
   const RATE_LIMITS = {
     anonymous: 3,    // per day
     free: 20,        // Was 50
     premium: 200,    // Was 500
   };
   ```

4. **Budget caps**
   ```bash
   # Lower daily budget in .env
   DAILY_BUDGET_CENTS=50  # $0.50/day
   ```

---

## 📊 Monitoring Issues

### Q: How do I track API costs in real-time?

**Solution:**

```typescript
// Estimate cost before calling API
function estimateCost(prompt: string, maxTokens: number): number {
  const inputTokens = prompt.length / 4;  // Rough estimate
  const inputCost = (inputTokens / 1000) * 0.003;
  const outputCost = (maxTokens / 1000) * 0.015;

  return inputCost + outputCost;
}

// Track in database
await db.costs.create({
  userId,
  estimatedCost: estimateCost(message, 1000),
  timestamp: new Date(),
});

// Alert on threshold
const todayCost = await getTodayCost();
if (todayCost > DAILY_BUDGET * 0.9) {
  sendAlert('90% of daily budget used');
}
```

---

## 🆘 Still Need Help?

1. **Check the docs:**
   - [Documentation Hub](README.md)
   - [Security Architecture](reference/SECURITY_ARCHITECTURE.md)
   - [Development Best Practices](reference/DEVELOPMENT_BEST_PRACTICES.md)

2. **Search existing issues:**
   - GitHub issues (if repository is public)
   - Stack Overflow

3. **Ask for help:**
   - Create a detailed issue report
   - Include error messages, logs, and what you've tried

---

**Last Updated:** 2025-01-04
