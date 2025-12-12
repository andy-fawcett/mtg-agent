-- Add role column to users table
ALTER TABLE users
ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user';

-- Create index for role lookups
CREATE INDEX idx_users_role ON users(role);

-- Add check constraint for valid roles
ALTER TABLE users
ADD CONSTRAINT chk_user_role
CHECK (role IN ('user', 'admin'));

-- Set first user as admin (if exists)
UPDATE users
SET role = 'admin'
WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1);
