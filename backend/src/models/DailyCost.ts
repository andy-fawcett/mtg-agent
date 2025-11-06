import { query, transaction } from '../config/database';
import { DailyCost } from '../types/database.types';

export class DailyCostModel {
  /**
   * Get today's costs
   */
  static async getToday(): Promise<DailyCost> {
    const result = await query<DailyCost>(
      `SELECT * FROM daily_costs WHERE date = CURRENT_DATE`
    );

    // Create if doesn't exist
    if (result.rows.length === 0) {
      return this.createToday();
    }

    return result.rows[0]!;
  }

  /**
   * Create today's entry
   */
  private static async createToday(): Promise<DailyCost> {
    const result = await query<DailyCost>(
      `INSERT INTO daily_costs (date)
       VALUES (CURRENT_DATE)
       ON CONFLICT (date) DO UPDATE SET date = CURRENT_DATE
       RETURNING *`
    );

    return result.rows[0]!;
  }

  /**
   * Add cost to today's total
   * Uses transaction to ensure atomicity
   */
  static async addCost(
    costCents: number,
    tokens: number,
    userId?: string
  ): Promise<void> {
    await transaction(async (client) => {
      // Update daily totals
      await client.query(
        `INSERT INTO daily_costs (date, total_cost_cents, total_requests, total_tokens)
         VALUES (CURRENT_DATE, $1, 1, $2)
         ON CONFLICT (date) DO UPDATE SET
           total_cost_cents = daily_costs.total_cost_cents + $1,
           total_requests = daily_costs.total_requests + 1,
           total_tokens = daily_costs.total_tokens + $2,
           updated_at = NOW()`,
        [costCents, tokens]
      );

      // Update unique users if userId provided
      if (userId) {
        // Check if user already counted today
        const counted = await client.query(
          `SELECT 1 FROM chat_logs
           WHERE user_id = $1 AND created_at >= CURRENT_DATE
           LIMIT 1`,
          [userId]
        );

        // If first request today, increment unique users
        if (counted.rows.length === 0) {
          await client.query(
            `UPDATE daily_costs
             SET unique_users = unique_users + 1
             WHERE date = CURRENT_DATE`
          );
        }
      }
    });
  }

  /**
   * Get cost for specific date
   */
  static async getByDate(date: Date): Promise<DailyCost | null> {
    const result = await query<DailyCost>(
      `SELECT * FROM daily_costs WHERE date = $1`,
      [date]
    );

    return result.rows[0] || null;
  }

  /**
   * Get last N days of costs
   */
  static async getLastNDays(days: number = 7): Promise<DailyCost[]> {
    const result = await query<DailyCost>(
      `SELECT * FROM daily_costs
       WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY date DESC`
    );

    return result.rows;
  }

  /**
   * Check if daily budget exceeded
   */
  static async isBudgetExceeded(budgetCents: number): Promise<boolean> {
    const today = await this.getToday();
    return today.total_cost_cents >= budgetCents;
  }

  /**
   * Get budget usage percentage
   */
  static async getBudgetUsagePercent(budgetCents: number): Promise<number> {
    const today = await this.getToday();
    return (today.total_cost_cents / budgetCents) * 100;
  }
}
