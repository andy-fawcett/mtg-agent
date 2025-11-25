/**
 * Conversation and token limits configuration
 * Phase 1.7: Chat Sessions & Conversation History
 * Phase 1.8: Admin Dashboard configuration
 *
 * All limits are now stored in the database (system_config table)
 * and cached for performance with automatic refresh every 60 seconds.
 */

import { configCache } from '../models/SystemConfig';

// Rate limiting configuration
export async function getRateLimitConfig() {
  return {
    IP_WINDOW_MS: await configCache.getNumber('rate_limit.ip.window_ms', 60_000, 1_000, 600_000), // 1s - 10min
    IP_MAX_REQUESTS: await configCache.getNumber('rate_limit.ip.max_requests', 10, 1, 1000), // 1 - 1000
  };
}

// Tier-based limits (daily)
export interface TierLimits {
  tokensPerDay: number;        // Total tokens allowed per day (input + output)
  maxOutputTokens: number;     // Max output tokens per request (quality control)
}

/**
 * Get tier limits from database config (with caching)
 */
export async function getTierLimits(tier: string): Promise<TierLimits> {
  const normalizedTier = tier || 'free';

  return {
    tokensPerDay: await configCache.getNumber(
      `rate_limit.${normalizedTier}.tokens_per_day`,
      100_000,
      1_000,        // Min: 1k tokens/day
      100_000_000   // Max: 100M tokens/day
    ),
    maxOutputTokens: await configCache.getNumber(
      `rate_limit.${normalizedTier}.max_output_tokens`,
      2_000,
      100,    // Min: 100 tokens output
      16_000  // Max: 16k tokens (Claude's context limit)
    ),
  };
}

/**
 * Get conversation limits
 */
export async function getConversationLimits() {
  return {
    MAX_TOKENS: await configCache.getNumber('conversation.max_tokens', 150_000, 100, 1_000_000), // 100 - 1M
    WARNING_TOKENS: await configCache.getNumber('conversation.warning_tokens', 120_000, 100, 1_000_000), // 100 - 1M
  };
}

/**
 * Get budget configuration
 */
export async function getBudgetConfig() {
  return {
    DAILY_BUDGET_CENTS: await configCache.getNumber('budget.daily_cents', 100, 1, 1_000_000), // $0.01 - $10k
    ALERT_THRESHOLD_1: await configCache.getNumber('budget.alert_threshold_1', 50, 1, 100), // 1% - 100%
    ALERT_THRESHOLD_2: await configCache.getNumber('budget.alert_threshold_2', 75, 1, 100), // 1% - 100%
    ALERT_THRESHOLD_3: await configCache.getNumber('budget.alert_threshold_3', 90, 1, 100), // 1% - 100%
  };
}

/**
 * Preset summarization prompt (not user-modifiable)
 * Used when conversation reaches token limit
 */
export const SUMMARIZATION_PROMPT = `Please provide a concise summary of this Magic: The Gathering conversation, including:
- Key topics discussed
- Important cards, rules, or strategies mentioned
- Any decisions or conclusions reached
- Relevant context needed to continue the conversation

Keep the summary under 500 tokens.`;

/**
 * Force refresh of config cache
 * Useful after admin updates configuration
 */
export async function refreshConfig(): Promise<void> {
  await configCache.forceRefresh();
}
