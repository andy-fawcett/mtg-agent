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

  /**
   * Update user tier (admin operation)
   * @returns Object with oldTier and email for logging
   */
  static async updateTier(
    id: string,
    tier: string
  ): Promise<{ oldTier: string; email: string }> {
    // Validate tier
    const validTiers = ['free', 'premium', 'enterprise'];
    if (!validTiers.includes(tier)) {
      throw new Error(`Invalid tier. Must be one of: ${validTiers.join(', ')}`);
    }

    // Get current tier and email for logging
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Update tier
    await query(
      `UPDATE users SET tier = $1, updated_at = NOW() WHERE id = $2`,
      [tier, id]
    );

    return {
      oldTier: user.tier,
      email: user.email,
    };
  }

  /**
   * Update user role (admin operation)
   * @returns Object with oldRole and email for logging
   */
  static async updateRole(
    id: string,
    role: string
  ): Promise<{ oldRole: string; email: string }> {
    // Validate role
    const validRoles = ['user', 'admin'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Get current role and email for logging
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Update role
    await query(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`,
      [role, id]
    );

    return {
      oldRole: user.role,
      email: user.email,
    };
  }

  /**
   * Set user suspension status (admin operation)
   * @returns Object with wasSuspended and email for logging
   */
  static async setSuspension(
    id: string,
    suspended: boolean
  ): Promise<{ wasSuspended: boolean; email: string }> {
    // Validate suspended is boolean
    if (typeof suspended !== 'boolean') {
      throw new Error('suspended must be a boolean');
    }

    // Get current suspension status and email for logging
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Update suspension status
    await query(
      `UPDATE users SET suspended = $1, updated_at = NOW() WHERE id = $2`,
      [suspended, id]
    );

    return {
      wasSuspended: user.suspended,
      email: user.email,
    };
  }
}
