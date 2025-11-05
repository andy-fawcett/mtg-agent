# Phase 1.1: Database Layer

**Status:** ⏸️ Not Started
**Duration Estimate:** 6-8 hours
**Prerequisites:** Phase 1.0 (Foundation) complete
**Dependencies:** PostgreSQL running in Docker

## Objectives

Design and implement the complete database layer with PostgreSQL, including schema, migrations, models, and type-safe CRUD operations.

- Design database schema (users, sessions, chat_logs, cost_tracking)
- Create migration system for schema changes
- Implement User model with full TypeScript types
- Build CRUD operations with pg library
- Configure connection pooling for performance
- Add indexes for query optimization
- Implement soft deletes and timestamps

---

## Database Schema Design

### Tables Overview

```sql
-- Users: Authentication and user management
users (
  id, email, password_hash, tier, email_verified,
  created_at, updated_at, deleted_at
)

-- Sessions: Track anonymous and authenticated sessions
sessions (
  id, user_id, session_token, ip_address, user_agent,
  expires_at, created_at
)

-- Chat Logs: Track all chat interactions for analytics
chat_logs (
  id, user_id, session_id, message_length, response_length,
  tokens_used, estimated_cost, tools_used, success,
  error_message, duration_ms, created_at
)

-- Cost Tracking: Daily budget monitoring
daily_costs (
  date, total_cost_cents, total_requests, total_tokens,
  unique_users, updated_at
)
```

---

## Task 1.1.1: Database Configuration

**Estimated Time:** 30 minutes

### Objectives

Create centralized database configuration with connection pooling and error handling.

### Steps

**Create `backend/src/config/database.ts`:**

```typescript
import { Pool, PoolClient, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
const config = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'mtg_agent_dev',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',

  // Connection pool settings
  max: parseInt(process.env.DATABASE_POOL_MAX || '20'),
  min: parseInt(process.env.DATABASE_POOL_MIN || '2'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,

  // SSL for production
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : undefined,
};

// Create connection pool
let pool: Pool | null = null;

export async function getPool(): Promise<Pool> {
  if (!pool) {
    pool = new Pool(config);

    // Handle errors
    pool.on('error', (err) => {
      console.error('Unexpected database error:', err);
    });

    // Handle connection
    pool.on('connect', () => {
      console.log('✓ Database connection established');
    });

    // Test connection
    try {
      const client = await pool.connect();
      console.log('✓ Database pool initialized successfully');
      client.release();
    } catch (error) {
      console.error('✗ Database connection failed:', error);
      throw error;
    }
  }

  return pool;
}

// Helper function for queries
export async function query<T>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = await getPool();
  const start = Date.now();

  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`Query executed in ${duration}ms:`, text.substring(0, 100));
    }

    return result;
  } catch (error) {
    console.error('Query error:', error);
    console.error('Query:', text);
    console.error('Params:', params);
    throw error;
  }
}

// Transaction helper
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Close pool (for graceful shutdown)
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✓ Database pool closed');
  }
}
```

### Verification

```bash
# Test database configuration
cd backend

# Create test file
cat > test-db.ts << 'EOF'
import { getPool, query, closePool } from './src/config/database';

async function test() {
  try {
    // Test connection
    const pool = await getPool();
    console.log('✓ Pool created');

    // Test query
    const result = await query('SELECT NOW() as time, version() as version');
    console.log('✓ Query executed:', result.rows[0]);

    // Close
    await closePool();
    console.log('✓ All tests passed');
  } catch (error) {
    console.error('✗ Test failed:', error);
    process.exit(1);
  }
}

test();
EOF

# Run test
npx tsx test-db.ts

# Cleanup
rm test-db.ts
```

### Success Criteria

- [ ] Database configuration loads from environment
- [ ] Connection pool initializes successfully
- [ ] Can execute queries
- [ ] Transaction helper works
- [ ] Error handling functional
- [ ] Connection pool closes cleanly

---

## Task 1.1.2: Database Schema & Migrations

**Estimated Time:** 90 minutes

### Objectives

Create comprehensive database schema with migrations for all tables, indexes, and constraints.

### Steps

**Create `backend/migrations/` directory:**

```bash
mkdir -p backend/migrations
```

**Create `backend/migrations/001_initial_schema.sql`:**

```sql
-- Migration: 001_initial_schema
-- Description: Initial database schema for MTG Agent
-- Created: 2025-11-01

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

-- Auto-cleanup expired sessions (runs daily)
CREATE INDEX idx_sessions_cleanup ON sessions(expires_at) WHERE expires_at < NOW();

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
  tokens_used INTEGER,
  estimated_cost_cents DECIMAL(10, 4),

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
```

**Create migration runner `backend/src/config/migrations.ts`:**

```typescript
import { query } from './database';
import fs from 'fs';
import path from 'path';

export async function runMigrations(): Promise<void> {
  console.log('Running database migrations...');

  const migrationsDir = path.join(__dirname, '../../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    console.log(`  Running migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    try {
      await query(sql);
      console.log(`  ✓ ${file} completed`);
    } catch (error) {
      console.error(`  ✗ ${file} failed:`, error);
      throw error;
    }
  }

  console.log('✓ All migrations completed');
}
```

### Run Migration

```bash
cd backend

# Create migration runner script
cat > run-migrations.ts << 'EOF'
import { runMigrations } from './src/config/migrations';
import { closePool } from './src/config/database';

async function main() {
  try {
    await runMigrations();
    await closePool();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
EOF

# Run migrations
npx tsx run-migrations.ts

# Cleanup
rm run-migrations.ts
```

### Verification

```bash
# Verify tables created
psql $DATABASE_URL -c "\dt"

# Verify indexes
psql $DATABASE_URL -c "\di"

# Verify users table structure
psql $DATABASE_URL -c "\d users"

# Test insert
psql $DATABASE_URL -c "
INSERT INTO users (email, password_hash, tier)
VALUES ('test@example.com', 'hashed_password', 'free')
RETURNING id, email, tier, created_at;
"

# Test unique constraint
psql $DATABASE_URL -c "
INSERT INTO users (email, password_hash)
VALUES ('test@example.com', 'another_hash');
"
# Should fail with duplicate key error

# Verify triggers
psql $DATABASE_URL -c "
UPDATE users SET tier = 'premium' WHERE email = 'test@example.com';
SELECT email, tier, updated_at FROM users WHERE email = 'test@example.com';
"
# updated_at should be newer than created_at

# Clean up test data
psql $DATABASE_URL -c "DELETE FROM users WHERE email = 'test@example.com';"
```

### Success Criteria

- [ ] All tables created successfully
- [ ] All indexes created
- [ ] Constraints working (unique, foreign keys, check)
- [ ] Triggers working (updated_at)
- [ ] Can insert data
- [ ] Can query data
- [ ] Foreign key cascades work
- [ ] Soft delete field present

---

## Task 1.1.3: User Model & Types

**Estimated Time:** 60 minutes

### Objectives

Create TypeScript types and User model with full CRUD operations.

### Steps

**Create `backend/src/types/database.types.ts`:**

```typescript
// User types
export type UserTier = 'anonymous' | 'free' | 'premium' | 'enterprise';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  tier: UserTier;
  email_verified: boolean;
  oauth_provider: string | null;
  oauth_id: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CreateUserInput {
  email: string;
  password_hash: string;
  tier?: UserTier;
}

export interface UpdateUserInput {
  email?: string;
  password_hash?: string;
  tier?: UserTier;
  email_verified?: boolean;
}

// Session types
export interface Session {
  id: string;
  user_id: string | null;
  session_token: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: Date;
  created_at: Date;
}

// Chat log types
export interface ChatLog {
  id: string;
  user_id: string | null;
  session_id: string | null;
  message_length: number;
  response_length: number | null;
  tokens_used: number | null;
  estimated_cost_cents: number | null;
  tools_used: string[] | null;
  success: boolean;
  error_message: string | null;
  duration_ms: number | null;
  created_at: Date;
}

export interface CreateChatLogInput {
  user_id?: string;
  session_id?: string;
  message_length: number;
  response_length?: number;
  tokens_used?: number;
  estimated_cost_cents?: number;
  tools_used?: string[];
  success: boolean;
  error_message?: string;
  duration_ms?: number;
}

// Daily cost types
export interface DailyCost {
  date: Date;
  total_cost_cents: number;
  total_requests: number;
  total_tokens: number;
  unique_users: number;
  updated_at: Date;
}
```

**Create `backend/src/models/User.ts`:**

```typescript
import { query } from '../config/database';
import { User, CreateUserInput, UpdateUserInput } from '../types/database.types';

export class UserModel {
  /**
   * Create a new user
   */
  static async create(input: CreateUserInput): Promise<User> {
    const { email, password_hash, tier = 'free' } = input;

    const result = await query<User>(
      `INSERT INTO users (email, password_hash, tier)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [email, password_hash, tier]
    );

    return result.rows[0]!;
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<User | null> {
    const result = await query<User>(
      `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const result = await query<User>(
      `SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );

    return result.rows[0] || null;
  }

  /**
   * Update user
   */
  static async update(id: string, input: UpdateUserInput): Promise<User | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(input.email);
    }

    if (input.password_hash !== undefined) {
      updates.push(`password_hash = $${paramCount++}`);
      values.push(input.password_hash);
    }

    if (input.tier !== undefined) {
      updates.push(`tier = $${paramCount++}`);
      values.push(input.tier);
    }

    if (input.email_verified !== undefined) {
      updates.push(`email_verified = $${paramCount++}`);
      values.push(input.email_verified);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await query<User>(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${paramCount} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Soft delete user
   */
  static async delete(id: string): Promise<boolean> {
    const result = await query(
      `UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Count users by tier
   */
  static async countByTier(): Promise<Record<string, number>> {
    const result = await query<{ tier: string; count: string }>(
      `SELECT tier, COUNT(*) as count
       FROM users
       WHERE deleted_at IS NULL
       GROUP BY tier`
    );

    return result.rows.reduce((acc, row) => {
      acc[row.tier] = parseInt(row.count);
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Get user count
   */
  static async count(): Promise<number> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL`
    );

    return parseInt(result.rows[0]!.count);
  }
}
```

### Verification

```bash
# Create test file
cd backend
cat > test-user-model.ts << 'EOF'
import { UserModel } from './src/models/User';
import { closePool } from './src/config/database';

async function test() {
  try {
    console.log('Testing User Model...\n');

    // Test create
    console.log('1. Creating user...');
    const user = await UserModel.create({
      email: 'modeltest@example.com',
      password_hash: 'hashed_password',
      tier: 'free',
    });
    console.log('✓ User created:', user.id);

    // Test findById
    console.log('\n2. Finding by ID...');
    const found = await UserModel.findById(user.id);
    console.log('✓ Found:', found?.email);

    // Test findByEmail
    console.log('\n3. Finding by email...');
    const foundByEmail = await UserModel.findByEmail('modeltest@example.com');
    console.log('✓ Found:', foundByEmail?.id);

    // Test update
    console.log('\n4. Updating tier...');
    const updated = await UserModel.update(user.id, { tier: 'premium' });
    console.log('✓ Updated tier:', updated?.tier);

    // Test count
    console.log('\n5. Counting users...');
    const count = await UserModel.count();
    console.log('✓ Total users:', count);

    // Test countByTier
    console.log('\n6. Counting by tier...');
    const byTier = await UserModel.countByTier();
    console.log('✓ By tier:', byTier);

    // Test soft delete
    console.log('\n7. Soft deleting...');
    const deleted = await UserModel.delete(user.id);
    console.log('✓ Deleted:', deleted);

    // Verify deleted
    console.log('\n8. Verifying deletion...');
    const shouldBeNull = await UserModel.findById(user.id);
    console.log('✓ User not found after delete:', shouldBeNull === null);

    console.log('\n✓ All tests passed!');

    await closePool();
  } catch (error) {
    console.error('✗ Test failed:', error);
    process.exit(1);
  }
}

test();
EOF

# Run test
npx tsx test-user-model.ts

# Cleanup
rm test-user-model.ts
```

### Success Criteria

- [ ] Can create users
- [ ] Can find by ID
- [ ] Can find by email
- [ ] Can update users
- [ ] Can soft delete
- [ ] Count functions work
- [ ] TypeScript types correct
- [ ] No runtime type errors

---

## Task 1.1.4: Chat Logs & Cost Tracking

**Estimated Time:** 45 minutes

### Objectives

Create models for chat logs and daily cost tracking.

### Steps

**Create `backend/src/models/ChatLog.ts`:**

```typescript
import { query } from '../config/database';
import { ChatLog, CreateChatLogInput } from '../types/database.types';

export class ChatLogModel {
  /**
   * Create chat log entry
   */
  static async create(input: CreateChatLogInput): Promise<ChatLog> {
    const result = await query<ChatLog>(
      `INSERT INTO chat_logs (
        user_id, session_id, message_length, response_length,
        tokens_used, estimated_cost_cents, tools_used,
        success, error_message, duration_ms
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        input.user_id || null,
        input.session_id || null,
        input.message_length,
        input.response_length || null,
        input.tokens_used || null,
        input.estimated_cost_cents || null,
        input.tools_used || null,
        input.success,
        input.error_message || null,
        input.duration_ms || null,
      ]
    );

    return result.rows[0]!;
  }

  /**
   * Get user's chat history
   */
  static async getByUserId(
    userId: string,
    limit: number = 50
  ): Promise<ChatLog[]> {
    const result = await query<ChatLog>(
      `SELECT * FROM chat_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * Get today's request count for user
   */
  static async getTodayRequestCount(userId: string): Promise<number> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM chat_logs
       WHERE user_id = $1
       AND created_at >= CURRENT_DATE`,
      [userId]
    );

    return parseInt(result.rows[0]!.count);
  }

  /**
   * Get success rate
   */
  static async getSuccessRate(userId: string): Promise<number> {
    const result = await query<{ success_rate: string }>(
      `SELECT
        CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE (COUNT(*) FILTER (WHERE success = TRUE)::float / COUNT(*)) * 100
        END as success_rate
       FROM chat_logs
       WHERE user_id = $1`,
      [userId]
    );

    return parseFloat(result.rows[0]!.success_rate);
  }
}
```

**Create `backend/src/models/DailyCost.ts`:**

```typescript
import { query, transaction } from '../config/database';
import { DailyCost } from '../types/database.types';

export class DailyCostModel {
  /**
   * Get today's costs
   */
  static async getToday(): Promise<DailyCost> {
    const result = await query<DailyCost>(
      `SELECT * FROM daily_costs WHERE date = CURRENT_DATE`
    );

    // Create if doesn't exist
    if (result.rows.length === 0) {
      return this.createToday();
    }

    return result.rows[0]!;
  }

  /**
   * Create today's entry
   */
  private static async createToday(): Promise<DailyCost> {
    const result = await query<DailyCost>(
      `INSERT INTO daily_costs (date)
       VALUES (CURRENT_DATE)
       ON CONFLICT (date) DO UPDATE SET date = CURRENT_DATE
       RETURNING *`
    );

    return result.rows[0]!;
  }

  /**
   * Add cost to today's total
   */
  static async addCost(
    costCents: number,
    tokens: number,
    userId?: string
  ): Promise<void> {
    await transaction(async (client) => {
      // Update daily totals
      await client.query(
        `INSERT INTO daily_costs (date, total_cost_cents, total_requests, total_tokens)
         VALUES (CURRENT_DATE, $1, 1, $2)
         ON CONFLICT (date) DO UPDATE SET
           total_cost_cents = daily_costs.total_cost_cents + $1,
           total_requests = daily_costs.total_requests + 1,
           total_tokens = daily_costs.total_tokens + $2,
           updated_at = NOW()`,
        [costCents, tokens]
      );

      // Update unique users if userId provided
      if (userId) {
        // Check if user already counted today
        const counted = await client.query(
          `SELECT 1 FROM chat_logs
           WHERE user_id = $1 AND created_at >= CURRENT_DATE
           LIMIT 1`,
          [userId]
        );

        // If first request today, increment unique users
        if (counted.rows.length === 0) {
          await client.query(
            `UPDATE daily_costs
             SET unique_users = unique_users + 1
             WHERE date = CURRENT_DATE`
          );
        }
      }
    });
  }

  /**
   * Get cost for specific date
   */
  static async getByDate(date: Date): Promise<DailyCost | null> {
    const result = await query<DailyCost>(
      `SELECT * FROM daily_costs WHERE date = $1`,
      [date]
    );

    return result.rows[0] || null;
  }

  /**
   * Get last N days of costs
   */
  static async getLastNDays(days: number = 7): Promise<DailyCost[]> {
    const result = await query<DailyCost>(
      `SELECT * FROM daily_costs
       WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY date DESC`
    );

    return result.rows;
  }
}
```

### Verification

```bash
# Test chat logs and cost tracking
cd backend
cat > test-logs-costs.ts << 'EOF'
import { ChatLogModel } from './src/models/ChatLog';
import { DailyCostModel } from './src/models/DailyCost';
import { UserModel } from './src/models/User';
import { closePool } from './src/config/database';

async function test() {
  try {
    console.log('Testing ChatLog and DailyCost Models...\n');

    // Create test user
    const user = await UserModel.create({
      email: 'logtest@example.com',
      password_hash: 'hash',
    });

    // Test chat log
    console.log('1. Creating chat log...');
    const log = await ChatLogModel.create({
      user_id: user.id,
      message_length: 100,
      response_length: 250,
      tokens_used: 500,
      estimated_cost_cents: 5,
      success: true,
      duration_ms: 1234,
    });
    console.log('✓ Chat log created:', log.id);

    // Test get by user
    console.log('\n2. Getting user chat history...');
    const logs = await ChatLogModel.getByUserId(user.id);
    console.log('✓ Found logs:', logs.length);

    // Test today count
    console.log('\n3. Getting today request count...');
    const count = await ChatLogModel.getTodayRequestCount(user.id);
    console.log('✓ Today requests:', count);

    // Test success rate
    console.log('\n4. Getting success rate...');
    const rate = await ChatLogModel.getSuccessRate(user.id);
    console.log('✓ Success rate:', rate, '%');

    // Test daily cost
    console.log('\n5. Getting today costs...');
    const todayCost = await DailyCostModel.getToday();
    console.log('✓ Today cost:', todayCost.total_cost_cents, 'cents');

    // Test add cost
    console.log('\n6. Adding cost...');
    await DailyCostModel.addCost(10, 100, user.id);
    const updated = await DailyCostModel.getToday();
    console.log('✓ Updated cost:', updated.total_cost_cents, 'cents');

    // Test last N days
    console.log('\n7. Getting last 7 days...');
    const lastWeek = await DailyCostModel.getLastNDays(7);
    console.log('✓ Last 7 days:', lastWeek.length, 'days');

    // Cleanup
    await UserModel.delete(user.id);

    console.log('\n✓ All tests passed!');
    await closePool();
  } catch (error) {
    console.error('✗ Test failed:', error);
    process.exit(1);
  }
}

test();
EOF

# Run test
npx tsx test-logs-costs.ts

# Cleanup
rm test-logs-costs.ts
```

### Success Criteria

- [ ] Can create chat logs
- [ ] Can query by user
- [ ] Request counting works
- [ ] Success rate calculation correct
- [ ] Daily cost tracking works
- [ ] Cost addition atomic (transaction)
- [ ] Unique user counting correct
- [ ] Historical data retrieval works

---

## Phase 1.1 Completion Checklist

### Database Configuration
- [ ] Connection pool configured
- [ ] Environment variables loaded
- [ ] Can connect to PostgreSQL
- [ ] Query helper functions work
- [ ] Transaction support implemented
- [ ] Error handling comprehensive

### Schema & Migrations
- [ ] All 4 tables created (users, sessions, chat_logs, daily_costs)
- [ ] All indexes created
- [ ] Foreign keys working
- [ ] Check constraints enforced
- [ ] Triggers working (updated_at)
- [ ] UUID generation working
- [ ] Migration system functional

### Models
- [ ] User model complete with CRUD
- [ ] ChatLog model functional
- [ ] DailyCost model functional
- [ ] All TypeScript types defined
- [ ] No type errors
- [ ] Soft delete working

### Verification
- [ ] All tests pass
- [ ] Can create/read/update/delete users
- [ ] Chat logging works
- [ ] Cost tracking works
- [ ] Transaction handling correct
- [ ] No SQL errors in logs

## Common Issues

### Issue: UUID extension not available

**Solution:**
```sql
-- Run as superuser
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Or use gen_random_uuid() (PostgreSQL 13+)
-- Change in migrations:
-- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

### Issue: Connection pool exhausted

**Solution:**
```typescript
// Increase pool size in .env
DATABASE_POOL_MAX=50

// Or check for connection leaks
// Always use client.release() or query() helper
```

## Rollback Procedure

```bash
# Drop all tables
psql $DATABASE_URL -c "
DROP TABLE IF EXISTS chat_logs CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS daily_costs CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP EXTENSION IF EXISTS \"uuid-ossp\";
"

# Or restore from backup
psql $DATABASE_URL < backup_before_phase_1.1.sql
```

## Next Steps

1. ✅ Verify all checklist items complete
2. ✅ Commit: `feat(database): complete Phase 1.1 - database layer`
3. ➡️ Proceed to [Phase 1.2: Authentication](PHASE_1.2_AUTH.md)

---

**Status:** ⏸️ Not Started
**Last Updated:** 2025-11-01
**Next Phase:** [Phase 1.2: Authentication & Authorization](PHASE_1.2_AUTH.md)
