import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to require admin role
 * Must be used after requireAuth middleware
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Check if user is authenticated (should be set by requireAuth)
  if (!req.session?.userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  // Check if user has admin role (stored in session by requireAuth)
  const userRole = req.session.userRole;

  if (userRole !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
    return;
  }

  next();
}
