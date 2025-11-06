import { query } from '../config/database';
import { ChatLog, CreateChatLogInput } from '../types/database.types';

export class ChatLogModel {
  /**
   * Create chat log entry with token breakdown and actual cost
   */
  static async create(input: CreateChatLogInput): Promise<ChatLog> {
    const result = await query<ChatLog>(
      `INSERT INTO chat_logs (
        user_id, session_id, message_length, response_length,
        input_tokens, output_tokens, tokens_used,
        actual_cost_cents, tools_used,
        success, error_message, duration_ms
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        input.user_id || null,
        input.session_id || null,
        input.message_length,
        input.response_length || null,
        input.input_tokens || null,
        input.output_tokens || null,
        input.tokens_used || null,
        input.actual_cost_cents || null,
        input.tools_used || null,
        input.success,
        input.error_message || null,
        input.duration_ms || null,
      ]
    );

    return result.rows[0]!;
  }

  /**
   * Get user's chat history
   */
  static async getByUserId(
    userId: string,
    limit: number = 50
  ): Promise<ChatLog[]> {
    const result = await query<ChatLog>(
      `SELECT * FROM chat_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * Get today's request count for user
   */
  static async getTodayRequestCount(userId: string): Promise<number> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM chat_logs
       WHERE user_id = $1
       AND created_at >= CURRENT_DATE`,
      [userId]
    );

    return parseInt(result.rows[0]!.count);
  }

  /**
   * Get success rate
   */
  static async getSuccessRate(userId: string): Promise<number> {
    const result = await query<{ success_rate: string }>(
      `SELECT
        CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE (COUNT(*) FILTER (WHERE success = TRUE)::float / COUNT(*)) * 100
        END as success_rate
       FROM chat_logs
       WHERE user_id = $1`,
      [userId]
    );

    return parseFloat(result.rows[0]!.success_rate);
  }

  /**
   * Get total cost for user (useful for tracking per-user spending)
   */
  static async getTotalCostForUser(userId: string): Promise<number> {
    const result = await query<{ total_cost: string }>(
      `SELECT COALESCE(SUM(actual_cost_cents), 0) as total_cost
       FROM chat_logs
       WHERE user_id = $1`,
      [userId]
    );

    return parseFloat(result.rows[0]!.total_cost);
  }

  /**
   * Get average tokens per request for analytics
   */
  static async getAverageTokens(userId: string): Promise<{
    avg_input: number;
    avg_output: number;
    avg_total: number;
  }> {
    const result = await query<{
      avg_input: string;
      avg_output: string;
      avg_total: string;
    }>(
      `SELECT
        COALESCE(AVG(input_tokens), 0) as avg_input,
        COALESCE(AVG(output_tokens), 0) as avg_output,
        COALESCE(AVG(tokens_used), 0) as avg_total
       FROM chat_logs
       WHERE user_id = $1 AND success = TRUE`,
      [userId]
    );

    const row = result.rows[0]!;
    return {
      avg_input: parseFloat(row.avg_input),
      avg_output: parseFloat(row.avg_output),
      avg_total: parseFloat(row.avg_total),
    };
  }
}
