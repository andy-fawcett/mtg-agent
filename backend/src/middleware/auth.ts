import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/User';
import { User } from '../types/database.types';

// Extend Express Request to include user information
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
 * Rejects requests without valid session
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

    // Get user from database to ensure they still exist
    const user = await UserModel.findById(req.session.userId);

    if (!user) {
      // User was deleted, destroy session for cleanup
      req.session.destroy(() => {});
      res.status(401).json({
        error: 'User not found',
        message: 'User no longer exists. Please login again.',
      });
      return;
    }

    // Attach user to request for use in route handlers
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error: any) {
    console.error('requireAuth middleware error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Failed to verify authentication',
    });
  }
}

/**
 * Optional authentication (doesn't fail if no session)
 * Attaches user to request if session exists, otherwise continues
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
    // Ignore errors for optional auth - don't block the request
    console.error('optionalAuth middleware error:', error);
    next();
  }
}

/**
 * Require specific tier or higher
 * Must be used after requireAuth middleware
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
