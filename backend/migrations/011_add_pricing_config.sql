-- Migration 011: Add Pricing Configuration to system_config
-- Created: 2025-12-15
-- Phase 2: Consolidation - Centralize pricing in database

-- Add Claude model pricing to system_config
-- Prices are per million tokens (converted to per-token in code)

-- Claude 4.5 Sonnet (current default model)
INSERT INTO system_config (category, key, value, description) VALUES
  ('pricing', 'claude-sonnet-4-5-20250929.input_per_million', '3.00', 'Claude 4.5 Sonnet: Input tokens cost per million ($3.00)'),
  ('pricing', 'claude-sonnet-4-5-20250929.output_per_million', '15.00', 'Claude 4.5 Sonnet: Output tokens cost per million ($15.00)');

-- Claude 3.5 Sonnet (legacy model - same pricing)
INSERT INTO system_config (category, key, value, description) VALUES
  ('pricing', 'claude-3-5-sonnet-20241022.input_per_million', '3.00', 'Claude 3.5 Sonnet: Input tokens cost per million ($3.00)'),
  ('pricing', 'claude-3-5-sonnet-20241022.output_per_million', '15.00', 'Claude 3.5 Sonnet: Output tokens cost per million ($15.00)');

-- Add comment explaining pricing source
COMMENT ON TABLE system_config IS 'System-wide configuration including rate limits, budgets, conversation limits, and API pricing. Pricing from https://www.anthropic.com/pricing (as of September 2025).';
