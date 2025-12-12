-- Admin Actions Audit Log
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,  -- 'user_tier_change', 'user_delete', 'config_update', etc.
  target_type VARCHAR(50),  -- 'user', 'config', 'system'
  target_id VARCHAR(255),   -- ID of affected resource
  details JSONB,            -- Additional context (old_value, new_value, etc.)
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_admin_actions_admin_id ON admin_actions(admin_id);
CREATE INDEX idx_admin_actions_created_at ON admin_actions(created_at DESC);
CREATE INDEX idx_admin_actions_action_type ON admin_actions(action_type);
