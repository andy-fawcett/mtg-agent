-- Migration 009: Create Default Admin Account
-- Creates a default admin account for initial system access
-- Email: admin@mtgagent.com
-- Password: Admin123!@#

-- Create default admin account if it doesn't exist
INSERT INTO users (
  email,
  password_hash,
  role,
  tier,
  email_verified
) VALUES (
  'admin@mtgagent.com',
  '$2b$12$z6..VDf3Tv2bLMxe6wkRHO5P7LJ4UAUdov3tU3JdhtNGBdC60OwOS',
  'admin',
  'premium',
  true
)
ON CONFLICT (email) DO NOTHING;
