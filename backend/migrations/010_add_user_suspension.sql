-- Migration 010: Add User Suspension
-- Adds suspended column to track temporarily locked accounts

-- Add suspended column (defaults to false)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT false;

-- Create index for quick lookups of suspended users
CREATE INDEX IF NOT EXISTS idx_users_suspended ON users(suspended) WHERE suspended = true;

-- Add comment for documentation
COMMENT ON COLUMN users.suspended IS 'When true, user account is suspended and cannot log in. All sessions are invalidated on suspension.';
