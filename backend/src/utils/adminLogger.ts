import { query as dbQuery } from '../config/database';

interface LogAdminActionParams {
  adminId: string;
  actionType: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log admin actions for audit trail
 * All admin actions should be logged for accountability and troubleshooting
 */
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
    await dbQuery(
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
