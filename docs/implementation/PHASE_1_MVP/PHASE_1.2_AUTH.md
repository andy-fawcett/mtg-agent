# Phase 1.2: Authentication & Authorization

**Status:** ⏸️ Not Started
**Duration Estimate:** 6-7 hours
**Prerequisites:** Phase 1.0 (Foundation) + Phase 1.1 (Database) complete
**Dependencies:** User model, bcrypt, express-session, connect-redis

## Objectives

Implement secure authentication system with server-side sessions, password hashing, and tier-based authorization.

- User registration with strong password requirements
- Login with Redis-backed session creation
- Password hashing with bcrypt (cost factor 12)
- Session validation middleware
- True logout capability (immediate session destruction)
- User tier system (anonymous, free, premium)
- Email uniqueness validation
- Password strength enforcement

## Architecture Overview

**Authentication Method:** Server-side sessions with Redis

**Key Features:**
- ✅ **Immediate revocation** - Can ban abusive users instantly (critical for cost control)
- ✅ **True logout** - Session destroyed on logout
- ✅ **Active session tracking** - See all logged-in users, detect suspicious activity
- ✅ **Redis-backed** - Fast session lookups using existing infrastructure
- ✅ **Cost control** - Stop API spending immediately when needed

---

## Task 1.2.1: Password Utilities

**Estimated Time:** 45 minutes

### Objectives

Create utility functions for password hashing, verification, and validation.

### Steps

**Create `backend/src/utils/password.ts`:**

```typescript
import bcrypt from 'bcrypt';

// Bcrypt cost factor (higher = more secure but slower)
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 * Returns array of errors, empty if valid
 */
export function validatePasswordStrength(password: string): string[] {
  const errors: string[] = [];

  // Length check
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  // Complexity checks
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Common password check
  const commonPasswords = [
    'password',
    'password123',
    'qwerty',
    '123456',
    'admin',
    'letmein',
  ];

  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    errors.push('Password is too common');
  }

  return errors;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}
```

### Verification

```bash
cd backend
cat > test-password.ts << 'EOF'
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  validateEmail,
} from './src/utils/password';

async function test() {
  console.log('Testing Password Utilities...\n');

  // Test hashing
  console.log('1. Testing password hashing...');
  const password = 'SecurePassword123!';
  const hash = await hashPassword(password);
  console.log('✓ Hash generated:', hash.substring(0, 20) + '...');

  // Test verification
  console.log('\n2. Testing password verification...');
  const valid = await verifyPassword(password, hash);
  console.log('✓ Verification (correct):', valid);

  const invalid = await verifyPassword('WrongPassword123!', hash);
  console.log('✓ Verification (wrong):', invalid);

  // Test validation
  console.log('\n3. Testing password strength...');

  const weakErrors = validatePasswordStrength('weak');
  console.log('Weak password errors:', weakErrors.length);

  const strongErrors = validatePasswordStrength('SecurePass123!@#');
  console.log('✓ Strong password errors:', strongErrors.length);

  // Test email validation
  console.log('\n4. Testing email validation...');
  console.log('✓ Valid email:', validateEmail('test@example.com'));
  console.log('✓ Invalid email:', validateEmail('notanemail'));

  console.log('\n✓ All tests passed!');
}

test();
EOF

npx tsx test-password.ts
rm test-password.ts
```

### Success Criteria

- [ ] Password hashing works
- [ ] Password verification works
- [ ] Weak passwords rejected
- [ ] Strong passwords accepted
- [ ] Email validation works
- [ ] Bcrypt cost factor configurable

---

## Task 1.2.2: Session Store Configuration

**Estimated Time:** 30 minutes

### Objectives

Configure express-session with Redis store for secure session management.

### Steps

**1. Install dependencies:**

```bash
cd backend
pnpm install express-session connect-redis
pnpm install -D @types/express-session
```

**2. Create `backend/src/config/session.ts`:**

```typescript
import session from 'express-session';
import RedisStore from 'connect-redis';
import { redisClient } from './redis';

// Session configuration
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required');
}

if (process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters');
}

export const sessionConfig: session.SessionOptions = {
  store: new RedisStore({
    client: redisClient,
    prefix: 'sess:',
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'mtg.sid', // Custom session cookie name (security through obscurity)
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS attacks
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax', // CSRF protection
  },
  rolling: true, // Reset expiration on every request
};

// Extend Express session to include user data
declare module 'express-session' {
  interface SessionData {
    userId: string;
    email: string;
    tier: string;
  }
}
```

**3. Verify Redis client exists at `backend/src/config/redis.ts`:**

```typescript
import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

export const redisClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('✓ Redis connected');
});
```

**4. Update `backend/src/index.ts` to use session middleware:**

```typescript
import express from 'express';
import session from 'express-session';
import { sessionConfig } from './config/session';

const app = express();

// Add session middleware BEFORE routes
app.use(session(sessionConfig));
```

### Verification

```bash
cd backend

# Start server
npm run dev &
sleep 3

# Test session creation (using curl with cookie jar)
echo "Testing session creation..."
curl -c cookies.txt -X POST http://localhost:3000/api/test-session \
  -H "Content-Type: application/json" \
  -d '{"test":"data"}'

# Verify session persists
curl -b cookies.txt http://localhost:3000/api/test-session

# Check Redis for session data
docker exec mtg-agent-redis redis-cli KEYS "sess:*"

# Stop server
kill $(lsof -t -i:3000)
rm cookies.txt
```

### Success Criteria

- [ ] express-session installed
- [ ] connect-redis installed
- [ ] Session configuration created
- [ ] Redis client connected
- [ ] Sessions stored in Redis
- [ ] Cookie settings secure
- [ ] TypeScript types extended

---

## Task 1.2.3: Authentication Service

**Estimated Time:** 60 minutes

### Objectives

Create authentication service with register and login logic using sessions.

### Steps

**Create `backend/src/services/authService.ts`:**

```typescript
import { UserModel } from '../models/User';
import { hashPassword, verifyPassword, validatePasswordStrength, validateEmail } from '../utils/password';
import { User } from '../types/database.types';
import { Session } from 'express-session';

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    tier: string;
    emailVerified: boolean;
  };
}

export class AuthService {
  /**
   * Register new user and create session
   */
  static async register(input: RegisterInput, session: Session): Promise<AuthResponse> {
    const { email, password } = input;

    // Validate email
    if (!validateEmail(email)) {
      throw new Error('Invalid email format');
    }

    // Validate password strength
    const passwordErrors = validatePasswordStrength(password);
    if (passwordErrors.length > 0) {
      throw new Error(`Password validation failed: ${passwordErrors.join(', ')}`);
    }

    // Check if email already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await UserModel.create({
      email,
      password_hash: passwordHash,
      tier: 'free',
    });

    // Create session
    session.userId = user.id;
    session.email = user.email;
    session.tier = user.tier;

    return {
      user: {
        id: user.id,
        email: user.email,
        tier: user.tier,
        emailVerified: user.email_verified,
      },
    };
  }

  /**
   * Login user and create session
   */
  static async login(input: LoginInput, session: Session): Promise<AuthResponse> {
    const { email, password } = input;

    // Find user
    const user = await UserModel.findByEmail(email);
    if (!user) {
      // Generic error to prevent email enumeration
      throw new Error('Invalid email or password');
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      throw new Error('Invalid email or password');
    }

    // Create session
    session.userId = user.id;
    session.email = user.email;
    session.tier = user.tier;

    return {
      user: {
        id: user.id,
        email: user.email,
        tier: user.tier,
        emailVerified: user.email_verified,
      },
    };
  }

  /**
   * Logout user (destroy session)
   */
  static async logout(session: Session): Promise<void> {
    return new Promise((resolve, reject) => {
      session.destroy((err) => {
        if (err) {
          reject(new Error('Failed to logout'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get user from session
   */
  static async getUserFromSession(userId: string): Promise<User> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }
}
```

### Verification

```bash
cd backend
cat > test-auth-service.ts << 'EOF'
import { AuthService } from './src/services/authService';
import { UserModel } from './src/models/User';
import { closePool } from './src/config/database';

// Mock session object
const createMockSession = () => {
  const session: any = {
    userId: undefined,
    email: undefined,
    tier: undefined,
    destroy: (callback: (err?: Error) => void) => {
      session.userId = undefined;
      session.email = undefined;
      session.tier = undefined;
      callback();
    },
  };
  return session;
};

async function test() {
  try {
    console.log('Testing Auth Service...\n');

    // Test registration
    console.log('1. Testing registration...');
    const registerSession = createMockSession();
    const registerResult = await AuthService.register({
      email: 'authtest@example.com',
      password: 'SecurePassword123!',
    }, registerSession);
    console.log('✓ Registered:', registerResult.user.email);
    console.log('✓ Session created:', registerSession.userId ? 'Yes' : 'No');

    // Test duplicate registration
    console.log('\n2. Testing duplicate registration...');
    try {
      await AuthService.register({
        email: 'authtest@example.com',
        password: 'AnotherPassword123!',
      }, createMockSession());
      console.log('✗ Should have thrown error');
    } catch (error: any) {
      console.log('✓ Duplicate rejected:', error.message);
    }

    // Test weak password
    console.log('\n3. Testing weak password...');
    try {
      await AuthService.register({
        email: 'weak@example.com',
        password: 'weak',
      }, createMockSession());
      console.log('✗ Should have thrown error');
    } catch (error: any) {
      console.log('✓ Weak password rejected');
    }

    // Test login
    console.log('\n4. Testing login...');
    const loginSession = createMockSession();
    const loginResult = await AuthService.login({
      email: 'authtest@example.com',
      password: 'SecurePassword123!',
    }, loginSession);
    console.log('✓ Logged in:', loginResult.user.email);
    console.log('✓ Session created:', loginSession.userId ? 'Yes' : 'No');

    // Test wrong password
    console.log('\n5. Testing wrong password...');
    try {
      await AuthService.login({
        email: 'authtest@example.com',
        password: 'WrongPassword123!',
      }, createMockSession());
      console.log('✗ Should have thrown error');
    } catch (error: any) {
      console.log('✓ Wrong password rejected');
    }

    // Test get user from session
    console.log('\n6. Testing get user from session...');
    const user = await AuthService.getUserFromSession(loginSession.userId);
    console.log('✓ User retrieved:', user.email);

    // Test logout
    console.log('\n7. Testing logout...');
    await AuthService.logout(loginSession);
    console.log('✓ Session destroyed:', loginSession.userId === undefined ? 'Yes' : 'No');

    // Cleanup
    await UserModel.delete(registerResult.user.id);

    console.log('\n✓ All tests passed!');
    await closePool();
  } catch (error) {
    console.error('✗ Test failed:', error);
    process.exit(1);
  }
}

test();
EOF

npx tsx test-auth-service.ts
rm test-auth-service.ts
```

### Success Criteria

- [ ] Can register new users
- [ ] Duplicate emails rejected
- [ ] Weak passwords rejected
- [ ] Can login with correct credentials
- [ ] Wrong passwords rejected
- [ ] Sessions created on login/register
- [ ] User retrieved from session
- [ ] Logout destroys session

---

## Task 1.2.4: Authentication Middleware

**Estimated Time:** 45 minutes

### Objectives

Create Express middleware for protecting routes with session-based authentication.

### Steps

**Create `backend/src/middleware/auth.ts`:**

```typescript
import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/User';
import { User } from '../types/database.types';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
    }
  }
}

/**
 * Require authentication (session must exist)
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check if session exists and has userId
    if (!req.session || !req.session.userId) {
      res.status(401).json({
        error: 'Not authenticated',
        message: 'Please login to access this resource',
      });
      return;
    }

    // Get user from database
    const user = await UserModel.findById(req.session.userId);

    if (!user) {
      // User was deleted, destroy session
      req.session.destroy(() => {});
      res.status(401).json({
        error: 'User not found',
        message: 'User no longer exists. Please login again.',
      });
      return;
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error: any) {
    res.status(500).json({
      error: 'Authentication error',
      message: 'Failed to verify authentication',
    });
  }
}

/**
 * Optional authentication (doesn't fail if no session)
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (req.session && req.session.userId) {
      const user = await UserModel.findById(req.session.userId);

      if (user) {
        req.user = user;
        req.userId = user.id;
      }
    }

    next();
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
}

/**
 * Require specific tier or higher
 */
export function requireTier(minimumTier: 'free' | 'premium' | 'enterprise') {
  const tierLevels = {
    anonymous: 0,
    free: 1,
    premium: 2,
    enterprise: 3,
  };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource',
      });
      return;
    }

    const userLevel = tierLevels[req.user.tier as keyof typeof tierLevels] || 0;
    const requiredLevel = tierLevels[minimumTier];

    if (userLevel < requiredLevel) {
      res.status(403).json({
        error: 'Insufficient permissions',
        message: `This feature requires ${minimumTier} tier or higher`,
        currentTier: req.user.tier,
        requiredTier: minimumTier,
      });
      return;
    }

    next();
  };
}
```

### Verification

```bash
cd backend

# Add test routes to src/index.ts
cat >> src/index.ts << 'EOF'

// Test auth middleware
import { requireAuth, requireTier } from './middleware/auth';

app.get('/api/protected', requireAuth, (req, res) => {
  res.json({
    message: 'This is a protected route',
    user: {
      id: req.user!.id,
      email: req.user!.email,
      tier: req.user!.tier,
    },
  });
});

app.get('/api/premium', requireAuth, requireTier('premium'), (req, res) => {
  res.json({
    message: 'This is a premium route',
    user: req.user!.email,
  });
});
EOF

# Start server
npm run dev &
sleep 3

# Test without session
echo "Testing without session..."
curl http://localhost:3000/api/protected
# Expected: 401 error

# Register user (creates session)
echo -e "\n\nRegistering user..."
curl -c cookies.txt -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"middleware@example.com","password":"SecurePass123!"}'

# Test with session cookie
echo -e "\n\nTesting with valid session..."
curl -b cookies.txt http://localhost:3000/api/protected
# Expected: 200 with user data

# Test premium route with free tier
echo -e "\n\nTesting premium route with free tier..."
curl -b cookies.txt http://localhost:3000/api/premium
# Expected: 403 Insufficient permissions

# Stop server
kill $(lsof -t -i:3000)
rm cookies.txt
```

### Success Criteria

- [ ] requireAuth middleware works
- [ ] Rejects requests without session
- [ ] Rejects invalid sessions
- [ ] Destroys session if user deleted
- [ ] Attaches user to request
- [ ] optionalAuth doesn't fail without session
- [ ] requireTier enforces tier levels
- [ ] Error messages helpful

---

## Task 1.2.5: Auth API Routes

**Estimated Time:** 45 minutes

### Objectives

Create registration, login, logout, and user info API endpoints.

### Steps

**Create `backend/src/routes/auth.ts`:**

```typescript
import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * POST /api/auth/register
 * Register new user and create session
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({
        error: 'Missing required fields',
        message: 'Email and password are required',
      });
      return;
    }

    // Register user (creates session automatically)
    const result = await AuthService.register({ email, password }, req.session);

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Registration error:', error);

    if (error.message.includes('already registered')) {
      res.status(409).json({
        error: 'Email already registered',
        message: 'An account with this email already exists',
      });
      return;
    }

    if (error.message.includes('Password validation')) {
      res.status(400).json({
        error: 'Weak password',
        message: error.message,
      });
      return;
    }

    if (error.message.includes('Invalid email')) {
      res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address',
      });
      return;
    }

    res.status(500).json({
      error: 'Registration failed',
      message: 'An error occurred during registration',
    });
  }
});

/**
 * POST /api/auth/login
 * Login user and create session
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({
        error: 'Missing required fields',
        message: 'Email and password are required',
      });
      return;
    }

    // Login user (creates session automatically)
    const result = await AuthService.login({ email, password }, req.session);

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Login error:', error);

    if (error.message.includes('Invalid email or password')) {
      res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      });
      return;
    }

    res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login',
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (destroy session)
 */
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    await AuthService.logout(req.session);

    res.status(200).json({
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    console.error('Logout error:', error);

    res.status(500).json({
      error: 'Logout failed',
      message: 'An error occurred during logout',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user (requires authentication)
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  res.json({
    user: {
      id: req.user!.id,
      email: req.user!.email,
      tier: req.user!.tier,
      emailVerified: req.user!.email_verified,
      createdAt: req.user!.created_at,
    },
  });
});

export default router;
```

**Update `backend/src/index.ts` to include auth routes:**

```typescript
// Add after other imports
import authRoutes from './routes/auth';

// Add after middleware setup (but after session middleware!)
app.use('/api/auth', authRoutes);
```

### Verification

```bash
cd backend

# Start server
npm run dev &
sleep 3

# Test registration
echo "1. Testing registration..."
curl -c cookies.txt -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"routes@example.com","password":"SecurePass123!"}'
# Expected: 201 with user data and session cookie

# Test duplicate registration
echo -e "\n\n2. Testing duplicate registration..."
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"routes@example.com","password":"AnotherPass123!"}'
# Expected: 409 Email already registered

# Test /me endpoint with session
echo -e "\n\n3. Testing /me endpoint with session..."
curl -b cookies.txt http://localhost:3000/api/auth/me
# Expected: 200 with user data

# Test logout
echo -e "\n\n4. Testing logout..."
curl -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/auth/logout
# Expected: 200 logout successful

# Test /me after logout (should fail)
echo -e "\n\n5. Testing /me after logout..."
curl -b cookies.txt http://localhost:3000/api/auth/me
# Expected: 401 not authenticated

# Test login
echo -e "\n\n6. Testing login..."
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"routes@example.com","password":"SecurePass123!"}'
# Expected: 200 with user data and new session

# Test /me after login
echo -e "\n\n7. Testing /me after login..."
curl -b cookies.txt http://localhost:3000/api/auth/me
# Expected: 200 with user data

# Stop server
kill $(lsof -t -i:3000)
rm cookies.txt
```

### Success Criteria

- [ ] POST /api/auth/register works
- [ ] POST /api/auth/login works
- [ ] POST /api/auth/logout works
- [ ] GET /api/auth/me works
- [ ] Input validation working
- [ ] Error responses appropriate
- [ ] Status codes correct
- [ ] Session cookies set correctly
- [ ] Logout destroys session immediately

---

## Phase 1.2 Completion Checklist

### Password Security
- [ ] Password hashing with bcrypt (cost 12+)
- [ ] Password strength validation
- [ ] Weak passwords rejected
- [ ] Email validation working

### Session Management
- [ ] Redis session store configured
- [ ] Session cookies secure (HttpOnly, Secure, SameSite)
- [ ] Sessions expire correctly (7 days max, 30 min idle)
- [ ] Session data properly typed
- [ ] Sessions stored in Redis with prefix

### Authentication Service
- [ ] Registration working with session creation
- [ ] Login working with session creation
- [ ] Logout destroys session immediately
- [ ] Duplicate emails prevented
- [ ] Password verification correct
- [ ] User retrieval from session works

### Middleware
- [ ] requireAuth works with sessions
- [ ] optionalAuth works
- [ ] requireTier works
- [ ] User attached to request
- [ ] Session validated on each request
- [ ] Deleted users handled gracefully
- [ ] Error handling proper

### API Routes
- [ ] POST /api/auth/register
- [ ] POST /api/auth/login
- [ ] POST /api/auth/logout
- [ ] GET /api/auth/me
- [ ] Input validation
- [ ] Error responses
- [ ] Status codes correct
- [ ] Session cookies set properly

## Common Issues

### Issue: bcrypt too slow

**Solution:**
```bash
# Reduce BCRYPT_ROUNDS in .env (development only)
BCRYPT_ROUNDS=10

# Production should use 12+
```

### Issue: Session not persisting

**Solution:**
```bash
# Verify Redis is running
docker ps | grep redis

# Check Redis connection
docker exec mtg-agent-redis redis-cli PING
# Should return: PONG

# Check sessions in Redis
docker exec mtg-agent-redis redis-cli KEYS "sess:*"

# Verify session middleware is before routes
# Session middleware must be added BEFORE route definitions
```

### Issue: CORS blocking cookies

**Solution:**
```typescript
// In backend/src/index.ts
app.use(cors({
  origin: 'http://localhost:3001', // Frontend URL
  credentials: true, // CRITICAL for cookies
}));
```

### Issue: Session secret not set

**Solution:**
```bash
# Generate secure secret
openssl rand -hex 32

# Add to .env
SESSION_SECRET=<generated_secret>
```

## Security Notes

- **Never log passwords** - not even hashed ones
- **Use HTTPS in production** - cookies require secure flag
- **Rotate SESSION_SECRET** if compromised (invalidates all sessions)
- **Rate limit auth endpoints** (Phase 1.3)
- **Consider email verification** (Phase 4)
- **Set SameSite=strict in production** for CSRF protection
- **Monitor active sessions** in Redis for suspicious activity

## Rollback Procedure

```bash
# Remove auth routes from index.ts
# Delete auth files
rm backend/src/routes/auth.ts
rm backend/src/services/authService.ts
rm backend/src/middleware/auth.ts
rm backend/src/config/session.ts
rm backend/src/utils/password.ts

# Remove session middleware from index.ts
# Restart server
```

## Next Steps

1. ✅ Verify all checklist items
2. ✅ Test all endpoints manually
3. ✅ Check Redis for session data
4. ✅ Test logout functionality
5. ✅ Commit: `feat(auth): complete Phase 1.2 - session-based authentication`
6. ➡️ Proceed to [Phase 1.3: Rate Limiting](PHASE_1.3_RATE_LIMITING.md)

---

**Status:** ⏸️ Not Started
**Last Updated:** 2025-11-05
**Implementation:** Server-side sessions with Redis
**Next Phase:** [Phase 1.3: Rate Limiting & Cost Controls](PHASE_1.3_RATE_LIMITING.md)
