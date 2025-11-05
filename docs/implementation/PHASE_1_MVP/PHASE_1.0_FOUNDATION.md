# Phase 1.0: Foundation & Project Setup

**Status:** ⏸️ Not Started
**Duration Estimate:** 4-6 hours
**Prerequisites:** Node.js 20+, Docker, Git installed
**Dependencies:** None (First sub-phase)

## Objectives

Set up the complete development environment with TypeScript, Docker Compose, and basic server infrastructure. Create a solid foundation that all subsequent phases will build upon.

- Create organized backend project structure
- Configure TypeScript with strict mode
- Set up Docker Compose for PostgreSQL and Redis
- Create environment variable templates
- Build basic Express server with health endpoint
- Verify hot-reload development works

## Technology Decisions

- **Node.js 20+:** LTS version with modern features
- **TypeScript 5.x:** Strict mode for type safety
- **Express.js:** Battle-tested, simple, well-documented
- **tsx:** Fast TypeScript execution with hot reload
- **Docker Compose:** Consistent dev environment across machines

---

## Task 1.0.1: Backend Project Structure

**Estimated Time:** 15 minutes

### Objectives

Create a well-organized directory structure that supports scalability and follows Node.js best practices.

### Steps

```bash
# Create main project directories
mkdir -p backend/src/{config,middleware,routes,services,models,utils,types}
mkdir -p backend/tests/{unit,integration,fixtures}

# Navigate to backend
cd backend

# Initialize package.json
npm init -y
```

### Expected Directory Structure

```
backend/
├── src/
│   ├── config/          # Configuration (database, redis, anthropic)
│   ├── middleware/      # Express middleware (auth, rate-limit, validation)
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic (auth, chat, cost tracking)
│   ├── models/          # Database models and types
│   ├── utils/           # Utility functions (logger, sanitize, validators)
│   ├── types/           # TypeScript type definitions
│   └── index.ts         # Entry point
├── tests/
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── fixtures/        # Test data and mocks
├── package.json
├── tsconfig.json        # TypeScript configuration
├── .env                 # Environment variables (gitignored)
├── .env.example         # Environment variable template
└── .gitignore
```

### Verification

```bash
# Check structure created correctly
tree backend -L 3 -I node_modules

# Should show all directories
ls -la backend/src
ls -la backend/tests
```

### Success Criteria

- [ ] All directories created
- [ ] package.json exists
- [ ] No errors during creation
- [ ] Structure matches expected layout

---

## Task 1.0.2: Install Dependencies

**Estimated Time:** 15 minutes

**🔒 SECURITY NOTE:** We use **pnpm** instead of npm for enhanced security. pnpm v10+ disables postinstall scripts by default and supports `minimumReleaseAge` to prevent supply chain attacks. See [NPM Security Guide](../../reference/NPM_SECURITY.md) for details.

### Objectives

Install all required packages for backend development using pnpm with security-first configuration.

### Steps

**1. Install pnpm globally (if not already installed):**

```bash
# Install pnpm
npm install -g pnpm@latest

# Verify installation
pnpm --version  # Should be 10.0+
```

**2. Configure pnpm security settings:**

```bash
cd backend

# Create secure pnpm configuration
cat > .npmrc <<EOF
# Supply chain attack protection: wait 3 days before installing new packages
minimum-release-age=4320

# Security auditing
audit=true
audit-level=moderate

# Postinstall scripts disabled by default in pnpm v10+
# Only allow trusted packages that need to compile native modules
trustedDependencies[]=bcrypt

# Use exact versions in lockfile
save-exact=false
EOF
```

**3. Install production dependencies:**

```bash
# Core web framework
pnpm install express cors helmet dotenv

# Anthropic Claude SDK
pnpm install @anthropic-ai/sdk

# Databases and caching
pnpm install pg ioredis

# Authentication and security
pnpm install bcrypt jsonwebtoken

# Validation and rate limiting
pnpm install zod rate-limiter-flexible
```

**4. Install TypeScript and type definitions:**

```bash
# TypeScript tooling
pnpm install typescript tsx @types/node

# Type definitions for dependencies
pnpm install @types/express @types/cors
pnpm install @types/bcrypt @types/jsonwebtoken
```

**5. Install development dependencies:**

```bash
pnpm install -D nodemon @types/pg
```

### Package Purpose

| Package | Purpose |
|---------|---------|
| express | Web framework |
| cors | CORS middleware |
| helmet | Security headers |
| dotenv | Environment variables |
| @anthropic-ai/sdk | Claude API |
| pg | PostgreSQL client |
| ioredis | Redis client |
| bcrypt | Password hashing |
| jsonwebtoken | JWT auth |
| zod | Schema validation |
| express-rate-limit | Simple rate limiting |
| rate-limiter-flexible | Advanced rate limiting with Redis |
| typescript | TypeScript compiler |
| tsx | TypeScript execution |

### Verification

```bash
# Check all packages installed
pnpm list --depth=0

# Verify no critical vulnerabilities
pnpm audit

# Check package.json has all dependencies
cat package.json | grep -A 20 '"dependencies"'

# Verify pnpm lockfile created
ls -la pnpm-lock.yaml

# Check for compromised versions (from September 2025 attack)
pnpm list | grep -E "(debug@4\.4\.2|chalk@5\.6\.1|ansi-styles@6\.2\.2)"
# Should return no results

# Generate SBOM for supply chain tracking
pnpm licenses list > licenses.txt
```

### Success Criteria

- [ ] pnpm version 10.0 or higher installed
- [ ] All packages installed without errors
- [ ] pnpm-lock.yaml created and committed
- [ ] .npmrc configuration file created with security settings
- [ ] No critical vulnerabilities in pnpm audit
- [ ] No compromised package versions detected
- [ ] Dependencies listed in package.json
- [ ] bcrypt added to trustedDependencies (only trusted package)

### Common Issues

**Issue:** `pnpm install` fails with EACCES error

**Solution:**
```bash
# Fix pnpm permissions (macOS/Linux)
sudo chown -R $(whoami) ~/.pnpm-store
sudo chown -R $(whoami) ~/.local/share/pnpm

# Or reinstall pnpm using npm
npm install -g pnpm@latest
```

**Issue:** Package needs postinstall script but pnpm blocks it

**Solution:**
```bash
# Add package to trustedDependencies in .npmrc
echo 'trustedDependencies[]=package-name' >> .npmrc

# Then reinstall
pnpm install
```

**Issue:** "minimum-release-age" blocks a package you need urgently

**Solution:**
```bash
# Temporarily reduce release age for specific install
pnpm install --config.minimum-release-age=0 package-name

# Or disable for critical security patches
# Edit .npmrc and reduce minimum-release-age temporarily
```

**Issue:** Want to use npm instead of pnpm

**Solution:**
```bash
# Not recommended, but if necessary:
npm install --ignore-scripts

# Must add --ignore-scripts to every install command for security
```

---

## Task 1.0.3: TypeScript Configuration

**Estimated Time:** 10 minutes

### Objectives

Configure TypeScript with strict mode and optimal settings for Node.js backend development.

### Steps

**Create `backend/tsconfig.json`:**

```json
{
  "compilerOptions": {
    /* Language and Environment */
    "target": "ES2022",
    "lib": ["ES2022"],

    /* Modules */
    "module": "commonjs",
    "moduleResolution": "node",
    "resolveJsonModule": true,

    /* Emit */
    "outDir": "./dist",
    "rootDir": "./src",
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,

    /* Interop Constraints */
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,

    /* Type Checking */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,

    /* Completeness */
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Update `backend/package.json` scripts:**

```json
{
  "name": "mtg-agent-backend",
  "version": "1.0.0",
  "description": "MTG Agent Backend API",
  "main": "dist/index.js",
  "packageManager": "pnpm@10.0.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=10.0.0"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "type-check": "tsc --noEmit",
    "test": "echo \"Tests coming in Phase 1.7\" && exit 0",
    "preinstall": "npx only-allow pnpm"
  },
  "keywords": ["mtg", "magic-the-gathering", "claude", "ai"],
  "author": "",
  "license": "MIT"
}
```

**Note:** The `preinstall` script prevents accidental use of npm/yarn. If someone runs `npm install`, they'll get an error message directing them to use pnpm.

### Verification

```bash
# Test TypeScript compilation (should fail - no source files yet)
npx tsc --noEmit

# Should output: error TS18003: No inputs were found in config file

# This is expected - we'll create source files next
```

### Success Criteria

- [ ] tsconfig.json created with strict mode
- [ ] package.json scripts updated
- [ ] TypeScript recognizes configuration
- [ ] No syntax errors in tsconfig.json

### TypeScript Strict Mode Explained

- `strict: true` - Enables all strict type checking
- `noUnusedLocals` - Error on unused variables
- `noUnusedParameters` - Error on unused function parameters
- `noImplicitReturns` - Functions must return or throw
- `noFallthroughCasesInSwitch` - Switch statements must have break/return
- `noUncheckedIndexedAccess` - Array access returns T | undefined

---

## Task 1.0.4: Docker Compose Setup

**Estimated Time:** 20 minutes

### Objectives

Create Docker Compose configuration for PostgreSQL and Redis with health checks and data persistence.

### Steps

**Create `docker-compose.yml` in project root:**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: mtg-agent-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: mtg_agent_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres_dev_password
      # Optimize for development
      POSTGRES_INITDB_ARGS: "--encoding=UTF8"
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d mtg_agent_dev"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - mtg-network

  redis:
    image: redis:7-alpine
    container_name: mtg-agent-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 5s
    networks:
      - mtg-network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  mtg-network:
    driver: bridge
```

**Create `.dockerignore` in project root:**

```
node_modules
npm-debug.log
pnpm-debug.log
.pnpm-store
.env
.git
.gitignore
README.md
dist
*.log
```

### Start Services

```bash
# Start Docker Compose in detached mode
docker-compose up -d

# Wait for services to be healthy (may take 30 seconds)
sleep 30

# Check status
docker-compose ps
```

### Verification

```bash
# Test 1: Check containers are running
docker-compose ps
# Expected: Both postgres and redis show "Up" status

# Test 2: Check health status
docker-compose ps --filter "health=healthy"
# Expected: Both services listed

# Test 3: Connect to PostgreSQL
psql postgresql://postgres:postgres_dev_password@localhost:5432/mtg_agent_dev -c "SELECT version();"
# Expected: PostgreSQL version info

# Test 4: Connect to Redis
redis-cli ping
# Expected: PONG

# Test 5: Verify data persistence
docker-compose down
docker-compose up -d
sleep 20
docker-compose ps
# Expected: Services restart with data intact
```

### Success Criteria

- [ ] Both containers start successfully
- [ ] Health checks pass (healthy status)
- [ ] Can connect to PostgreSQL
- [ ] Can connect to Redis
- [ ] Data persists after restart
- [ ] No error messages in logs

### Common Issues

**Issue:** Port 5432 already in use

**Solution:**
```bash
# Find what's using port 5432
lsof -i :5432

# Option 1: Stop local PostgreSQL
brew services stop postgresql@15  # macOS
sudo systemctl stop postgresql    # Linux

# Option 2: Change port in docker-compose.yml
ports:
  - "5433:5432"  # Use port 5433 on host
```

**Issue:** Docker Compose not found

**Solution:**
```bash
# Install Docker Desktop (includes Docker Compose)
# macOS: https://docs.docker.com/desktop/install/mac-install/
# Windows: https://docs.docker.com/desktop/install/windows-install/
# Linux: https://docs.docker.com/desktop/install/linux-install/
```

---

## Task 1.0.5: Environment Configuration

**Estimated Time:** 15 minutes

### Objectives

Create comprehensive environment variable configuration with secure defaults.

### Steps

**Create `backend/.env.example`:**

```bash
# ======================
# Server Configuration
# ======================
NODE_ENV=development
PORT=3000

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3001

# ======================
# Database Configuration
# ======================
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=mtg_agent_dev
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres_dev_password
DATABASE_URL=postgresql://postgres:postgres_dev_password@localhost:5432/mtg_agent_dev

# Connection Pool Settings
DATABASE_POOL_MAX=20
DATABASE_POOL_MIN=2

# ======================
# Redis Configuration
# ======================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# ======================
# Anthropic API
# ======================
# Get your key from: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-your-key-here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_MAX_TOKENS=2000

# ======================
# Security Configuration
# ======================
# Generate with: openssl rand -hex 32
JWT_SECRET=your-jwt-secret-here-generate-with-openssl
JWT_EXPIRES_IN=7d

# Bcrypt cost factor (10-12 recommended)
BCRYPT_ROUNDS=12

# ======================
# Rate Limiting
# ======================
# Per-IP limits
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10

# Anonymous user limits
RATE_LIMIT_ANONYMOUS_PER_DAY=3

# Free tier limits
RATE_LIMIT_FREE_PER_DAY=50
RATE_LIMIT_FREE_MAX_TOKENS=2000

# Premium tier limits
RATE_LIMIT_PREMIUM_PER_DAY=500
RATE_LIMIT_PREMIUM_MAX_TOKENS=4000

# ======================
# Cost Controls
# ======================
# Daily budget in cents ($1.00 = 100 cents)
DAILY_BUDGET_CENTS=100

# Alert thresholds (percentage of daily budget)
COST_ALERT_THRESHOLD_1=50
COST_ALERT_THRESHOLD_2=75
COST_ALERT_THRESHOLD_3=90

# ======================
# Feature Flags
# ======================
ENABLE_ANONYMOUS_ACCESS=true
ENABLE_REGISTRATION=true
ENABLE_CHAT=true

# ======================
# Logging
# ======================
LOG_LEVEL=debug
LOG_FORMAT=pretty

# ======================
# Development
# ======================
# Enable detailed error messages (disable in production)
SHOW_STACK_TRACES=true
```

**Create actual `.env` file:**

```bash
cd backend

# Copy example
cp .env.example .env

# Generate secure JWT secret
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env.generated

# Show generated secret
cat .env.generated
```

**Manual step:** Edit `backend/.env` and:
1. Add your Anthropic API key (from https://console.anthropic.com/)
2. Replace `JWT_SECRET` with the generated value
3. Adjust any ports if needed

### Verification

```bash
# Test 1: Verify .env is NOT in Git
git check-ignore backend/.env
# Expected: backend/.env

# Test 2: Load environment variables
cd backend
node -e "require('dotenv').config(); console.log('NODE_ENV:', process.env.NODE_ENV)"
# Expected: NODE_ENV: development

# Test 3: Verify all required variables present
node -e "
require('dotenv').config();
const required = ['NODE_ENV', 'PORT', 'DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'];
required.forEach(key => {
  if (!process.env[key]) console.error('Missing:', key);
  else console.log('✓', key);
});
"

# Test 4: Verify JWT secret is strong
node -e "
require('dotenv').config();
const secret = process.env.JWT_SECRET;
if (secret.length < 32) console.error('JWT_SECRET too short!');
else console.log('✓ JWT_SECRET length:', secret.length);
"
```

### Success Criteria

- [ ] .env.example created with all variables documented
- [ ] .env created (not committed to Git)
- [ ] JWT_SECRET generated (64+ characters)
- [ ] Anthropic API key added
- [ ] All required variables present
- [ ] Environment loads without errors

---

## Task 1.0.6: Basic Express Server

**Estimated Time:** 20 minutes

### Objectives

Create a minimal Express server with security middleware, health endpoint, and proper error handling.

### Steps

**Create `backend/src/index.ts`:**

```typescript
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ======================
// Security Middleware
// ======================
app.use(helmet());

// ======================
// CORS Configuration
// ======================
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ======================
// Body Parsing
// ======================
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ======================
// Request Logging
// ======================
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// ======================
// Health Check Endpoint
// ======================
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
  });
});

// ======================
// Root Endpoint
// ======================
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'MTG Agent API',
    version: '1.0.0',
    status: 'running',
    documentation: '/api/docs', // Future
  });
});

// ======================
// 404 Handler
// ======================
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
});

// ======================
// Error Handler
// ======================
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.SHOW_STACK_TRACES === 'true' ? err.message : 'Something went wrong',
    ...(process.env.SHOW_STACK_TRACES === 'true' && { stack: err.stack }),
  });
});

// ======================
// Start Server
// ======================
const server = app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 MTG Agent API Server');
  console.log('='.repeat(50));
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔒 CORS enabled for: ${process.env.FRONTEND_URL}`);
  console.log(`✅ Server ready for requests`);
  console.log('='.repeat(50));
});

// ======================
// Graceful Shutdown
// ======================
const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
```

### Start Development Server

```bash
cd backend
pnpm run dev
```

### Verification

```bash
# Test 1: Server starts without errors
pnpm run dev &
SERVER_PID=$!
sleep 3

# Test 2: Health endpoint
curl http://localhost:3000/health
# Expected: {"status":"healthy",...}

# Test 3: Root endpoint
curl http://localhost:3000/
# Expected: {"name":"MTG Agent API",...}

# Test 4: 404 handling
curl http://localhost:3000/nonexistent
# Expected: {"error":"Not Found",...}

# Test 5: CORS headers present
curl -I http://localhost:3000/health | grep -i "access-control"
# Expected: Access-Control-Allow-Origin header

# Test 6: Security headers (helmet)
curl -I http://localhost:3000/health | grep -i "x-"
# Expected: X-Content-Type-Options, X-Frame-Options headers

# Test 7: Hot reload works
# Edit src/index.ts (add a comment)
# Server should restart automatically

# Cleanup
kill $SERVER_PID
```

### Success Criteria

- [ ] Server starts on port 3000
- [ ] Health endpoint returns 200
- [ ] Root endpoint returns API info
- [ ] 404 handler works
- [ ] CORS headers present
- [ ] Security headers present (helmet)
- [ ] Hot reload works (tsx watch)
- [ ] Graceful shutdown works (Ctrl+C)
- [ ] No TypeScript errors
- [ ] Console output clean and informative

---

## Phase 1.0 Completion Checklist

### Structure
- [ ] All directories created correctly
- [ ] package.json configured with scripts
- [ ] tsconfig.json with strict mode
- [ ] .gitignore includes .env and node_modules

### Dependencies
- [ ] All npm packages installed
- [ ] No critical vulnerabilities
- [ ] TypeScript compiles without errors

### Docker
- [ ] PostgreSQL container running
- [ ] Redis container running
- [ ] Health checks passing
- [ ] Can connect to both databases
- [ ] Data persists after restart

### Environment
- [ ] .env.example created
- [ ] .env created (not in Git)
- [ ] JWT_SECRET generated (64+ chars)
- [ ] All required variables present
- [ ] Variables load correctly

### Server
- [ ] Server starts without errors
- [ ] Health endpoint returns 200
- [ ] CORS configured correctly
- [ ] Security headers present
- [ ] 404 handler works
- [ ] Error handler works
- [ ] Hot reload works
- [ ] Graceful shutdown works

### Developer Experience
- [ ] `npm run dev` starts server
- [ ] TypeScript errors shown clearly
- [ ] Console output informative
- [ ] Can stop server cleanly

## Testing Commands Summary

Run all these commands to verify Phase 1.0 completion:

```bash
# Full verification script
cd backend

# 1. TypeScript compilation
npx tsc --noEmit && echo "✓ TypeScript OK" || echo "✗ TypeScript FAILED"

# 2. Docker services
docker-compose ps | grep healthy && echo "✓ Docker OK" || echo "✗ Docker FAILED"

# 3. Database connections
psql $DATABASE_URL -c "SELECT 1" && echo "✓ PostgreSQL OK" || echo "✗ PostgreSQL FAILED"
redis-cli ping | grep PONG && echo "✓ Redis OK" || echo "✗ Redis FAILED"

# 4. Server
npm run dev &
sleep 3
curl -f http://localhost:3000/health && echo "✓ Server OK" || echo "✗ Server FAILED"
kill $(lsof -t -i:3000)

# 5. Environment
node -e "require('dotenv').config(); console.log(process.env.NODE_ENV === 'development' ? '✓ Environment OK' : '✗ Environment FAILED')"
```

## Rollback Procedure

If Phase 1.0 needs to be rolled back:

```bash
# Stop all services
docker-compose down

# Remove Docker volumes (WARNING: deletes data)
docker-compose down -v

# Remove node_modules
rm -rf backend/node_modules backend/package-lock.json

# Clean git (if needed)
git clean -fdx
git checkout .
```

## Next Steps

Once Phase 1.0 is complete:

1. ✅ Verify all checklist items
2. ✅ Commit changes with message: `feat(foundation): complete Phase 1.0 - project foundation`
3. ➡️ Proceed to [Phase 1.1: Database Layer](PHASE_1.1_DATABASE.md)

---

**Status:** ⏸️ Not Started
**Last Updated:** 2025-11-01
**Next Phase:** [Phase 1.1: Database Layer](PHASE_1.1_DATABASE.md)
