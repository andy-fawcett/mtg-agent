# Authentication & Authorization

## Overview

This document outlines authentication and authorization strategies for the MTG Agent application, balancing security with user experience.

## Authentication Strategies

### Option 1: OAuth 2.0 (Recommended)

**Pros:**
- No password management required
- Users trust established providers
- Reduced security liability
- Easy implementation with libraries
- Social login increases conversions

**Cons:**
- Dependency on third-party services
- Requires OAuth app registration
- More complex initial setup

**Recommended Providers:**
- Google (widest adoption)
- GitHub (developer-friendly)
- Discord (MTG community presence)

**Implementation (NextAuth.js example):**

```javascript
// pages/api/auth/[...nextauth].js
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id;
        token.tier = user.tier || 'free';
      }
      return token;
    },

    async session({ session, token }) {
      session.userId = token.userId;
      session.tier = token.tier;
      return session;
    },

    async signIn({ user, account, profile }) {
      // Create or update user in database
      await upsertUser({
        oauthProvider: account.provider,
        oauthId: account.providerAccountId,
        email: user.email,
        name: user.name,
        image: user.image,
      });

      return true;  // Allow sign in
    },
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,  // 30 days
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
});
```

### Option 2: Email/Password

**Pros:**
- Full control over authentication
- No third-party dependencies
- Works for all users

**Cons:**
- Must handle password storage securely
- Password reset flows required
- More security responsibility
- Users may have weak passwords

**Implementation (Express + bcrypt + JWT):**

```javascript
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Registration
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Check password strength
  if (password.length < 12) {
    return res.status(400).json({
      error: 'Password must be at least 12 characters'
    });
  }

  // Check if user exists
  const existingUser = await db.users.findOne({ email });
  if (existingUser) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  // Hash password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user
  const user = await db.users.create({
    email,
    passwordHash,
    tier: 'free',
    createdAt: new Date(),
  });

  // Generate JWT
  const token = jwt.sign(
    { userId: user.id, tier: user.tier },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { id: user.id, email: user.email, tier: user.tier } });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  // Find user
  const user = await db.users.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    // Log failed attempt
    await logFailedLogin(email, req.ip);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate JWT
  const token = jwt.sign(
    { userId: user.id, tier: user.tier },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { id: user.id, email: user.email, tier: user.tier } });
});
```

### Option 3: Anonymous + Optional Sign-In

**Pros:**
- Lowest friction for users
- Users can try before signing up
- Better conversion funnel

**Cons:**
- Limited rate limits for anonymous
- Harder to prevent abuse
- No user history/preferences

**Implementation:**

```javascript
// Generate anonymous session
app.post('/api/auth/anonymous', async (req, res) => {
  // Create temporary session
  const sessionId = generateSecureId();

  await redis.set(`anon_session:${sessionId}`, JSON.stringify({
    tier: 'anonymous',
    createdAt: Date.now(),
    ip: req.ip,
  }), 'EX', 86400);  // Expire in 24 hours

  res.json({ sessionId, tier: 'anonymous' });
});

// Upgrade to authenticated account
app.post('/api/auth/upgrade', async (req, res) => {
  const { sessionId, email, password } = req.body;

  // Retrieve anonymous session data
  const anonData = await redis.get(`anon_session:${sessionId}`);
  if (!anonData) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Create permanent account
  const user = await createUser({ email, password, tier: 'free' });

  // Migrate session data if needed
  await migrateAnonymousData(sessionId, user.id);

  // Clear anonymous session
  await redis.del(`anon_session:${sessionId}`);

  // Return authenticated token
  const token = generateJWT(user);
  res.json({ token, user });
});
```

## Session Management

### JWT-based Sessions

**Storage:**
```javascript
// Client-side (localStorage or secure cookie)
localStorage.setItem('auth_token', token);

// With fetch
fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ message })
});
```

**Verification Middleware:**
```javascript
const jwt = require('jsonwebtoken');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Load user from database
    const user = await db.users.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Attach to request
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

app.use('/api/chat', authenticateToken);
```

### Server-side Sessions

**Using express-session + Redis:**

```javascript
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const Redis = require('ioredis');

const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,  // HTTPS only
    httpOnly: true,  // No JavaScript access
    maxAge: 1000 * 60 * 60 * 24 * 7,  // 7 days
    sameSite: 'strict'  // CSRF protection
  }
}));

// Store user in session after login
app.post('/api/auth/login', async (req, res) => {
  // ... validate credentials ...

  req.session.userId = user.id;
  req.session.tier = user.tier;

  res.json({ success: true });
});

// Middleware to check session
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}
```

## Authorization (User Tiers)

### Tier System

```javascript
const TIERS = {
  anonymous: {
    level: 0,
    messagesPerDay: 3,
    features: ['basic_search'],
  },
  free: {
    level: 1,
    messagesPerDay: 50,
    features: ['basic_search', 'card_images', 'deck_analysis'],
  },
  premium: {
    level: 2,
    messagesPerDay: 500,
    features: ['basic_search', 'card_images', 'deck_analysis', 'advanced_combos', 'price_tracking'],
    cost: 9.99,  // per month
  },
  enterprise: {
    level: 3,
    messagesPerDay: 10000,
    features: ['*'],  // All features
    cost: 99.99,
  }
};

function checkFeatureAccess(userTier, feature) {
  const tier = TIERS[userTier];

  if (tier.features.includes('*')) {
    return true;
  }

  return tier.features.includes(feature);
}

// Middleware
function requireFeature(feature) {
  return (req, res, next) => {
    if (!checkFeatureAccess(req.user.tier, feature)) {
      return res.status(403).json({
        error: 'Upgrade required',
        feature: feature,
        requiredTier: getRequiredTier(feature)
      });
    }
    next();
  };
}

// Usage
app.post('/api/analyze-deck', requireAuth, requireFeature('deck_analysis'), async (req, res) => {
  // Only accessible to free+ users
});
```

## Security Best Practices

### Password Requirements

```javascript
function validatePassword(password) {
  const errors = [];

  if (password.length < 12) {
    errors.push('Must be at least 12 characters');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Must contain lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Must contain uppercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Must contain number');
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Must contain special character');
  }

  // Check against common passwords
  const commonPasswords = ['password123', 'qwerty123', ...];
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password too common');
  }

  return errors;
}
```

### Account Lockout

```javascript
async function checkAccountLockout(email) {
  const lockoutKey = `lockout:${email}`;
  const attemptKey = `attempts:${email}`;

  // Check if locked out
  const lockedUntil = await redis.get(lockoutKey);
  if (lockedUntil && Date.now() < parseInt(lockedUntil)) {
    throw new Error('Account temporarily locked. Try again later.');
  }

  // Check failed attempts
  const attempts = await redis.get(attemptKey);
  if (attempts && parseInt(attempts) >= 5) {
    // Lock account for 15 minutes
    const lockUntil = Date.now() + (15 * 60 * 1000);
    await redis.set(lockoutKey, lockUntil, 'EX', 900);
    await redis.del(attemptKey);

    throw new Error('Too many failed attempts. Account locked for 15 minutes.');
  }
}

async function recordFailedLogin(email) {
  const attemptKey = `attempts:${email}`;
  const attempts = await redis.incr(attemptKey);
  await redis.expire(attemptKey, 3600);  // Reset after 1 hour

  return attempts;
}

async function clearFailedLogins(email) {
  await redis.del(`attempts:${email}`);
  await redis.del(`lockout:${email}`);
}
```

### Token Refresh

```javascript
// Generate both access and refresh tokens
function generateTokens(user) {
  const accessToken = jwt.sign(
    { userId: user.id, tier: user.tier },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }  // Short-lived
  );

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }  // Long-lived
  );

  return { accessToken, refreshToken };
}

// Refresh endpoint
app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    const user = await db.users.findById(decoded.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

## CAPTCHA Integration

**Purpose:** Prevent automated abuse

```javascript
const axios = require('axios');

async function verifyCaptcha(captchaToken) {
  const response = await axios.post(
    'https://www.google.com/recaptcha/api/siteverify',
    null,
    {
      params: {
        secret: process.env.RECAPTCHA_SECRET,
        response: captchaToken,
      }
    }
  );

  return response.data.success;
}

// Require CAPTCHA for anonymous users
app.post('/api/chat', async (req, res) => {
  const user = await getUser(req);

  if (user.tier === 'anonymous') {
    const { captchaToken } = req.body;

    if (!captchaToken) {
      return res.status(400).json({ error: 'CAPTCHA required' });
    }

    const validCaptcha = await verifyCaptcha(captchaToken);
    if (!validCaptcha) {
      return res.status(400).json({ error: 'Invalid CAPTCHA' });
    }
  }

  // Process request...
});
```

## Email Verification

```javascript
const crypto = require('crypto');

// Generate verification token
async function sendVerificationEmail(user) {
  const token = crypto.randomBytes(32).toString('hex');

  await redis.set(
    `verify:${token}`,
    user.id,
    'EX',
    24 * 60 * 60  // Expire in 24 hours
  );

  const verifyUrl = `https://yourdomain.com/verify?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: 'Verify your email',
    html: `Click here to verify: <a href="${verifyUrl}">${verifyUrl}</a>`
  });
}

// Verification endpoint
app.get('/api/auth/verify', async (req, res) => {
  const { token } = req.query;

  const userId = await redis.get(`verify:${token}`);
  if (!userId) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  // Mark email as verified
  await db.users.update(userId, { emailVerified: true });

  // Delete token
  await redis.del(`verify:${token}`);

  res.json({ success: true });
});
```

## Recommended Architecture

**For MVP:**
1. OAuth with Google/GitHub (NextAuth.js)
2. Anonymous tier with strict limits
3. JWT sessions
4. CAPTCHA for anonymous users

**For Production:**
1. OAuth + email/password options
2. Server-side sessions with Redis
3. Email verification required
4. Account lockout after failed attempts
5. Token refresh mechanism
6. Admin panel for user management

## Implementation Checklist

### Basic Auth
- [ ] OAuth providers configured
- [ ] User database schema created
- [ ] Session management implemented
- [ ] Login/logout endpoints working
- [ ] Authentication middleware created

### Security
- [ ] Passwords hashed with bcrypt (if using)
- [ ] HTTPS enforced
- [ ] Secure session cookies
- [ ] CSRF protection enabled
- [ ] Rate limiting on auth endpoints

### User Management
- [ ] User tiers implemented
- [ ] Feature access controls
- [ ] Account lockout mechanism
- [ ] Email verification (if email/password)
- [ ] Password reset flow (if email/password)

### Testing
- [ ] Auth flow tested
- [ ] Token expiration tested
- [ ] Account lockout tested
- [ ] Feature access tested per tier
- [ ] Session security tested

## Conclusion

Start with OAuth for simplicity and security, add anonymous tier for low-friction onboarding, and implement robust session management. The tier system allows for natural upgrade paths as users find value in the service.
