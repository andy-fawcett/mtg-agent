-- ======================
-- Phase 1.7: Chat Sessions & Conversation History
-- ======================
-- This migration adds support for:
-- - Multiple conversation threads per user
-- - Persistent message storage
-- - Token tracking per user and conversation
-- - Conversation archival and summarization

-- ======================
-- Conversations Table
-- ======================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Conversation metadata
  title VARCHAR(255),

  -- Token tracking (NEW)
  total_tokens INTEGER DEFAULT 0,
  summary_context TEXT,  -- Stores summary from previous conversation if continued

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP DEFAULT NOW(),

  -- Soft delete / archive
  deleted_at TIMESTAMP,
  archived_at TIMESTAMP  -- NEW: Archived when summarized and continued
);

-- Indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_updated ON conversations(user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_last_message ON conversations(user_id, last_message_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_archived ON conversations(user_id, archived_at) WHERE archived_at IS NOT NULL;

-- ======================
-- Update Chat Logs Table
-- ======================

-- Add conversation_id column
ALTER TABLE chat_logs
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;

-- Create index for conversation lookups
CREATE INDEX IF NOT EXISTS idx_chat_logs_conversation ON chat_logs(conversation_id, created_at);

-- Add columns to store actual message content
ALTER TABLE chat_logs
ADD COLUMN IF NOT EXISTS user_message TEXT NOT NULL DEFAULT '';

ALTER TABLE chat_logs
ADD COLUMN IF NOT EXISTS assistant_response TEXT;

-- Remove default after adding column (for future inserts)
ALTER TABLE chat_logs
ALTER COLUMN user_message DROP DEFAULT;

-- Update trigger to update conversation's last_message_at
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON chat_logs;
CREATE TRIGGER trigger_update_conversation_timestamp
AFTER INSERT ON chat_logs
FOR EACH ROW
WHEN (NEW.conversation_id IS NOT NULL)
EXECUTE FUNCTION update_conversation_timestamp();

-- ======================
-- User Daily Token Usage (NEW)
-- ======================
CREATE TABLE IF NOT EXISTS user_daily_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Token tracking (input + output combined)
  total_tokens_used INTEGER DEFAULT 0,
  request_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- One record per user per day
  UNIQUE(user_id, date)
);

-- Indexes
CREATE INDEX idx_user_daily_tokens_user ON user_daily_tokens(user_id, date DESC);
CREATE INDEX idx_user_daily_tokens_date ON user_daily_tokens(date);

-- Trigger to update conversation total_tokens on chat_log insert
CREATE OR REPLACE FUNCTION update_conversation_tokens()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET total_tokens = total_tokens + NEW.tokens_used
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_conversation_tokens ON chat_logs;
CREATE TRIGGER trigger_update_conversation_tokens
AFTER INSERT ON chat_logs
FOR EACH ROW
WHEN (NEW.conversation_id IS NOT NULL AND NEW.tokens_used IS NOT NULL)
EXECUTE FUNCTION update_conversation_tokens();

-- ======================
-- Migration Complete
-- ======================
-- Phase 1.7 database schema ready
