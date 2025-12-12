import { DailyCostModel } from '../models/DailyCost';
import { redisClient } from '../config/redis';
import { getBudgetConfig } from '../config/limits';

// Claude Pricing (as of September 2025)
const PRICING = {
  // Claude 4.5 Sonnet (latest)
  'claude-sonnet-4-5-20250929': {
    input: 3.0 / 1_000_000,  // $3 per million input tokens
    output: 15.0 / 1_000_000, // $15 per million output tokens
  },
  // Claude 3.5 Sonnet (legacy - same pricing)
  'claude-3-5-sonnet-20241022': {
    input: 3.0 / 1_000_000,  // $3 per million input tokens
    output: 15.0 / 1_000_000, // $15 per million output tokens
  },
};

export class CostService {
  /**
   * Estimate cost for a request before making the API call
   * Uses rough estimation: 1 token ≈ 4 characters
   */
  static estimateCost(
    messageLength: number,
    maxOutputTokens: number,
    model: string = 'claude-sonnet-4-5-20250929'
  ): number {
    // Rough estimation: 1 token ≈ 4 characters
    const estimatedInputTokens = Math.ceil(messageLength / 4);

    const pricing = PRICING[model as keyof typeof PRICING];
    if (!pricing) {
      throw new Error(`Unknown model: ${model}`);
    }

    const inputCost = estimatedInputTokens * pricing.input;
    const outputCost = maxOutputTokens * pricing.output;

    // Return cost in cents
    return Math.ceil((inputCost + outputCost) * 100);
  }

  /**
   * Check if adding this cost would exceed daily budget
   * Returns false if request would exceed budget
   * Budget loaded from database dynamically
   */
  static async canAffordRequest(estimatedCostCents: number): Promise<boolean> {
    const budgetConfig = await getBudgetConfig();
    const today = await DailyCostModel.getToday();

    return (today.total_cost_cents + estimatedCostCents) <= budgetConfig.DAILY_BUDGET_CENTS;
  }

  /**
   * Get current budget status
   * Returns used amount, limit, remaining, and percentage used
   * Budget loaded from database dynamically
   */
  static async getBudgetStatus(): Promise<{
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
  }> {
    const budgetConfig = await getBudgetConfig();
    const today = await DailyCostModel.getToday();

    const used = today.total_cost_cents;
    const remaining = Math.max(0, budgetConfig.DAILY_BUDGET_CENTS - used);
    const percentUsed = (used / budgetConfig.DAILY_BUDGET_CENTS) * 100;

    return {
      used,
      limit: budgetConfig.DAILY_BUDGET_CENTS,
      remaining,
      percentUsed,
    };
  }

  /**
   * Check budget and send warning if needed
   * Single warning at configurable threshold (default 80%)
   */
  static async checkBudgetAlerts(): Promise<void> {
    const status = await this.getBudgetStatus();
    const budgetConfig = await getBudgetConfig();

    // Check if we've hit the warning threshold
    if (status.percentUsed >= budgetConfig.WARNING_THRESHOLD) {
      const alerted = await redisClient.get('budget_warning_sent');

      if (!alerted) {
        await this.sendBudgetAlert(budgetConfig.WARNING_THRESHOLD, status);
        // Set flag to prevent spam (resets daily)
        await redisClient.set('budget_warning_sent', '1', 'EX', 86400);
      }
    }
  }

  /**
   * Send budget alert (log for now, email in Phase 4)
   * Logs critical budget warnings to console
   */
  private static async sendBudgetAlert(
    threshold: number,
    status: { used: number; limit: number; percentUsed: number }
  ): Promise<void> {
    console.error('🚨 BUDGET ALERT 🚨');
    console.error(`Threshold: ${threshold}% of daily budget`);
    console.error(`Current: ${status.percentUsed.toFixed(1)}%`);
    console.error(`Used: $${(status.used / 100).toFixed(2)} / $${(status.limit / 100).toFixed(2)}`);

    // TODO: Send email notification in Phase 4
  }

  /**
   * Record actual cost after request completes
   * Updates daily costs and checks for budget alerts
   */
  static async recordCost(
    actualTokensUsed: number,
    userId?: string
  ): Promise<void> {
    // Calculate actual cost
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
    const pricing = PRICING[model as keyof typeof PRICING];

    if (!pricing) {
      throw new Error(`Unknown model: ${model}`);
    }

    // Assume 50/50 input/output for simplicity (can be improved with actual token breakdown)
    const inputTokens = Math.floor(actualTokensUsed / 2);
    const outputTokens = Math.ceil(actualTokensUsed / 2);

    const costCents = Math.ceil(
      (inputTokens * pricing.input + outputTokens * pricing.output) * 100
    );

    // Add to daily cost
    await DailyCostModel.addCost(costCents, actualTokensUsed, userId);

    // Check for alerts
    await this.checkBudgetAlerts();
  }
}
