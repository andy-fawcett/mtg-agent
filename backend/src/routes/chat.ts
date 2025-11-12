import { Router, Request, Response } from 'express';
import { ChatService } from '../services/chatService';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { ipRateLimit, userRateLimit, budgetCheck, tokenBudgetCheck } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { ChatSchema } from '../validation/schemas';
import { CONVERSATION_LIMITS } from '../config/limits';

const router = Router();

/**
 * POST /api/chat
 * Send message and get AI response
 *
 * Middleware chain:
 * 1. ipRateLimit - Rate limit by IP (10/min)
 * 2. optionalAuth - Load user if authenticated (but allow anonymous)
 * 3. userRateLimit - Rate limit by user tier or IP
 * 4. tokenBudgetCheck - Check user's daily token limit (NEW Phase 1.7)
 * 5. budgetCheck - Check daily budget limits
 * 6. validate - Validate message format
 */
router.post(
  '/',
  ipRateLimit,          // IP-based rate limiting
  optionalAuth,         // Authentication (optional for anonymous)
  userRateLimit,        // User/anonymous rate limiting
  tokenBudgetCheck,     // NEW: Check daily token usage
  budgetCheck,          // Check daily budget
  validate(ChatSchema), // Validate input
  async (req: Request, res: Response) => {
    try {
      const { message, conversationId } = req.body;

      // Get user info
      const userId = req.user?.id;
      const userTier = req.user?.tier || 'anonymous';

      // Check conversation limit if conversationId provided
      if (conversationId && userId) {
        const { ConversationModel } = await import('../models/Conversation');
        const conversation = await ConversationModel.getById(conversationId, userId);

        if (!conversation) {
          return res.status(404).json({
            error: 'Conversation not found',
            message: 'The specified conversation does not exist',
          });
        }

        // Check if conversation has hit 150k token limit
        if (conversation.totalTokens >= CONVERSATION_LIMITS.MAX_TOKENS) {
          return res.status(400).json({
            error: 'conversation_limit_reached',
            message: 'This conversation has reached its maximum length.',
            conversationTokens: conversation.totalTokens,
            maxTokens: CONVERSATION_LIMITS.MAX_TOKENS,
            action: {
              type: 'summarize_required',
              endpoint: `/api/conversations/${conversationId}/summarize-and-continue`,
              buttonText: 'Summarize & Start New Chat',
            },
          });
        }
      }

      // Call chat service
      const response = await ChatService.chat({
        message,
        userId,
        userTier,
        conversationId,
      });

      // Success response
      res.status(200).json({
        response: response.response,
        conversationId: response.conversationId,  // NEW: Return conversation ID
        metadata: {
          tokensUsed: response.tokensUsed,
          model: response.model,
          costCents: response.costCents,
        },
      });
    } catch (error: any) {
      // Write error to file for debugging
      const fs = require('fs');
      fs.appendFileSync('/tmp/chat-error.log', `\n\n=== ${new Date().toISOString()} ===\n`);
      fs.appendFileSync('/tmp/chat-error.log', `Error: ${error}\n`);
      fs.appendFileSync('/tmp/chat-error.log', `Message: ${error.message}\n`);
      fs.appendFileSync('/tmp/chat-error.log', `Stack: ${error.stack}\n`);

      console.error('Chat endpoint error:', error);
      console.error('Error stack:', error.stack);
      console.error('Error message:', error.message);

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
