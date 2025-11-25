import Anthropic from '@anthropic-ai/sdk';

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';

// Validate API key presence
if (!API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}

// Validate API key format
if (!API_KEY.startsWith('sk-ant-')) {
  throw new Error('Invalid ANTHROPIC_API_KEY format');
}

/**
 * Initialize Anthropic client with security best practices
 * - API key from environment only (never hardcoded)
 * - Retry logic for transient failures
 * - Timeout to prevent hanging requests
 */
export const anthropic = new Anthropic({
  apiKey: API_KEY,
  maxRetries: 2, // Retry failed requests up to 2 times
  timeout: 30000, // 30 seconds max per request
});

/**
 * Claude configuration constants
 * Note: max_tokens is now tier-based and configured in system_config table
 */
export const CLAUDE_CONFIG = {
  model: MODEL,
  temperature: 0.7, // Balanced between creativity and consistency
} as const;

console.log('✓ Anthropic SDK initialized');
console.log(`  Model: ${CLAUDE_CONFIG.model}`);
