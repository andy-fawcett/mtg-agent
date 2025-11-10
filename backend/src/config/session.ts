import session from 'express-session';
import RedisStore from 'connect-redis';
import { redisClient } from './redis';

/**
 * Get session configuration with validation
 * Called at runtime after environment variables are loaded
 */
export function getSessionConfig(): session.SessionOptions {
  // Validate SESSION_SECRET exists and is strong enough
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

  if (process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters');
  }

  return {
    store: new RedisStore({
      client: redisClient,
      prefix: 'sess:', // Prefix for session keys in Redis
    }),
    secret: process.env.SESSION_SECRET,
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something is stored
    name: 'mtg.sid', // Custom session cookie name (security through obscurity)
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true, // Prevent XSS attacks - no JavaScript access to cookie
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days in milliseconds
      sameSite: 'lax', // CSRF protection - can use 'strict' for even more security
    },
    rolling: true, // Reset expiration on every request (extends session lifetime with activity)
  };
}

// Extend Express session to include user data
declare module 'express-session' {
  interface SessionData {
    userId: string;
    email: string;
    tier: string;
  }
}
