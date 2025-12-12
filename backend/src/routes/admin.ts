import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';
import { query as dbQuery } from '../config/database';
import { UserModel } from '../models/User';
import { logAdminAction } from '../utils/adminLogger';
import { redisClient } from '../config/redis';

const router = Router();

/**
 * Delete all Redis sessions for a specific user
 * This kicks the user out of all active sessions
 */
async function deleteUserSessions(userId: string): Promise<number> {
  let deletedCount = 0;
  let cursor = '0';

  try {
    // Scan all session keys
    do {
      const result = await redisClient.scan(cursor, 'MATCH', 'sess:*', 'COUNT', 100);
      cursor = result[0];
      const keys = result[1];

      // Check each session
      for (const key of keys) {
        const sessionData = await redisClient.get(key);
        if (sessionData) {
          try {
            const session = JSON.parse(sessionData);
            // If this session belongs to the target user, delete it
            if (session.userId === userId) {
              await redisClient.del(key);
              deletedCount++;
            }
          } catch (parseError) {
            // Skip invalid session data
            console.error('Failed to parse session:', parseError);
          }
        }
      }
    } while (cursor !== '0');

    return deletedCount;
  } catch (error) {
    console.error('Failed to delete user sessions:', error);
    throw error;
  }
}

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

    const result = await dbQuery(
      `SELECT
        id, email, role, tier, suspended, email_verified, created_at, updated_at, deleted_at
       FROM users
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await dbQuery('SELECT COUNT(*) FROM users');
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
    const adminId = req.session.userId!;

    // Only allow assignable tiers (no 'anonymous')
    if (!['free', 'premium', 'enterprise'].includes(tier)) {
      return res.status(400).json({ success: false, message: 'Invalid tier' });
    }

    // Get old tier for logging
    const userResult = await dbQuery('SELECT tier, email FROM users WHERE id = $1', [id]);
    const oldTier = userResult.rows[0]?.tier;
    const email = userResult.rows[0]?.email;

    await dbQuery(
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

/**
 * PATCH /api/admin/users/:id/role
 * Update user role (admin/user)
 */
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const adminId = req.session.userId!;

    // Prevent changing your own role
    if (id === adminId) {
      return res.status(400).json({ success: false, message: 'Cannot change your own role' });
    }

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    // Get old role and email for logging
    const userResult = await dbQuery('SELECT role, email FROM users WHERE id = $1', [id]);
    const oldRole = userResult.rows[0]?.role;
    const email = userResult.rows[0]?.email;

    if (!userResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await dbQuery(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
      [role, id]
    );

    // Log the action
    await logAdminAction({
      adminId,
      actionType: 'user_role_change',
      targetType: 'user',
      targetId: id,
      details: { email, oldRole, newRole: role },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ success: true, message: 'Role updated' });
  } catch (error) {
    console.error('Failed to update role:', error);
    res.status(500).json({ success: false, message: 'Failed to update role' });
  }
});

/**
 * PATCH /api/admin/users/:id/suspend
 * Suspend or unsuspend a user account
 * When suspended, user cannot log in and all active sessions are terminated
 */
router.patch('/users/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params;
    const { suspended } = req.body;
    const adminId = req.session.userId!;

    // Prevent suspending yourself
    if (id === adminId) {
      return res.status(400).json({ success: false, message: 'Cannot suspend your own account' });
    }

    if (typeof suspended !== 'boolean') {
      return res.status(400).json({ success: false, message: 'suspended must be a boolean' });
    }

    // Get user info for logging
    const userResult = await dbQuery('SELECT email, suspended FROM users WHERE id = $1 AND deleted_at IS NULL', [id]);

    if (!userResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const email = userResult.rows[0].email;
    const wasSuspended = userResult.rows[0].suspended;

    // Update suspension status
    await dbQuery(
      'UPDATE users SET suspended = $1, updated_at = NOW() WHERE id = $2',
      [suspended, id]
    );

    // If suspending, delete all active sessions to kick them out immediately
    let sessionsDeleted = 0;
    if (suspended) {
      sessionsDeleted = await deleteUserSessions(id);
    }

    // Log the action
    await logAdminAction({
      adminId,
      actionType: suspended ? 'user_suspend' : 'user_unsuspend',
      targetType: 'user',
      targetId: id,
      details: {
        email,
        wasSuspended,
        nowSuspended: suspended,
        sessionsDeleted,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      message: suspended ? 'User suspended and logged out' : 'User unsuspended',
      sessionsDeleted,
    });
  } catch (error) {
    console.error('Failed to update suspension:', error);
    res.status(500).json({ success: false, message: 'Failed to update suspension' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Soft delete user
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.session.userId!;

    // Prevent deleting yourself
    if (id === adminId) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    // Get user email for logging
    const userResult = await dbQuery('SELECT email FROM users WHERE id = $1', [id]);
    const email = userResult.rows[0]?.email;

    await UserModel.delete(id);

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

/**
 * GET /api/admin/analytics/overview
 * Get system-wide analytics
 */
router.get('/analytics/overview', async (req, res) => {
  try {
    // Total users
    const usersResult = await dbQuery('SELECT COUNT(*) FROM users WHERE deleted_at IS NULL');
    const totalUsers = parseInt(usersResult.rows[0].count);

    // Users by tier
    const tierResult = await dbQuery(
      `SELECT tier, COUNT(*) as count
       FROM users
       WHERE deleted_at IS NULL
       GROUP BY tier`
    );

    // Total chats today
    const chatsResult = await dbQuery(
      `SELECT COUNT(*) FROM chat_logs
       WHERE created_at >= CURRENT_DATE`
    );
    const chatsToday = parseInt(chatsResult.rows[0].count);

    // Total cost today
    const costResult = await dbQuery(
      `SELECT COALESCE(SUM(total_cost_cents), 0) as total
       FROM daily_costs
       WHERE date = CURRENT_DATE`
    );
    const costToday = parseInt(costResult.rows[0].total);

    // Total tokens today
    const tokensResult = await dbQuery(
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
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 7, 1), 365);

    const result = await dbQuery(
      `SELECT
        date,
        total_requests,
        total_cost_cents,
        total_tokens,
        unique_users
       FROM daily_costs
       WHERE date >= CURRENT_DATE - INTERVAL '1 day' * $1
       ORDER BY date DESC`,
      [days]
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
    await dbQuery('SELECT 1');
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

    const result = await dbQuery(query, params);

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
    const adminId = req.session.userId!;

    if (!value) {
      return res.status(400).json({ success: false, message: 'Value is required' });
    }

    // Get old value for logging
    const configResult = await dbQuery('SELECT value FROM system_config WHERE key = $1', [key]);
    const oldValue = configResult.rows[0]?.value;

    await dbQuery(
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

/**
 * GET /api/admin/activity
 * Get recent admin actions (audit log)
 */
router.get('/activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await dbQuery(
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

    const result = await dbQuery(
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
    const budgetResult = await dbQuery(
      `SELECT
        COALESCE(SUM(total_cost_cents), 0) as total_cost
       FROM daily_costs
       WHERE date = CURRENT_DATE`
    );
    const costToday = parseInt(budgetResult.rows[0].total_cost);

    const budgetConfig = await dbQuery(
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
    const errorResult = await dbQuery(
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
    await dbQuery('SELECT 1');
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
      await dbQuery(`
        UPDATE system_config
        SET value = '0'
        WHERE key LIKE 'rate_limit.%.tokens_per_day'
      `);
    } else {
      // Restore defaults
      await dbQuery(`
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

export default router;
