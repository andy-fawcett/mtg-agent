import { Request, Response, NextFunction } from 'express';
import { AppError, RateLimitError } from '../utils/errors';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Global error handler
 * Catches all errors that occur in the application
 * and returns a consistent error response
 */
export function errorHandler(
  err: ApiError | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Determine if this is an operational error
  const isOperational = err instanceof AppError ? err.isOperational : err.isOperational ?? false;

  // Log error (more verbose for non-operational errors)
  if (!isOperational) {
    console.error('UNEXPECTED ERROR:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  } else {
    console.error('Error:', {
      message: err.message,
      path: req.path,
      method: req.method,
    });
  }

  // Determine status code
  const statusCode = err instanceof AppError ? err.statusCode : (err.statusCode || 500);

  // Build error response
  const errorResponse: any = {
    error: err.name || 'Error',
    message: err.message || 'Internal server error',
  };

  // Add retry-after header for rate limit errors
  if (err instanceof RateLimitError && err.retryAfter) {
    res.set('Retry-After', String(err.retryAfter));
    errorResponse.retryAfter = err.retryAfter;
  }

  // Add debug info in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.path = req.path;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
}

/**
 * 404 handler for unknown routes
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
    path: req.path,
  });
}

/**
 * Create an operational error
 * Operational errors are expected errors that should be returned to the user
 */
export function createError(message: string, statusCode: number = 400): ApiError {
  const error: ApiError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}
