/**
 * Conversation and token limits configuration
 * Phase 1.7: Chat Sessions & Conversation History
 */

// Global conversation limits (all tiers)
export const CONVERSATION_LIMITS = {
  MAX_TOKENS: 150_000,           // Hard limit per conversation (~75 exchanges)
  WARNING_TOKENS: 120_000,       // Soft warning threshold (not used per requirements)
};

// Tier-based daily token limits
export interface TierLimits {
  tokensPerDay: number;        // Total tokens allowed per day (input + output)
  maxOutputTokens: number;     // Max output tokens per request (quality control)
}

export const TIER_LIMITS: Record<string, TierLimits> = {
  anonymous: {
    tokensPerDay: 10_000,           // ~5-10 messages
    maxOutputTokens: 1_000,
  },
  free: {
    tokensPerDay: 100_000,          // ~50-100 messages
    maxOutputTokens: 2_000,
  },
  premium: {
    tokensPerDay: 1_000_000,        // ~500-1000 messages
    maxOutputTokens: 4_000,
  },
  enterprise: {
    tokensPerDay: 10_000_000,       // ~5000-10000 messages
    maxOutputTokens: 8_000,
  },
};

/**
 * Get tier limits (with fallback to 'free')
 */
export function getTierLimits(tier: string): TierLimits {
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
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
