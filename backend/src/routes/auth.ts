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
