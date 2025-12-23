/**
 * Claude API Pricing Configuration
 *
 * Pricing is stored in the database (system_config table) and cached.
 * Update pricing via database or admin dashboard.
 *
 * Source: https://www.anthropic.com/pricing (as of September 2025)
 */

import { configCache } from '../models/SystemConfig';

export interface ModelPricing {
  input: number;  // Cost per token (in dollars)
  output: number; // Cost per token (in dollars)
}

/**
 * Get pricing for a specific model from database
 * Uses 60-second cache to avoid repeated database queries
 *
 * @param model - Model identifier (e.g., 'claude-sonnet-4-5-20250929')
 * @returns Pricing in dollars per token
 * @throws Error if model pricing not found in database
 */
export async function getModelPricing(model: string): Promise<ModelPricing> {
  // Get pricing from database (prices stored as "per million tokens")
  const inputPerMillion = await configCache.getNumber(
    `pricing.${model}.input_per_million`,
    3.0,      // Default: $3 per million (fallback if not in DB)
    0.01,     // Min: $0.01 per million
    1000.0    // Max: $1000 per million
  );

  const outputPerMillion = await configCache.getNumber(
    `pricing.${model}.output_per_million`,
    15.0,     // Default: $15 per million (fallback if not in DB)
    0.01,     // Min: $0.01 per million
    1000.0    // Max: $1000 per million
  );

  // Convert from "per million" to "per token"
  return {
    input: inputPerMillion / 1_000_000,
    output: outputPerMillion / 1_000_000,
  };
}

/**
 * Calculate cost in cents for given token usage
 *
 * @param inputTokens - Number of input tokens used
 * @param outputTokens - Number of output tokens used
 * @param model - Model identifier
 * @returns Cost in cents (rounded up)
 */
export async function calculateCostCents(
  inputTokens: number,
  outputTokens: number,
  model: string
): Promise<number> {
  const pricing = await getModelPricing(model);

  const inputCost = inputTokens * pricing.input;
  const outputCost = outputTokens * pricing.output;

  // Return cost in cents, rounded up
  return Math.ceil((inputCost + outputCost) * 100);
}
