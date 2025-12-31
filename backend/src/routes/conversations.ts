import type { Router as IRouter } from 'express';
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { ConversationModel } from '../models/Conversation';
import { ChatLogModel } from '../models/ChatLog';
import { SUMMARIZATION_PROMPT } from '../config/limits';
import { anthropic, CLAUDE_CONFIG } from '../config/anthropic';
import { MTG_SYSTEM_PROMPT } from '../prompts/mtgSystemPrompt';

const router: IRouter = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/conversations
 * List all conversations for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const conversations = await ConversationModel.getByUserId(req.user!.id);

    res.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error('Failed to fetch conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
    });
  }
});

/**
 * POST /api/conversations
 * Create a new conversation
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title } = req.body;

    const conversation = await ConversationModel.create(req.user!.id, title);

    res.status(201).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error('Failed to create conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create conversation',
    });
  }
});

/**
 * GET /api/conversations/:id
 * Get a specific conversation with all messages
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ success: false, message: 'Invalid conversation ID' });
      return;
    }

    const conversation = await ConversationModel.getById(id, req.user!.id);

    if (!conversation) {
      res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
      return;
    }

    // Get all messages in the conversation
    const messages = await ChatLogModel.getByConversationId(id);

    // Get conversation limits to include in response
    // Dynamic import to avoid circular dependency
    const { getConversationLimits } = await import('../config/limits');
    const limits = await getConversationLimits();

    res.json({
      success: true,
      conversation,
      messages: messages.map(msg => ({
        id: msg.id,
        userMessage: msg.user_message,
        assistantResponse: msg.assistant_response,
        createdAt: msg.created_at,
        tokensUsed: msg.tokens_used,
        actualCostCents: msg.actual_cost_cents,
      })),
      maxTokens: limits.MAX_TOKENS, // Hard limit (100%)
      warningTokens: limits.WARNING_TOKENS, // Warning threshold (80% by default)
    });
  } catch (error) {
    console.error('Failed to fetch conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation',
    });
  }
});

/**
 * PATCH /api/conversations/:id
 * Update conversation title
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!id) {
      res.status(400).json({ success: false, message: 'Invalid conversation ID' });
      return;
    }

    if (!title || typeof title !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Title is required',
      });
      return;
    }

    // Verify conversation belongs to user
    const conversation = await ConversationModel.getById(id, req.user!.id);
    if (!conversation) {
      res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
      return;
    }

    await ConversationModel.updateTitle(id, req.user!.id, title);

    res.json({
      success: true,
      message: 'Title updated',
    });
  } catch (error) {
    console.error('Failed to update conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update conversation',
    });
  }
});

/**
 * DELETE /api/conversations/:id
 * Delete a conversation (soft delete)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ success: false, message: 'Invalid conversation ID' });
      return;
    }

    // Verify conversation belongs to user
    const conversation = await ConversationModel.getById(id, req.user!.id);
    if (!conversation) {
      res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
      return;
    }

    await ConversationModel.delete(id, req.user!.id);

    res.json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete conversation',
    });
  }
});

/**
 * POST /api/conversations/:id/summarize-and-continue
 * Summarize current conversation and create new one with summary context
 */
router.post('/:id/summarize-and-continue', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ success: false, message: 'Invalid conversation ID' });
      return;
    }

    // Get conversation
    const conversation = await ConversationModel.getById(id, req.user!.id);
    if (!conversation) {
      res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
      return;
    }

    // Get all messages
    const messages = await ChatLogModel.getByConversationId(id);

    if (messages.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Cannot summarize empty conversation',
      });
      return;
    }

    // Build conversation history for Claude
    const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of messages) {
      if (msg.user_message) {
        conversationHistory.push({
          role: 'user',
          content: msg.user_message,
        });
      }
      if (msg.assistant_response) {
        conversationHistory.push({
          role: 'assistant',
          content: msg.assistant_response,
        });
      }
    }

    // Add summarization request
    conversationHistory.push({
      role: 'user',
      content: SUMMARIZATION_PROMPT,
    });

    // Call Claude to summarize
    const summaryResponse = await anthropic.messages.create({
      model: CLAUDE_CONFIG.model,
      max_tokens: 1000,
      system: MTG_SYSTEM_PROMPT,
      messages: conversationHistory,
    });

    const summary = summaryResponse.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as any).text)
      .join('\n');

    // Create new conversation with summary
    const newConversation = await ConversationModel.create(
      req.user!.id,
      `Continued: ${conversation.title || 'Conversation'}`
    );

    // Store summary context
    await ConversationModel.setSummaryContext(newConversation.id, summary);

    // Create the summary as the first message in the new conversation (assistant message only)
    const summaryMessage = `📋 **Conversation Summary**\n\n${summary}\n\n---\n\n*This is a continuation of a previous conversation. The context above summarizes what we discussed.*`;

    await ChatLogModel.create({
      user_id: req.user!.id,
      conversation_id: newConversation.id,
      user_message: '', // Empty user message - summary is just from assistant
      assistant_response: summaryMessage,
      message_length: 0,
      response_length: summaryMessage.length,
      input_tokens: 0,
      output_tokens: 0,
      tokens_used: 0,
      actual_cost_cents: 0,
      success: true,
    });

    // Archive old conversation
    await ConversationModel.archive(id);

    res.json({
      success: true,
      newConversationId: newConversation.id,
      summary,
      message: 'Conversation summarized successfully',
    });

  } catch (error) {
    console.error('Failed to summarize conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to summarize conversation',
    });
  }
});

export default router;
