# Phase 1.7: Admin Dashboard

**Status:** ⏸️ Not Started
**Duration Estimate:** 8-10 hours
**Prerequisites:** Phase 1.6 complete (frontend application working)
**Dependencies:** Role-based authentication, admin API endpoints

## Objectives

Build a comprehensive admin dashboard for managing the MTG Agent application.

- Role-based access control (admin users only)
- User management (view, modify tiers, ban/delete)
- Usage analytics (chat logs, costs, token usage)
- System monitoring (health, rate limits, errors)
- Configuration management (rate limits, budgets, thresholds)
- Responsive admin UI

---

## Task 1.7.1: Backend - Admin Role Support

**Estimated Time:** 90 minutes

### Objectives

Add role-based authentication to support admin users.

### Steps

**1. Create database migration for role column:**

```bash
cd backend
```

**Create `backend/src/db/migrations/005_add_user_roles.sql`:**

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
psql $DATABASE_URL -f src/db/migrations/005_add_user_roles.sql
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
psql $DATABASE_URL -f src/db/migrations/005_add_user_roles.sql

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

## Task 1.7.2: Backend - Admin API Endpoints

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
 * GET /api/admin/config/rate-limits
 * Get current rate limit configuration
 */
router.get('/config/rate-limits', async (req, res) => {
  try {
    // Return current rate limit settings from environment
    res.json({
      success: true,
      config: {
        anonymous: {
          dailyLimit: parseInt(process.env.RATE_LIMIT_ANONYMOUS || '3'),
          perMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '10'),
        },
        free: {
          dailyLimit: parseInt(process.env.RATE_LIMIT_FREE || '50'),
        },
        premium: {
          dailyLimit: parseInt(process.env.RATE_LIMIT_PREMIUM || '500'),
        },
        budget: {
          dailyCapCents: parseInt(process.env.DAILY_BUDGET_CAP_CENTS || '1000'),
        },
      },
    });
  } catch (error) {
    console.error('Failed to fetch config:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch config' });
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

## Task 1.7.3: Frontend - Admin Dashboard Layout

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

## Task 1.7.4: Frontend - User Management Page

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

## Task 1.7.5: Frontend - Analytics, Monitoring, Config Pages

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

## Phase 1.7 Completion Checklist

### Backend
- [ ] Role column added to users
- [ ] Admin middleware created
- [ ] Admin API endpoints working
- [ ] Session stores user role
- [ ] Non-admins blocked from admin routes

### Frontend
- [ ] Admin layout with navigation
- [ ] Overview page shows analytics
- [ ] User management works
- [ ] Analytics page displays data
- [ ] Monitoring page shows health
- [ ] Config page displays settings
- [ ] Role-based route protection

### Security
- [ ] Only admins can access admin routes
- [ ] Cannot delete own admin account
- [ ] All admin actions logged
- [ ] Session-based authentication
- [ ] No sensitive data exposed

## Next Steps

1. ✅ Complete all checklist items
2. ✅ Test all admin functionality
3. ✅ Update STATUS.md
4. ✅ Commit: `feat(admin): complete Phase 1.7`
5. ➡️ Proceed to [Phase 1.8: Testing](PHASE_1.8_TESTING.md)

---

**Status:** ⏸️ Not Started
**Last Updated:** 2025-11-11
**Next Phase:** [Phase 1.8: Integration & Testing](PHASE_1.8_TESTING.md)
