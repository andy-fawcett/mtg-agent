-- Migration: 001_initial_schema
-- Description: Initial database schema for MTG Agent
-- Created: 2025-11-05

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ======================
-- Users Table
-- ======================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  tier VARCHAR(50) DEFAULT 'free' CHECK (tier IN ('anonymous', 'free', 'premium', 'enterprise')),
  email_verified BOOLEAN DEFAULT FALSE,

  -- OAuth fields (for Phase 4)
  oauth_provider VARCHAR(50),
  oauth_id VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP  -- Soft delete
);

-- Indexes for users
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_tier ON users(tier) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_id) WHERE oauth_provider IS NOT NULL;
CREATE INDEX idx_users_created_at ON users(created_at);

-- ======================
-- Sessions Table
-- ======================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,

  -- Metadata
  ip_address INET,
  user_agent TEXT,

  -- Expiration
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for sessions
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(session_token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ======================
-- Chat Logs Table
-- ======================
CREATE TABLE IF NOT EXISTS chat_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,

  -- Message metrics
  message_length INTEGER NOT NULL,
  response_length INTEGER,

  -- Token usage breakdown (updated from original design)
  input_tokens INTEGER,
  output_tokens INTEGER,
  tokens_used INTEGER,  -- Total for convenience

  -- Exact cost from API response (renamed from estimated_cost_cents)
  actual_cost_cents DECIMAL(10, 4),

  -- Tool usage (JSON array of tool names)
  tools_used TEXT[],

  -- Status
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  duration_ms INTEGER,

  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for chat_logs
CREATE INDEX idx_chat_logs_user_id ON chat_logs(user_id);
CREATE INDEX idx_chat_logs_session_id ON chat_logs(session_id);
CREATE INDEX idx_chat_logs_created_at ON chat_logs(created_at);
CREATE INDEX idx_chat_logs_success ON chat_logs(success);

-- Composite index for analytics
CREATE INDEX idx_chat_logs_analytics ON chat_logs(user_id, created_at) WHERE success = TRUE;

-- Index for cost analysis
CREATE INDEX idx_chat_logs_cost ON chat_logs(actual_cost_cents) WHERE actual_cost_cents IS NOT NULL;

-- ======================
-- Daily Costs Table
-- ======================
CREATE TABLE IF NOT EXISTS daily_costs (
  date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  total_cost_cents BIGINT DEFAULT 0,
  total_requests INTEGER DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for date queries
CREATE INDEX idx_daily_costs_date ON daily_costs(date DESC);

-- ======================
-- Functions & Triggers
-- ======================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ======================
-- Initial Data
-- ======================

-- Insert default daily_costs entry for today
INSERT INTO daily_costs (date, total_cost_cents, total_requests, total_tokens, unique_users)
VALUES (CURRENT_DATE, 0, 0, 0, 0)
ON CONFLICT (date) DO NOTHING;

-- ======================
-- Verification Queries
-- ======================

-- Show all tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Show all indexes
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;

-- Verify constraints
SELECT conname, contype, conrelid::regclass AS table_name
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY table_name, conname;
