# Phase 1.8: Admin Dashboard

**Status:** ⏸️ Not Started
**Duration Estimate:** 11-13 hours (expanded from 8-10 hours with enhanced features)
**Prerequisites:** Phase 1.7 complete (chat sessions working)
**Dependencies:** Role-based authentication, admin API endpoints

## Objectives

Build a comprehensive admin dashboard for managing the MTG Agent application.

**Core Features:**
- Role-based access control (admin users only)
- User management (view, modify tiers, ban/delete)
- Usage analytics (chat logs, costs, token usage)
- System monitoring (health, rate limits, errors)
- Configuration management (rate limits, budgets, thresholds)
- Responsive admin UI

**Enhanced Features (Added):**
- **Activity/Audit Log** - Track all admin actions with details
- **Top Users Analytics** - Identify power users by cost, tokens, or conversations
- **System Alerts** - Proactive monitoring with budget/error/health alerts
- **Quick Actions** - Emergency mode toggle and cache flush capabilities

---

## Task 1.8.1: Backend - Admin Role Support

**Estimated Time:** 90 minutes

### Objectives

Add role-based authentication to support admin users.

### Steps

**1. Create database migration for role column:**

```bash
cd backend
```

**Create `backend/migrations/007_add_user_roles.sql`:**

```sql
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
```

**Run migration:**

```bash
psql $DATABASE_URL -f migrations/007_add_user_roles.sql
```

**2. Update User model:**

**Update `backend/src/models/User.ts`:**

```typescript
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';  // ADD THIS
  tier: 'anonymous' | 'free' | 'premium';
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// Update create method signature
static async create(email: string, passwordHash: string, role: 'user' | 'admin' = 'user'): Promise<User>
```

**3. Create admin middleware:**

**Create `backend/src/middleware/adminAuth.ts`:**

```typescript
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to require admin role
 * Must be used after requireAuth middleware
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // Check if user is authenticated (should be set by requireAuth)
  if (!req.session?.userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  // Check if user has admin role
  const userRole = req.session.userRole; // We'll add this to session

  if (userRole !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
    return;
  }

  next();
}
```

**4. Update auth middleware to store role in session:**

**Update `backend/src/middleware/auth.ts`:**

```typescript
// In requireAuth middleware, after fetching user:
const user = await User.findById(userId);
if (!user) {
  req.session.destroy(() => {});
  return res.status(401).json({ success: false, message: 'User not found' });
}

// ADD THIS: Store role in session for quick access
req.session.userRole = user.role;
```

**5. Update session type definitions:**

**Update `backend/src/types/session.d.ts`:**

```typescript
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    userRole?: 'user' | 'admin';  // ADD THIS
  }
}
```

### Verification

```bash
# Run migration
psql $DATABASE_URL -f migrations/007_add_user_roles.sql

# Restart server
pnpm run dev

# Test - should return your user with role: 'admin'
curl -X GET http://localhost:3000/api/auth/me \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

### Success Criteria

- [ ] Migration adds role column
- [ ] First user set as admin
- [ ] User model updated with role
- [ ] Admin middleware created
- [ ] Session stores user role
- [ ] Type definitions updated

---

## Task 1.8.2: Backend - Admin API Endpoints

**Estimated Time:** 120 minutes

### Objectives

Create API endpoints for admin functionality.

### Steps

**Create `backend/src/routes/admin.ts`:**

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';
import { pool } from '../db/client';
import { User } from '../models/User';

const router = Router();

// All admin routes require authentication + admin role
router.use(requireAuth, requireAdmin);

/**
 * GET /api/admin/users
 * List all users with pagination
 */
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT
        id, email, role, tier, email_verified, created_at, updated_at, deleted_at
       FROM users
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      users: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

/**
 * PATCH /api/admin/users/:id/tier
 * Update user tier
 */
router.patch('/users/:id/tier', async (req, res) => {
  try {
    const { id } = req.params;
    const { tier } = req.body;

    if (!['free', 'premium'].includes(tier)) {
      return res.status(400).json({ success: false, message: 'Invalid tier' });
    }

    await pool.query(
      'UPDATE users SET tier = $1, updated_at = NOW() WHERE id = $2',
      [tier, id]
    );

    res.json({ success: true, message: 'Tier updated' });
  } catch (error) {
    console.error('Failed to update tier:', error);
    res.status(500).json({ success: false, message: 'Failed to update tier' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Soft delete user
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (id === req.session.userId) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    await User.delete(id);

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Failed to delete user:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

/**
 * GET /api/admin/analytics/overview
 * Get system-wide analytics
 */
router.get('/analytics/overview', async (req, res) => {
  try {
    // Total users
    const usersResult = await pool.query('SELECT COUNT(*) FROM users WHERE deleted_at IS NULL');
    const totalUsers = parseInt(usersResult.rows[0].count);

    // Users by tier
    const tierResult = await pool.query(
      `SELECT tier, COUNT(*) as count
       FROM users
       WHERE deleted_at IS NULL
       GROUP BY tier`
    );

    // Total chats today
    const chatsResult = await pool.query(
      `SELECT COUNT(*) FROM chat_logs
       WHERE created_at >= CURRENT_DATE`
    );
    const chatsToday = parseInt(chatsResult.rows[0].count);

    // Total cost today
    const costResult = await pool.query(
      `SELECT COALESCE(SUM(total_cost_cents), 0) as total
       FROM daily_costs
       WHERE date = CURRENT_DATE`
    );
    const costToday = parseInt(costResult.rows[0].total);

    // Total tokens today
    const tokensResult = await pool.query(
      `SELECT
        COALESCE(SUM(input_tokens), 0) as input,
        COALESCE(SUM(output_tokens), 0) as output
       FROM chat_logs
       WHERE created_at >= CURRENT_DATE`
    );

    res.json({
      success: true,
      analytics: {
        totalUsers,
        usersByTier: tierResult.rows,
        chatsToday,
        costTodayCents: costToday,
        tokensToday: {
          input: parseInt(tokensResult.rows[0].input),
          output: parseInt(tokensResult.rows[0].output),
        },
      },
    });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/admin/analytics/usage
 * Get usage statistics with date range
 */
router.get('/analytics/usage', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;

    const result = await pool.query(
      `SELECT
        date,
        request_count,
        total_cost_cents,
        input_tokens,
        output_tokens
       FROM daily_costs
       WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY date DESC`
    );

    res.json({
      success: true,
      usage: result.rows,
    });
  } catch (error) {
    console.error('Failed to fetch usage:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch usage' });
  }
});

/**
 * GET /api/admin/monitoring/health
 * System health check
 */
router.get('/monitoring/health', async (req, res) => {
  try {
    // Database health
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    const dbLatency = Date.now() - dbStart;

    // Redis health (check if session store is working)
    const redisHealthy = req.session ? true : false;

    res.json({
      success: true,
      health: {
        database: {
          healthy: true,
          latencyMs: dbLatency,
        },
        redis: {
          healthy: redisHealthy,
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ success: false, message: 'Health check failed' });
  }
});

/**
 * GET /api/admin/config
 * Get current system configuration from database
 */
router.get('/config', async (req, res) => {
  try {
    const { category } = req.query;

    let query = 'SELECT * FROM system_config';
    const params: any[] = [];

    if (category) {
      query += ' WHERE category = $1';
      params.push(category);
    }

    query += ' ORDER BY category, key';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      config: result.rows,
    });
  } catch (error) {
    console.error('Failed to fetch config:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch config' });
  }
});

/**
 * PATCH /api/admin/config/:key
 * Update a configuration value
 */
router.patch('/config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const userId = req.session.userId;

    if (!value) {
      return res.status(400).json({ success: false, message: 'Value is required' });
    }

    await pool.query(
      'UPDATE system_config SET value = $1, updated_by = $2 WHERE key = $3',
      [value, userId, key]
    );

    res.json({ success: true, message: 'Configuration updated' });
  } catch (error) {
    console.error('Failed to update config:', error);
    res.status(500).json({ success: false, message: 'Failed to update config' });
  }
});

export default router;
```

**Update `backend/src/index.ts` to include admin routes:**

```typescript
import adminRoutes from './routes/admin';

// ... existing code ...

// Admin routes (protected)
app.use('/api/admin', adminRoutes);
```

### Verification

```bash
# Restart server
pnpm run dev

# Test admin endpoints (replace SESSION_COOKIE with your admin session)
curl -X GET http://localhost:3000/api/admin/users \
  -H "Cookie: connect.sid=SESSION_COOKIE"

curl -X GET http://localhost:3000/api/admin/analytics/overview \
  -H "Cookie: connect.sid=SESSION_COOKIE"

curl -X GET http://localhost:3000/api/admin/monitoring/health \
  -H "Cookie: connect.sid=SESSION_COOKIE"
```

### Success Criteria

- [ ] Admin routes created
- [ ] User management endpoints work
- [ ] Analytics endpoints return data
- [ ] Monitoring endpoints work
- [ ] Only admins can access routes
- [ ] Non-admins get 403 error

---

## Task 1.8.3: Frontend - Admin Dashboard Layout

**Estimated Time:** 90 minutes

### Objectives

Create admin dashboard layout with navigation.

### Steps

**Create `frontend/components/AdminNav.tsx`:**

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/admin', label: 'Overview', icon: '📊' },
    { href: '/admin/users', label: 'Users', icon: '👥' },
    { href: '/admin/analytics', label: 'Analytics', icon: '📈' },
    { href: '/admin/monitoring', label: 'Monitoring', icon: '🔍' },
    { href: '/admin/config', label: 'Config', icon: '⚙️' },
  ];

  return (
    <nav className="bg-gray-800 text-white w-64 min-h-screen p-4">
      <div className="mb-8">
        <h2 className="text-xl font-bold">Admin Dashboard</h2>
        <Link href="/chat" className="text-sm text-gray-400 hover:text-white">
          ← Back to Chat
        </Link>
      </div>

      <ul className="space-y-2">
        {navItems.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`block px-4 py-2 rounded-lg hover:bg-gray-700 ${
                pathname === item.href ? 'bg-gray-700' : ''
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

**Create `frontend/app/admin/layout.tsx`:**

```typescript
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AdminNav from '@/components/AdminNav';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.push('/chat');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      <AdminNav />
      <main className="flex-1 p-8 bg-gray-50">{children}</main>
    </div>
  );
}
```

**Create `frontend/app/admin/page.tsx`:**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Analytics {
  totalUsers: number;
  usersByTier: Array<{ tier: string; count: string }>;
  chatsToday: number;
  costTodayCents: number;
  tokensToday: {
    input: number;
    output: number;
  };
}

export default function AdminOverview() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      const response = await api.get('/api/admin/analytics/overview');
      setAnalytics(response.data.analytics);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!analytics) {
    return <div>Failed to load analytics</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium">Total Users</h3>
          <p className="text-3xl font-bold mt-2">{analytics.totalUsers}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium">Chats Today</h3>
          <p className="text-3xl font-bold mt-2">{analytics.chatsToday}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium">Cost Today</h3>
          <p className="text-3xl font-bold mt-2">
            ${(analytics.costTodayCents / 100).toFixed(2)}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium">Tokens Today</h3>
          <p className="text-3xl font-bold mt-2">
            {(analytics.tokensToday.input + analytics.tokensToday.output).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Users by Tier</h3>
        <div className="space-y-2">
          {analytics.usersByTier.map((item) => (
            <div key={item.tier} className="flex justify-between">
              <span className="capitalize">{item.tier}</span>
              <span className="font-semibold">{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Success Criteria

- [ ] Admin layout created
- [ ] Navigation sidebar works
- [ ] Role-based protection works
- [ ] Overview page shows stats
- [ ] Non-admins redirected

---

## Task 1.8.4: Frontend - User Management Page

**Estimated Time:** 90 minutes

### Objectives

Create user management interface.

### Steps

**Create `frontend/app/admin/users/page.tsx`:**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  role: string;
  tier: string;
  email_verified: boolean;
  created_at: string;
  deleted_at: string | null;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const response = await api.get('/api/admin/users');
      setUsers(response.data.users);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateTier(userId: string, tier: string) {
    try {
      await api.patch(`/api/admin/users/${userId}/tier`, { tier });
      loadUsers(); // Reload
    } catch (error) {
      console.error('Failed to update tier:', error);
      alert('Failed to update tier');
    }
  }

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`Delete user ${email}?`)) return;

    try {
      await api.delete(`/api/admin/users/${userId}`);
      loadUsers(); // Reload
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user');
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">User Management</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Tier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 py-1 rounded ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <select
                    value={user.tier}
                    onChange={(e) => updateTier(user.id, e.target.value)}
                    className="border rounded px-2 py-1"
                    disabled={user.role === 'admin'}
                  >
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {user.role !== 'admin' && (
                    <button
                      onClick={() => deleteUser(user.id, user.email)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Success Criteria

- [ ] User list displays
- [ ] Can change user tier
- [ ] Can delete users
- [ ] Cannot delete admins
- [ ] Changes persist

---

## Task 1.8.5: Backend - Activity Log & Top Users

**Estimated Time:** 60 minutes

### Objectives

Create audit log for admin actions and endpoints for top users by usage/cost.

### Steps

**1. Create admin_actions table migration:**

**Create `backend/migrations/008_add_admin_actions.sql`:**

```sql
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
```

**Run migration:**

```bash
psql $DATABASE_URL -f migrations/008_add_admin_actions.sql
```

**2. Create helper function for logging admin actions:**

**Create `backend/src/utils/adminLogger.ts`:**

```typescript
import { pool } from '../config/database';

interface LogAdminActionParams {
  adminId: string;
  actionType: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAdminAction(params: LogAdminActionParams): Promise<void> {
  const {
    adminId,
    actionType,
    targetType,
    targetId,
    details,
    ipAddress,
    userAgent,
  } = params;

  try {
    await pool.query(
      `INSERT INTO admin_actions
       (admin_id, action_type, target_type, target_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        adminId,
        actionType,
        targetType || null,
        targetId || null,
        details ? JSON.stringify(details) : null,
        ipAddress || null,
        userAgent || null,
      ]
    );
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // Don't throw - logging failures shouldn't break admin operations
  }
}
```

**3. Update admin routes to log actions:**

**Update `backend/src/routes/admin.ts`:**

```typescript
import { logAdminAction } from '../utils/adminLogger';

// In PATCH /api/admin/users/:id/tier
router.patch('/users/:id/tier', async (req, res) => {
  try {
    const { id } = req.params;
    const { tier } = req.body;
    const adminId = req.session.userId!;

    if (!['free', 'premium'].includes(tier)) {
      return res.status(400).json({ success: false, message: 'Invalid tier' });
    }

    // Get old tier for logging
    const userResult = await pool.query('SELECT tier, email FROM users WHERE id = $1', [id]);
    const oldTier = userResult.rows[0]?.tier;
    const email = userResult.rows[0]?.email;

    await pool.query(
      'UPDATE users SET tier = $1, updated_at = NOW() WHERE id = $2',
      [tier, id]
    );

    // Log the action
    await logAdminAction({
      adminId,
      actionType: 'user_tier_change',
      targetType: 'user',
      targetId: id,
      details: { email, oldTier, newTier: tier },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ success: true, message: 'Tier updated' });
  } catch (error) {
    console.error('Failed to update tier:', error);
    res.status(500).json({ success: false, message: 'Failed to update tier' });
  }
});

// In DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.session.userId!;

    if (id === adminId) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    // Get user email for logging
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [id]);
    const email = userResult.rows[0]?.email;

    await User.delete(id);

    // Log the action
    await logAdminAction({
      adminId,
      actionType: 'user_delete',
      targetType: 'user',
      targetId: id,
      details: { email },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Failed to delete user:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

// In PATCH /api/admin/config/:key
router.patch('/config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const adminId = req.session.userId!;

    if (!value) {
      return res.status(400).json({ success: false, message: 'Value is required' });
    }

    // Get old value for logging
    const configResult = await pool.query('SELECT value FROM system_config WHERE key = $1', [key]);
    const oldValue = configResult.rows[0]?.value;

    await pool.query(
      'UPDATE system_config SET value = $1, updated_by = $2 WHERE key = $3',
      [value, adminId, key]
    );

    // Log the action
    await logAdminAction({
      adminId,
      actionType: 'config_update',
      targetType: 'config',
      targetId: key,
      details: { key, oldValue, newValue: value },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ success: true, message: 'Configuration updated' });
  } catch (error) {
    console.error('Failed to update config:', error);
    res.status(500).json({ success: false, message: 'Failed to update config' });
  }
});
```

**4. Add activity log endpoint:**

```typescript
/**
 * GET /api/admin/activity
 * Get recent admin actions (audit log)
 */
router.get('/activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await pool.query(
      `SELECT
        aa.*,
        u.email as admin_email
       FROM admin_actions aa
       JOIN users u ON aa.admin_id = u.id
       ORDER BY aa.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      success: true,
      actions: result.rows,
    });
  } catch (error) {
    console.error('Failed to fetch activity log:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch activity log' });
  }
});
```

**5. Add top users endpoint:**

```typescript
/**
 * GET /api/admin/analytics/top-users
 * Get top users by cost, tokens, or conversations
 */
router.get('/analytics/top-users', async (req, res) => {
  try {
    const metric = req.query.metric || 'cost';
    const limit = parseInt(req.query.limit as string) || 10;

    let orderBy = 'total_cost DESC';
    let selectMetric = 'COALESCE(SUM(cl.actual_cost_cents), 0) as total_cost';

    if (metric === 'tokens') {
      orderBy = 'total_tokens DESC';
      selectMetric = 'COALESCE(SUM(cl.tokens_used), 0) as total_tokens';
    } else if (metric === 'conversations') {
      orderBy = 'conversation_count DESC';
      selectMetric = 'COUNT(DISTINCT cl.conversation_id) as conversation_count';
    }

    const result = await pool.query(
      `SELECT
        u.id,
        u.email,
        u.tier,
        ${selectMetric},
        COUNT(cl.id) as total_requests,
        MAX(cl.created_at) as last_activity
       FROM users u
       LEFT JOIN chat_logs cl ON u.id = cl.user_id
       WHERE u.deleted_at IS NULL
       GROUP BY u.id, u.email, u.tier
       ORDER BY ${orderBy}
       LIMIT $1`,
      [limit]
    );

    res.json({
      success: true,
      topUsers: result.rows,
      metric,
    });
  } catch (error) {
    console.error('Failed to fetch top users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch top users' });
  }
});
```

### Verification

```bash
# Run migration
psql $DATABASE_URL -f migrations/008_add_admin_actions.sql

# Restart server
pnpm run dev

# Test activity log endpoint
curl -X GET http://localhost:3000/api/admin/activity \
  -H "Cookie: connect.sid=ADMIN_SESSION_COOKIE"

# Test top users endpoint
curl -X GET "http://localhost:3000/api/admin/analytics/top-users?metric=cost&limit=10" \
  -H "Cookie: connect.sid=ADMIN_SESSION_COOKIE"
```

### Success Criteria

- [ ] admin_actions table created
- [ ] Admin actions logged automatically
- [ ] Activity log endpoint returns data
- [ ] Top users endpoint works (cost, tokens, conversations)
- [ ] Logging doesn't break admin operations

---

## Task 1.8.6: Backend - System Alerts & Quick Actions

**Estimated Time:** 45 minutes

### Objectives

Add system alert detection and emergency action endpoints.

### Steps

**1. Create alerts endpoint:**

**Add to `backend/src/routes/admin.ts`:**

```typescript
/**
 * GET /api/admin/alerts
 * Get current system alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    const alerts: Array<{
      type: string;
      severity: 'info' | 'warning' | 'critical';
      message: string;
      value?: number;
      threshold?: number;
    }> = [];

    // Check budget status
    const budgetResult = await pool.query(
      `SELECT
        COALESCE(SUM(total_cost_cents), 0) as total_cost
       FROM daily_costs
       WHERE date = CURRENT_DATE`
    );
    const costToday = parseInt(budgetResult.rows[0].total_cost);

    const budgetConfig = await pool.query(
      `SELECT value FROM system_config WHERE key = 'budget.daily_cents'`
    );
    const budgetLimit = parseInt(budgetConfig.rows[0]?.value || '100');

    const budgetPercent = (costToday / budgetLimit) * 100;

    if (budgetPercent >= 90) {
      alerts.push({
        type: 'budget',
        severity: 'critical',
        message: `Budget at ${budgetPercent.toFixed(1)}% of daily limit`,
        value: costToday,
        threshold: budgetLimit,
      });
    } else if (budgetPercent >= 75) {
      alerts.push({
        type: 'budget',
        severity: 'warning',
        message: `Budget at ${budgetPercent.toFixed(1)}% of daily limit`,
        value: costToday,
        threshold: budgetLimit,
      });
    }

    // Check error rate
    const errorResult = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE success = false) as errors,
        COUNT(*) as total
       FROM chat_logs
       WHERE created_at >= NOW() - INTERVAL '1 hour'`
    );

    const errors = parseInt(errorResult.rows[0].errors);
    const total = parseInt(errorResult.rows[0].total);
    const errorRate = total > 0 ? (errors / total) * 100 : 0;

    if (errorRate > 5) {
      alerts.push({
        type: 'error_rate',
        severity: 'critical',
        message: `Error rate at ${errorRate.toFixed(1)}% (last hour)`,
        value: errorRate,
        threshold: 5,
      });
    } else if (errorRate > 2) {
      alerts.push({
        type: 'error_rate',
        severity: 'warning',
        message: `Error rate at ${errorRate.toFixed(1)}% (last hour)`,
        value: errorRate,
        threshold: 2,
      });
    }

    // Check database latency
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    const dbLatency = Date.now() - dbStart;

    if (dbLatency > 500) {
      alerts.push({
        type: 'database',
        severity: 'warning',
        message: `Database latency high: ${dbLatency}ms`,
        value: dbLatency,
        threshold: 500,
      });
    }

    res.json({
      success: true,
      alerts,
      count: alerts.length,
    });
  } catch (error) {
    console.error('Failed to fetch alerts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch alerts' });
  }
});
```

**2. Add quick actions endpoints:**

```typescript
/**
 * POST /api/admin/actions/emergency-mode
 * Enable/disable emergency mode (pauses all non-admin chat)
 */
router.post('/actions/emergency-mode', async (req, res) => {
  try {
    const { enabled } = req.body;
    const adminId = req.session.userId!;

    // Set all tier limits to 0 (or restore defaults)
    if (enabled) {
      await pool.query(`
        UPDATE system_config
        SET value = '0'
        WHERE key LIKE 'rate_limit.%.tokens_per_day'
      `);
    } else {
      // Restore defaults
      await pool.query(`
        UPDATE system_config
        SET value = CASE key
          WHEN 'rate_limit.free.tokens_per_day' THEN '100000'
          WHEN 'rate_limit.premium.tokens_per_day' THEN '1000000'
          WHEN 'rate_limit.enterprise.tokens_per_day' THEN '10000000'
        END
        WHERE key LIKE 'rate_limit.%.tokens_per_day'
      `);
    }

    // Log the action
    await logAdminAction({
      adminId,
      actionType: 'emergency_mode',
      targetType: 'system',
      details: { enabled },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      message: enabled ? 'Emergency mode enabled' : 'Emergency mode disabled'
    });
  } catch (error) {
    console.error('Failed to toggle emergency mode:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle emergency mode' });
  }
});

/**
 * POST /api/admin/actions/flush-cache
 * Flush Redis cache (clear rate limit counters)
 */
router.post('/actions/flush-cache', async (req, res) => {
  try {
    const adminId = req.session.userId!;

    // Import redis client
    const redis = require('../config/redis').default;

    // Flush all Redis data (WARNING: also clears sessions)
    // In production, you might want to be more selective
    await redis.flushdb();

    // Log the action
    await logAdminAction({
      adminId,
      actionType: 'flush_cache',
      targetType: 'system',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ success: true, message: 'Cache flushed successfully' });
  } catch (error) {
    console.error('Failed to flush cache:', error);
    res.status(500).json({ success: false, message: 'Failed to flush cache' });
  }
});
```

### Verification

```bash
# Test alerts endpoint
curl -X GET http://localhost:3000/api/admin/alerts \
  -H "Cookie: connect.sid=ADMIN_SESSION_COOKIE"

# Test emergency mode
curl -X POST http://localhost:3000/api/admin/actions/emergency-mode \
  -H "Cookie: connect.sid=ADMIN_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# Test cache flush
curl -X POST http://localhost:3000/api/admin/actions/flush-cache \
  -H "Cookie: connect.sid=ADMIN_SESSION_COOKIE"
```

### Success Criteria

- [ ] Alerts endpoint detects budget issues
- [ ] Alerts endpoint detects high error rates
- [ ] Alerts endpoint checks database health
- [ ] Emergency mode toggles rate limits
- [ ] Cache flush clears Redis
- [ ] All actions logged to admin_actions

---

## Task 1.8.7: Frontend - Analytics, Monitoring, Config Pages

**Estimated Time:** 120 minutes

### Objectives

Create remaining admin pages (analytics, monitoring, configuration).

### Steps

Create the following pages following similar patterns to the user management page:

1. `frontend/app/admin/analytics/page.tsx` - Usage charts and trends
2. `frontend/app/admin/monitoring/page.tsx` - System health dashboard
3. `frontend/app/admin/config/page.tsx` - Configuration settings

(Detailed implementations provided in follow-up tasks)

### Success Criteria

- [ ] All admin pages functional
- [ ] Data displays correctly
- [ ] Responsive design
- [ ] Error handling works

---

## Task 1.8.8: Frontend - Activity Log, Top Users, Alerts

**Estimated Time:** 90 minutes

### Objectives

Create UI for activity log, top users, and system alerts.

### Steps

**1. Update AdminNav to show alert badge:**

**Update `frontend/components/AdminNav.tsx`:**

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminNav() {
  const pathname = usePathname();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  async function loadAlerts() {
    try {
      const response = await api.get('/api/admin/alerts');
      setAlertCount(response.data.count);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  }

  const navItems = [
    { href: '/admin', label: 'Overview', icon: '📊' },
    { href: '/admin/users', label: 'Users', icon: '👥' },
    { href: '/admin/analytics', label: 'Analytics', icon: '📈' },
    { href: '/admin/monitoring', label: 'Monitoring', icon: '🔍', badge: alertCount },
    { href: '/admin/activity', label: 'Activity Log', icon: '📝' },
    { href: '/admin/config', label: 'Config', icon: '⚙️' },
  ];

  return (
    <nav className="bg-gray-800 text-white w-64 min-h-screen p-4">
      <div className="mb-8">
        <h2 className="text-xl font-bold">Admin Dashboard</h2>
        <Link href="/chat" className="text-sm text-gray-400 hover:text-white">
          ← Back to Chat
        </Link>
      </div>

      <ul className="space-y-2">
        {navItems.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`block px-4 py-2 rounded-lg hover:bg-gray-700 ${
                pathname === item.href ? 'bg-gray-700' : ''
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
              {item.badge ? (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

**2. Create Activity Log page:**

**Create `frontend/app/admin/activity/page.tsx`:**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface AdminAction {
  id: string;
  admin_email: string;
  action_type: string;
  target_type: string;
  target_id: string;
  details: any;
  created_at: string;
}

export default function ActivityLog() {
  const [actions, setActions] = useState<AdminAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActions();
  }, []);

  async function loadActions() {
    try {
      const response = await api.get('/api/admin/activity?limit=100');
      setActions(response.data.actions);
    } catch (error) {
      console.error('Failed to load activity log:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatAction(action: AdminAction): string {
    const details = action.details || {};

    switch (action.action_type) {
      case 'user_tier_change':
        return `Changed ${details.email}'s tier from ${details.oldTier} to ${details.newTier}`;
      case 'user_delete':
        return `Deleted user ${details.email}`;
      case 'config_update':
        return `Updated ${details.key} from ${details.oldValue} to ${details.newValue}`;
      case 'emergency_mode':
        return `${details.enabled ? 'Enabled' : 'Disabled'} emergency mode`;
      case 'flush_cache':
        return 'Flushed Redis cache';
      default:
        return action.action_type;
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Activity Log</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Admin
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {actions.map((action) => (
              <tr key={action.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(action.created_at).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {action.admin_email}
                </td>
                <td className="px-6 py-4 text-sm">
                  {formatAction(action)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**3. Update Overview page with Top Users and Alerts:**

**Update `frontend/app/admin/page.tsx`:**

```typescript
// Add to existing Overview page

const [topUsers, setTopUsers] = useState<any[]>([]);
const [alerts, setAlerts] = useState<any[]>([]);

useEffect(() => {
  loadAnalytics();
  loadTopUsers();
  loadAlerts();
}, []);

async function loadTopUsers() {
  try {
    const response = await api.get('/api/admin/analytics/top-users?metric=cost&limit=5');
    setTopUsers(response.data.topUsers);
  } catch (error) {
    console.error('Failed to load top users:', error);
  }
}

async function loadAlerts() {
  try {
    const response = await api.get('/api/admin/alerts');
    setAlerts(response.data.alerts);
  } catch (error) {
    console.error('Failed to load alerts:', error);
  }
}

// Add to JSX:
{alerts.length > 0 && (
  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
    <div className="flex">
      <div className="flex-shrink-0">
        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="ml-3">
        <h3 className="text-sm font-medium text-yellow-800">
          System Alerts ({alerts.length})
        </h3>
        <div className="mt-2 text-sm text-yellow-700">
          <ul className="list-disc list-inside space-y-1">
            {alerts.map((alert, idx) => (
              <li key={idx}>{alert.message}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </div>
)}

<div className="bg-white p-6 rounded-lg shadow mb-8">
  <h3 className="text-lg font-semibold mb-4">Top Users by Cost</h3>
  <div className="space-y-2">
    {topUsers.map((user) => (
      <div key={user.id} className="flex justify-between items-center border-b pb-2">
        <div>
          <span className="font-medium">{user.email}</span>
          <span className="ml-2 text-sm text-gray-500">({user.tier})</span>
        </div>
        <div className="text-right">
          <div className="font-semibold">${(user.total_cost / 100).toFixed(2)}</div>
          <div className="text-sm text-gray-500">{user.total_requests} requests</div>
        </div>
      </div>
    ))}
  </div>
</div>
```

**4. Add Quick Actions to Monitoring page:**

Create emergency mode toggle and cache flush buttons on the monitoring page.

### Success Criteria

- [ ] Activity log displays recent actions
- [ ] Top users shown on overview
- [ ] Alerts displayed with severity
- [ ] Alert badge updates in navigation
- [ ] Quick actions work (emergency mode, cache flush)

---

## Phase 1.8 Completion Checklist

### Backend
- [ ] Role column added to users (migration 007)
- [ ] Admin middleware created
- [ ] Admin API endpoints working (users, analytics, monitoring, config)
- [ ] Session stores user role
- [ ] Non-admins blocked from admin routes
- [ ] **Activity log table created (migration 008)**
- [ ] **Admin actions automatically logged**
- [ ] **Top users endpoint (cost, tokens, conversations)**
- [ ] **System alerts endpoint**
- [ ] **Emergency mode quick action**
- [ ] **Cache flush quick action**

### Frontend
- [ ] Admin layout with navigation
- [ ] Overview page shows analytics
- [ ] User management works
- [ ] Analytics page displays data
- [ ] Monitoring page shows health
- [ ] Config page displays settings (with update capability)
- [ ] **Activity log page displays audit trail**
- [ ] **Top users displayed on overview**
- [ ] **System alerts shown on overview**
- [ ] **Alert badge in navigation**
- [ ] **Quick actions on monitoring page**
- [ ] Role-based route protection

### Security
- [ ] Only admins can access admin routes
- [ ] Cannot delete own admin account
- [ ] All admin actions logged with details
- [ ] Session-based authentication
- [ ] No sensitive data exposed
- [ ] IP address and user agent tracked in audit log

## Next Steps

1. ✅ Complete all checklist items
2. ✅ Test all admin functionality
3. ✅ Update STATUS.md
4. ✅ Commit: `feat(admin): complete Phase 1.8`
5. ➡️ Proceed to [Phase 1.9: Testing](PHASE_1.9_TESTING.md)

---

**Status:** ⏸️ Not Started
**Last Updated:** 2025-11-11
**Next Phase:** [Phase 1.9: Integration & Testing](PHASE_1.9_TESTING.md)
