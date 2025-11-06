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
