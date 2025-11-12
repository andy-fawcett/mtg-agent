import { anthropic, CLAUDE_CONFIG } from '../config/anthropic';
import { MTG_SYSTEM_PROMPT, detectJailbreakAttempt } from '../prompts/mtgSystemPrompt';
import { CostService } from './costService';
import { ChatLogModel } from '../models/ChatLog';
import { getTierLimits } from '../config/limits';

export interface ChatRequest {
  message: string;
  userId?: string;
  sessionId?: string;
  userTier: string;
  conversationId?: string;  // NEW: For conversation support
}

export interface ChatResponse {
  response: string;
  conversationId: string | null;  // NEW: Return conversation ID
  tokensUsed: number;
  costCents: number;
  model: string;
}

export class ChatService {
  /**
   * Send message to Claude and get response
   * Includes: jailbreak detection, sanitization, cost tracking, logging, conversation history
   */
  static async chat(request: ChatRequest): Promise<ChatResponse> {
    const { message, userId, sessionId, userTier, conversationId } = request;
    const startTime = Date.now();

    try {
      // 1. Detect jailbreak attempts
      const jailbreakCheck = detectJailbreakAttempt(message);
      if (jailbreakCheck.detected) {
        console.warn('⚠️ Jailbreak attempt detected:', {
          userId,
          reason: jailbreakCheck.reason,
          pattern: jailbreakCheck.pattern,
        });

        // Log attempt to database
        await ChatLogModel.create({
          user_id: userId,
          session_id: sessionId,
          conversation_id: conversationId,
          user_message: message,
          message_length: message.length,
          success: false,
          error_message: `Jailbreak attempt: ${jailbreakCheck.reason}`,
          duration_ms: Date.now() - startTime,
        });

        throw new Error('Invalid request detected');
      }

      // 2. Handle conversation creation/loading
      let activeConversationId = conversationId || null;

      // If user is authenticated and no conversation provided, create one
      if (userId && !activeConversationId) {
        const { ConversationModel } = await import('../models/Conversation');
        const conversation = await ConversationModel.create(userId);
        activeConversationId = conversation.id;
      }

      // 3. Load conversation history if conversation exists
      let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      let summaryContext: string | null = null;

      if (activeConversationId) {
        const { ConversationModel } = await import('../models/Conversation');

        // Get conversation to check for summary context
        if (userId) {
          const conversation = await ConversationModel.getById(activeConversationId, userId);
          if (conversation) {
            summaryContext = conversation.summaryContext;
          }
        }

        // Load previous messages in conversation
        const previousMessages = await ChatLogModel.getByConversationId(activeConversationId);

        for (const msg of previousMessages) {
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
      }

      // 4. Get tier limits for max output tokens
      const limits = getTierLimits(userTier);

      // 5. Sanitize input
      const sanitizedMessage = this.sanitizeInput(message);

      // 6. Build system prompt (include summary if present)
      let systemPrompt = MTG_SYSTEM_PROMPT;
      if (summaryContext) {
        systemPrompt = `${MTG_SYSTEM_PROMPT}\n\n**Previous Conversation Summary:**\n${summaryContext}\n\n**Current Conversation Continues Below:**`;
      }

      // 7. Add new message to conversation history
      conversationHistory.push({
        role: 'user',
        content: sanitizedMessage,
      });

      // 8. Call Claude API with full conversation history
      const claudeResponse = await anthropic.messages.create({
        model: CLAUDE_CONFIG.model,
        max_tokens: limits.maxOutputTokens,  // FIXED: Use maxOutputTokens from config
        temperature: 0.7,
        system: systemPrompt,
        messages: conversationHistory,
      });

      // 9. Extract response text from content blocks
      const responseText = claudeResponse.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as any).text)
        .join('\n');

      // 10. Sanitize output
      const sanitizedResponse = this.sanitizeOutput(responseText);

      // 11. Calculate tokens and cost
      const inputTokens = claudeResponse.usage.input_tokens;
      const outputTokens = claudeResponse.usage.output_tokens;
      const tokensUsed = inputTokens + outputTokens;
      const duration = Date.now() - startTime;

      // 12. Calculate actual cost in cents
      const costCents = await this.calculateActualCost(
        inputTokens,
        outputTokens,
        CLAUDE_CONFIG.model
      );

      // 13. Record cost to daily tracking
      await CostService.recordCost(tokensUsed, userId);

      // 14. Update user's daily token usage (Phase 1.7)
      if (userId) {
        const { UserDailyTokensModel } = await import('../models/UserDailyTokens');
        await UserDailyTokensModel.addTokens(userId, tokensUsed);
      }

      // 15. Log successful chat to database (with message content and conversation ID)
      await ChatLogModel.create({
        user_id: userId,
        session_id: sessionId,
        conversation_id: activeConversationId,
        user_message: message,
        assistant_response: responseText,
        message_length: message.length,
        response_length: responseText.length,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        tokens_used: tokensUsed,
        actual_cost_cents: costCents,
        success: true,
        duration_ms: duration,
      });

      // 16. Auto-generate conversation title if this is the first message
      if (activeConversationId && userId && conversationHistory.length === 1) {
        const { ConversationModel } = await import('../models/Conversation');
        const title = ConversationModel.generateTitle(message);
        await ConversationModel.updateTitle(activeConversationId, userId, title);
      }

      return {
        response: sanitizedResponse,
        conversationId: activeConversationId,
        tokensUsed,
        costCents,
        model: CLAUDE_CONFIG.model,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Log error to database (with conversation ID)
      await ChatLogModel.create({
        user_id: userId,
        session_id: sessionId,
        conversation_id: conversationId,
        user_message: message,
        message_length: message.length,
        success: false,
        error_message: error.message || 'Unknown error',
        duration_ms: duration,
      });

      // Re-throw with sanitized error message (don't leak internal details)
      if (error.message === 'Invalid request detected') {
        throw error; // This is our jailbreak error, safe to pass through
      }

      // For API errors, provide generic message
      throw new Error('Failed to process request. Please try again.');
    }
  }

  /**
   * Sanitize user input
   * Removes dangerous characters and limits length
   */
  private static sanitizeInput(message: string): string {
    // Remove null bytes
    let sanitized = message.replace(/\0/g, '');

    // Limit length (4000 chars max)
    if (sanitized.length > 4000) {
      sanitized = sanitized.substring(0, 4000);
    }

    // Remove excessive whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
  }

  /**
   * Sanitize Claude output
   * Defense in depth: remove any potential XSS or prompt leakage
   */
  private static sanitizeOutput(response: string): string {
    // Remove any potential HTML/scripts (shouldn't happen with Claude, but defense in depth)
    let sanitized = response
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');

    // Remove system prompt leakage patterns
    sanitized = sanitized
      .replace(/STRICT OPERATIONAL BOUNDARIES:/gi, '[REDACTED]')
      .replace(/system\s+prompt/gi, '[REDACTED]');

    // Limit output length
    if (sanitized.length > 10000) {
      sanitized =
        sanitized.substring(0, 10000) +
        '\n\n[Response truncated for length]';
    }

    return sanitized;
  }

  /**
   * Calculate actual cost based on token usage
   * Uses pricing from CostService
   */
  private static async calculateActualCost(
    inputTokens: number,
    outputTokens: number,
    model: string
  ): Promise<number> {
    // Pricing for Claude 4.5 Sonnet
    const PRICING: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4-5-20250929': {
        input: 3.0 / 1_000_000, // $3 per million input tokens
        output: 15.0 / 1_000_000, // $15 per million output tokens
      },
      'claude-3-5-sonnet-20241022': {
        input: 3.0 / 1_000_000,
        output: 15.0 / 1_000_000,
      },
    };

    const pricing = PRICING[model];
    if (!pricing) {
      throw new Error(`Unknown model: ${model}`);
    }

    const inputCost = inputTokens * pricing.input;
    const outputCost = outputTokens * pricing.output;

    // Return cost in cents
    return Math.ceil((inputCost + outputCost) * 100);
  }
}
