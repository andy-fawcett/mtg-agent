import { query } from '../config/database';

export interface UserDailyTokens {
  id: string;
  userId: string;
  date: Date;
  totalTokensUsed: number;
  requestCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class UserDailyTokensModel {
  /**
   * Get or create today's token usage for user
   * Uses INSERT ... ON CONFLICT to ensure atomic operation
   */
  static async getOrCreateToday(userId: string): Promise<UserDailyTokens> {
    const result = await query<UserDailyTokens>(
      `INSERT INTO user_daily_tokens (user_id, date, total_tokens_used, request_count)
       VALUES ($1, CURRENT_DATE, 0, 0)
       ON CONFLICT (user_id, date)
       DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [userId]
    );

    return this.mapRow(result.rows[0]!);
  }

  /**
   * Add tokens to user's daily total
   * Uses atomic increment to avoid race conditions
   */
  static async addTokens(userId: string, tokens: number): Promise<void> {
    await query(
      `INSERT INTO user_daily_tokens (user_id, date, total_tokens_used, request_count)
       VALUES ($1, CURRENT_DATE, $2, 1)
       ON CONFLICT (user_id, date)
       DO UPDATE SET
         total_tokens_used = user_daily_tokens.total_tokens_used + $2,
         request_count = user_daily_tokens.request_count + 1,
         updated_at = NOW()`,
      [userId, tokens]
    );
  }

  /**
   * Get user's token usage for today
   * Returns 0 if no usage recorded yet
   */
  static async getTodayUsage(userId: string): Promise<number> {
    const result = await query<{ total_tokens_used: number }>(
      `SELECT total_tokens_used
       FROM user_daily_tokens
       WHERE user_id = $1 AND date = CURRENT_DATE`,
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0]!.total_tokens_used : 0;
  }

  /**
   * Get user's request count for today
   * Returns 0 if no requests recorded yet
   */
  static async getTodayRequestCount(userId: string): Promise<number> {
    const result = await query<{ request_count: number }>(
      `SELECT request_count
       FROM user_daily_tokens
       WHERE user_id = $1 AND date = CURRENT_DATE`,
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0]!.request_count : 0;
  }

  /**
   * Get user's token usage for a specific date range
   */
  static async getUsageByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UserDailyTokens[]> {
    const result = await query<UserDailyTokens>(
      `SELECT * FROM user_daily_tokens
       WHERE user_id = $1
       AND date >= $2
       AND date <= $3
       ORDER BY date DESC`,
      [userId, startDate, endDate]
    );

    return result.rows.map(this.mapRow);
  }

  /**
   * Map database row to UserDailyTokens interface
   */
  private static mapRow(row: any): UserDailyTokens {
    return {
      id: row.id,
      userId: row.user_id,
      date: row.date,
      totalTokensUsed: row.total_tokens_used,
      requestCount: row.request_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
