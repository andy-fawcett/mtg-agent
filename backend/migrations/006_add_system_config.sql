-- ======================
-- System Configuration Table
-- ======================
-- Stores all configurable system limits and thresholds
-- Admin UI can update these values in real-time (no server restart needed)

CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,  -- 'rate_limits', 'budgets', 'conversation', etc.
  value_type VARCHAR(20) NOT NULL DEFAULT 'number',  -- 'number', 'string', 'boolean'
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create index for category lookups
CREATE INDEX idx_system_config_category ON system_config(category);

-- Insert default configuration values
INSERT INTO system_config (key, value, description, category, value_type) VALUES
-- Rate Limiting - IP-based
('rate_limit.ip.window_ms', '60000', 'IP rate limit window in milliseconds', 'rate_limits', 'number'),
('rate_limit.ip.max_requests', '10', 'Max requests per IP per window', 'rate_limits', 'number'),

-- Rate Limiting - Free tier (no anonymous users - auth required)
('rate_limit.free.tokens_per_day', '100000', 'Max tokens per day for free users', 'rate_limits', 'number'),
('rate_limit.free.max_output_tokens', '2000', 'Max output tokens per request for free users', 'rate_limits', 'number'),

-- Rate Limiting - Premium tier
('rate_limit.premium.tokens_per_day', '1000000', 'Max tokens per day for premium users', 'rate_limits', 'number'),
('rate_limit.premium.max_output_tokens', '4000', 'Max output tokens per request for premium users', 'rate_limits', 'number'),

-- Rate Limiting - Enterprise tier
('rate_limit.enterprise.tokens_per_day', '10000000', 'Max tokens per day for enterprise users', 'rate_limits', 'number'),
('rate_limit.enterprise.max_output_tokens', '8000', 'Max output tokens per request for enterprise users', 'rate_limits', 'number'),

-- Budget Controls
('budget.daily_cents', '100', 'Daily budget limit in cents ($1.00)', 'budgets', 'number'),
('budget.alert_threshold_1', '50', 'First alert threshold (percentage)', 'budgets', 'number'),
('budget.alert_threshold_2', '75', 'Second alert threshold (percentage)', 'budgets', 'number'),
('budget.alert_threshold_3', '90', 'Third alert threshold (percentage)', 'budgets', 'number'),

-- Conversation Limits
('conversation.max_tokens', '150000', 'Max tokens per conversation before requiring summarization', 'conversation', 'number'),
('conversation.warning_tokens', '120000', 'Warning threshold for conversation length (not enforced)', 'conversation', 'number')

ON CONFLICT (key) DO NOTHING;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_system_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_system_config_timestamp
BEFORE UPDATE ON system_config
FOR EACH ROW
EXECUTE FUNCTION update_system_config_timestamp();
