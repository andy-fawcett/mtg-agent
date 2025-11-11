import { Router, Request, Response } from 'express';
import { ChatService } from '../services/chatService';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { ipRateLimit, userRateLimit, budgetCheck } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { ChatSchema } from '../validation/schemas';

const router = Router();

/**
 * POST /api/chat
 * Send message and get AI response
 *
 * Middleware chain:
 * 1. ipRateLimit - Rate limit by IP (10/min)
 * 2. optionalAuth - Load user if authenticated (but allow anonymous)
 * 3. userRateLimit - Rate limit by user tier or IP
 * 4. budgetCheck - Check daily budget limits
 * 5. validate - Validate message format
 */
router.post(
  '/',
  ipRateLimit,        // IP-based rate limiting
  optionalAuth,       // Authentication (optional for anonymous)
  userRateLimit,      // User/anonymous rate limiting
  budgetCheck,        // Check daily budget
  validate(ChatSchema), // Validate input
  async (req: Request, res: Response) => {
    try {
      const { message } = req.body;

      // Get user info
      const userId = req.user?.id;
      const userTier = req.user?.tier || 'anonymous';

      // Call chat service
      const response = await ChatService.chat({
        message,
        userId,
        userTier,
      });

      // Success response
      res.status(200).json({
        response: response.response,
        metadata: {
          tokensUsed: response.tokensUsed,
          model: response.model,
          costCents: response.costCents,
        },
      });
    } catch (error: any) {
      console.error('Chat endpoint error:', error);

      // Handle specific error types
      if (error.message === 'Invalid request detected') {
        res.status(400).json({
          error: 'Invalid request',
          message: 'Your message contains disallowed content',
        });
        return;
      }

      if (error.message.includes('budget')) {
        res.status(503).json({
          error: 'Service unavailable',
          message: 'Daily budget exceeded. Try again tomorrow.',
        });
        return;
      }

      // Generic error
      res.status(500).json({
        error: 'Chat failed',
        message: 'An error occurred while processing your message',
      });
    }
  }
);

/**
 * GET /api/chat/history
 * Get user's chat history (authenticated only)
 *
 * Query parameters:
 * - limit: Number of messages to return (default: 50, max: 100)
 */
router.get(
  '/history',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { ChatLogModel } = await import('../models/ChatLog');

      const limitParam = parseInt(req.query.limit as string) || 50;
      const limit = Math.min(limitParam, 100); // Cap at 100

      const history = await ChatLogModel.getByUserId(req.user!.id, limit);

      res.json({
        history: history.map(log => ({
          id: log.id,
          messageLength: log.message_length,
          responseLength: log.response_length,
          tokensUsed: log.tokens_used,
          success: log.success,
          createdAt: log.created_at,
        })),
      });
    } catch (error) {
      console.error('History endpoint error:', error);
      res.status(500).json({
        error: 'Failed to fetch history',
        message: 'An error occurred while fetching chat history',
      });
    }
  }
);

/**
 * GET /api/chat/stats
 * Get user's chat statistics
 */
router.get(
  '/stats',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { ChatLogModel } = await import('../models/ChatLog');

      const [todayCount, successRate] = await Promise.all([
        ChatLogModel.getTodayRequestCount(req.user!.id),
        ChatLogModel.getSuccessRate(req.user!.id),
      ]);

      res.json({
        stats: {
          todayRequests: todayCount,
          successRate: successRate.toFixed(2),
          tier: req.user!.tier,
        },
      });
    } catch (error) {
      console.error('Stats endpoint error:', error);
      res.status(500).json({
        error: 'Failed to fetch stats',
        message: 'An error occurred while fetching statistics',
      });
    }
  }
);

export default router;
