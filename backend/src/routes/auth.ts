import type { Router as IRouter } from 'express';
import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { requireAuth } from '../middleware/auth';

const router: IRouter = Router();

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

    // Register user (without session - we'll create it here)
    const result = await AuthService.register({ email, password });

    // Regenerate session to prevent session fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        res.status(500).json({
          error: 'Session creation failed',
          message: 'Failed to create session after registration',
        });
        return;
      }

      // Set user data in new session
      req.session.userId = result.user.id;
      req.session.email = result.user.email;
      req.session.tier = result.user.tier;

      // Save session before sending response
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          res.status(500).json({
            error: 'Session save failed',
            message: 'Failed to save session after registration',
          });
          return;
        }

        res.status(201).json(result);
      });
    });
  } catch (error: any) {
    console.error('Registration error:', error);

    // Handle different error types with appropriate status codes
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

    // Login user (without session - we'll create it here)
    const result = await AuthService.login({ email, password });

    // Regenerate session to prevent session fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        res.status(500).json({
          error: 'Session creation failed',
          message: 'Failed to create session after login',
        });
        return;
      }

      // Set user data in new session
      req.session.userId = result.user.id;
      req.session.email = result.user.email;
      req.session.tier = result.user.tier;

      // Save session before sending response
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          res.status(500).json({
            error: 'Session save failed',
            message: 'Failed to save session after login',
          });
          return;
        }

        res.status(200).json(result);
      });
    });
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
      role: req.user!.role,
      emailVerified: req.user!.email_verified,
      createdAt: req.user!.created_at,
    },
  });
});

export default router;
