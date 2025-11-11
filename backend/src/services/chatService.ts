import { anthropic, CLAUDE_CONFIG } from '../config/anthropic';
import { MTG_SYSTEM_PROMPT, detectJailbreakAttempt } from '../prompts/mtgSystemPrompt';
import { CostService } from './costService';
import { ChatLogModel } from '../models/ChatLog';
import { getTierLimits } from '../middleware/rateLimit';

export interface ChatRequest {
  message: string;
  userId?: string;
  sessionId?: string;
  userTier: string;
}

export interface ChatResponse {
  response: string;
  tokensUsed: number;
  costCents: number;
  model: string;
}

export class ChatService {
  /**
   * Send message to Claude and get response
   * Includes: jailbreak detection, sanitization, cost tracking, logging
   */
  static async chat(request: ChatRequest): Promise<ChatResponse> {
    const { message, userId, sessionId, userTier } = request;
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
          message_length: message.length,
          success: false,
          error_message: `Jailbreak attempt: ${jailbreakCheck.reason}`,
          duration_ms: Date.now() - startTime,
        });

        throw new Error('Invalid request detected');
      }

      // 2. Get tier limits for max tokens
      const limits = getTierLimits(userTier);

      // 3. Sanitize input
      const sanitizedMessage = this.sanitizeInput(message);

      // 4. Call Claude API
      const claudeResponse = await anthropic.messages.create({
        model: CLAUDE_CONFIG.model,
        max_tokens: limits.maxTokens,
        temperature: 0.7,
        system: MTG_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: sanitizedMessage,
          },
        ],
      });

      // 5. Extract response text from content blocks
      const responseText = claudeResponse.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as any).text)
        .join('\n');

      // 6. Sanitize output
      const sanitizedResponse = this.sanitizeOutput(responseText);

      // 7. Calculate tokens and cost
      const inputTokens = claudeResponse.usage.input_tokens;
      const outputTokens = claudeResponse.usage.output_tokens;
      const tokensUsed = inputTokens + outputTokens;
      const duration = Date.now() - startTime;

      // 8. Calculate actual cost in cents
      const costCents = await this.calculateActualCost(
        inputTokens,
        outputTokens,
        CLAUDE_CONFIG.model
      );

      // 9. Record cost to daily tracking
      await CostService.recordCost(tokensUsed, userId);

      // 10. Log successful chat to database
      await ChatLogModel.create({
        user_id: userId,
        session_id: sessionId,
        message_length: message.length,
        response_length: responseText.length,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        tokens_used: tokensUsed,
        actual_cost_cents: costCents,
        success: true,
        duration_ms: duration,
      });

      return {
        response: sanitizedResponse,
        tokensUsed,
        costCents,
        model: CLAUDE_CONFIG.model,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Log error to database
      await ChatLogModel.create({
        user_id: userId,
        session_id: sessionId,
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
