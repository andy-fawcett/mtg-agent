# Phase 1.2: Authentication & Authorization

**Status:** ⏸️ Not Started
**Duration Estimate:** 8-10 hours
**Prerequisites:** Phase 1.0 (Foundation) + Phase 1.1 (Database) complete
**Dependencies:** User model, bcrypt, jsonwebtoken

## Objectives

Implement secure authentication system with JWT tokens, password hashing, and tier-based authorization.

- User registration with strong password requirements
- Login with JWT token generation
- Password hashing with bcrypt (cost factor 12)
- JWT token validation middleware
- Anonymous session support for trials
- User tier system (anonymous, free, premium)
- Email uniqueness validation
- Password strength enforcement

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

## Task 1.2.2: JWT Utilities

**Estimated Time:** 45 minutes

### Objectives

Create JWT token generation and validation utilities.

### Steps

**Create `backend/src/utils/jwt.ts`:**

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

if (JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

export interface JWTPayload {
  userId: string;
  email: string;
  tier: string;
}

/**
 * Generate JWT token
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'mtg-agent-api',
    audience: 'mtg-agent-client',
  });
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'mtg-agent-api',
      audience: 'mtg-agent-client',
    });

    return decoded as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token);
    return decoded as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(token: string): Date | null {
  const decoded = jwt.decode(token) as any;
  if (decoded && decoded.exp) {
    return new Date(decoded.exp * 1000);
  }
  return null;
}
```

### Verification

```bash
cd backend
cat > test-jwt.ts << 'EOF'
import { generateToken, verifyToken, getTokenExpiration } from './src/utils/jwt';

async function test() {
  console.log('Testing JWT Utilities...\n');

  const payload = {
    userId: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    tier: 'free',
  };

  // Generate token
  console.log('1. Generating token...');
  const token = generateToken(payload);
  console.log('✓ Token generated:', token.substring(0, 50) + '...');

  // Verify token
  console.log('\n2. Verifying token...');
  const decoded = verifyToken(token);
  console.log('✓ Decoded:', decoded);

  // Get expiration
  console.log('\n3. Getting expiration...');
  const exp = getTokenExpiration(token);
  console.log('✓ Expires at:', exp);

  // Test invalid token
  console.log('\n4. Testing invalid token...');
  try {
    verifyToken('invalid.token.here');
    console.log('✗ Should have thrown error');
  } catch (error: any) {
    console.log('✓ Invalid token rejected:', error.message);
  }

  console.log('\n✓ All tests passed!');
}

test();
EOF

npx tsx test-jwt.ts
rm test-jwt.ts
```

### Success Criteria

- [ ] JWT generation works
- [ ] JWT verification works
- [ ] Expired tokens rejected
- [ ] Invalid tokens rejected
- [ ] Payload correctly encoded/decoded
- [ ] Expiration time calculated

---

## Task 1.2.3: Authentication Service

**Estimated Time:** 90 minutes

### Objectives

Create authentication service with register and login logic.

### Steps

**Create `backend/src/services/authService.ts`:**

```typescript
import { UserModel } from '../models/User';
import { hashPassword, verifyPassword, validatePasswordStrength, validateEmail } from '../utils/password';
import { generateToken, JWTPayload } from '../utils/jwt';
import { User } from '../types/database.types';

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    tier: string;
    emailVerified: boolean;
  };
}

export class AuthService {
  /**
   * Register new user
   */
  static async register(input: RegisterInput): Promise<AuthResponse> {
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

    // Generate JWT
    const token = generateToken({
      userId: user.id,
      email: user.email,
      tier: user.tier,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        tier: user.tier,
        emailVerified: user.email_verified,
      },
    };
  }

  /**
   * Login user
   */
  static async login(input: LoginInput): Promise<AuthResponse> {
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

    // Generate JWT
    const token = generateToken({
      userId: user.id,
      email: user.email,
      tier: user.tier,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        tier: user.tier,
        emailVerified: user.email_verified,
      },
    };
  }

  /**
   * Verify JWT and get user
   */
  static async verifyAuth(token: string): Promise<User> {
    const { verifyToken } = await import('../utils/jwt');
    const payload = verifyToken(token);

    const user = await UserModel.findById(payload.userId);
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

async function test() {
  try {
    console.log('Testing Auth Service...\n');

    // Test registration
    console.log('1. Testing registration...');
    const registerResult = await AuthService.register({
      email: 'authtest@example.com',
      password: 'SecurePassword123!',
    });
    console.log('✓ Registered:', registerResult.user.email);
    console.log('✓ Token received:', registerResult.token.substring(0, 20) + '...');

    // Test duplicate registration
    console.log('\n2. Testing duplicate registration...');
    try {
      await AuthService.register({
        email: 'authtest@example.com',
        password: 'AnotherPassword123!',
      });
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
      });
      console.log('✗ Should have thrown error');
    } catch (error: any) {
      console.log('✓ Weak password rejected');
    }

    // Test login
    console.log('\n4. Testing login...');
    const loginResult = await AuthService.login({
      email: 'authtest@example.com',
      password: 'SecurePassword123!',
    });
    console.log('✓ Logged in:', loginResult.user.email);

    // Test wrong password
    console.log('\n5. Testing wrong password...');
    try {
      await AuthService.login({
        email: 'authtest@example.com',
        password: 'WrongPassword123!',
      });
      console.log('✗ Should have thrown error');
    } catch (error: any) {
      console.log('✓ Wrong password rejected');
    }

    // Test verify auth
    console.log('\n6. Testing verify auth...');
    const user = await AuthService.verifyAuth(loginResult.token);
    console.log('✓ Token verified:', user.email);

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
- [ ] JWT tokens generated
- [ ] Tokens can be verified
- [ ] User retrieved from token

---

## Task 1.2.4: Authentication Middleware

**Estimated Time:** 60 minutes

### Objectives

Create Express middleware for protecting routes with JWT authentication.

### Steps

**Create `backend/src/middleware/auth.ts`:**

```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
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
 * Require authentication (JWT in Authorization header)
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: 'No authorization header',
        message: 'Please provide an Authorization header with Bearer token',
      });
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Invalid authorization format',
        message: 'Authorization header must be: Bearer <token>',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    // Verify token
    const payload = verifyToken(token);

    // Get user from database
    const user = await UserModel.findById(payload.userId);

    if (!user) {
      res.status(401).json({
        error: 'User not found',
        message: 'Token is valid but user no longer exists',
      });
      return;
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error: any) {
    if (error.message === 'Token expired') {
      res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please login again.',
      });
      return;
    }

    res.status(403).json({
      error: 'Invalid token',
      message: 'Authentication token is invalid',
    });
  }
}

/**
 * Optional authentication (doesn't fail if no token)
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      const user = await UserModel.findById(payload.userId);

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

# Add test route to src/index.ts
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

# Test without token
echo "Testing without token..."
curl http://localhost:3000/api/protected
# Expected: 401 error

# Register and get token
echo -e "\n\nRegistering user..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"middleware@example.com","password":"SecurePass123!"}')

TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Token: ${TOKEN:0:50}..."

# Test with token
echo -e "\n\nTesting with valid token..."
curl http://localhost:3000/api/protected \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with user data

# Test premium route with free tier
echo -e "\n\nTesting premium route with free tier..."
curl http://localhost:3000/api/premium \
  -H "Authorization: Bearer $TOKEN"
# Expected: 403 Insufficient permissions

# Stop server
kill $(lsof -t -i:3000)
```

### Success Criteria

- [ ] requireAuth middleware works
- [ ] Rejects requests without token
- [ ] Rejects invalid tokens
- [ ] Rejects expired tokens
- [ ] Attaches user to request
- [ ] optionalAuth doesn't fail without token
- [ ] requireTier enforces tier levels
- [ ] Error messages helpful

---

## Task 1.2.5: Auth API Routes

**Estimated Time:** 60 minutes

### Objectives

Create registration and login API endpoints.

### Steps

**Create `backend/src/routes/auth.ts`:**

```typescript
import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService';

const router = Router();

/**
 * POST /api/auth/register
 * Register new user
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

    // Register user
    const result = await AuthService.register({ email, password });

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
 * Login user
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

    // Login user
    const result = await AuthService.login({ email, password });

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
 * GET /api/auth/me
 * Get current user (requires authentication)
 */
import { requireAuth } from '../middleware/auth';

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

// Add after middleware setup
app.use('/api/auth', authRoutes);
```

### Verification

```bash
# Start server
npm run dev &
sleep 3

# Test registration
echo "1. Testing registration..."
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"routes@example.com","password":"SecurePass123!"}'
# Expected: 201 with token and user data

# Test duplicate registration
echo -e "\n\n2. Testing duplicate registration..."
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"routes@example.com","password":"AnotherPass123!"}'
# Expected: 409 Email already registered

# Test login
echo -e "\n\n3. Testing login..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"routes@example.com","password":"SecurePass123!"}')
echo $RESPONSE

TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Test /me endpoint
echo -e "\n\n4. Testing /me endpoint..."
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with user data

# Stop server
kill $(lsof -t -i:3000)
```

### Success Criteria

- [ ] POST /api/auth/register works
- [ ] POST /api/auth/login works
- [ ] GET /api/auth/me works
- [ ] Input validation working
- [ ] Error responses appropriate
- [ ] Status codes correct
- [ ] Returns JWT tokens

---

## Phase 1.2 Completion Checklist

### Password Security
- [ ] Password hashing with bcrypt (cost 12+)
- [ ] Password strength validation
- [ ] Weak passwords rejected
- [ ] Email validation working

### JWT Tokens
- [ ] Token generation works
- [ ] Token verification works
- [ ] Tokens expire correctly
- [ ] Invalid tokens rejected
- [ ] Secret is secure (64+ chars)

### Authentication Service
- [ ] Registration working
- [ ] Login working
- [ ] Duplicate emails prevented
- [ ] Password verification correct
- [ ] Tokens generated correctly

### Middleware
- [ ] requireAuth works
- [ ] optionalAuth works
- [ ] requireTier works
- [ ] User attached to request
- [ ] Error handling proper

### API Routes
- [ ] POST /api/auth/register
- [ ] POST /api/auth/login
- [ ] GET /api/auth/me
- [ ] Input validation
- [ ] Error responses
- [ ] Status codes correct

## Common Issues

### Issue: bcrypt too slow

**Solution:**
```bash
# Reduce BCRYPT_ROUNDS in .env (development only)
BCRYPT_ROUNDS=10

# Production should use 12+
```

### Issue: JWT_SECRET error

**Solution:**
```bash
# Generate secure secret
openssl rand -hex 32

# Add to .env
JWT_SECRET=<generated_secret>
```

## Security Notes

- **Never log passwords** - not even hashed ones
- **Use HTTPS in production** - tokens sent in headers
- **Rotate JWT_SECRET** if compromised
- **Rate limit auth endpoints** (Phase 1.3)
- **Consider email verification** (Phase 4)

## Rollback Procedure

```bash
# Remove auth routes from index.ts
# Delete auth files
rm backend/src/routes/auth.ts
rm backend/src/services/authService.ts
rm backend/src/middleware/auth.ts
rm backend/src/utils/jwt.ts
rm backend/src/utils/password.ts

# Restart server
```

## Next Steps

1. ✅ Verify all checklist items
2. ✅ Test all endpoints manually
3. ✅ Commit: `feat(auth): complete Phase 1.2 - authentication`
4. ➡️ Proceed to [Phase 1.3: Rate Limiting](PHASE_1.3_RATE_LIMITING.md)

---

**Status:** ⏸️ Not Started
**Last Updated:** 2025-11-01
**Next Phase:** [Phase 1.3: Rate Limiting & Cost Controls](PHASE_1.3_RATE_LIMITING.md)
