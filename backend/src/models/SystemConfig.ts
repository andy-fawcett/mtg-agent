import { query } from '../config/database';

export interface SystemConfigRow {
  key: string;
  value: string;
  description: string | null;
  category: string;
  value_type: string;
  updated_at: Date;
  updated_by: string | null;
}

/**
 * In-memory cache for system configuration
 * Refreshes every 60 seconds to avoid database hits on every request
 */
class SystemConfigCache {
  private cache: Map<string, string> = new Map();
  private lastRefresh: number = 0;
  private refreshInterval: number = 60_000; // 60 seconds

  async get(key: string): Promise<string | null> {
    await this.refreshIfNeeded();
    return this.cache.get(key) || null;
  }

  async getNumber(
    key: string,
    defaultValue: number,
    min?: number,
    max?: number
  ): Promise<number> {
    const value = await this.get(key);
    if (value === null) return defaultValue;
    const parsed = parseInt(value, 10);

    // Return default if not a valid number
    if (isNaN(parsed)) return defaultValue;

    // Validate min/max bounds if specified
    if (min !== undefined && parsed < min) {
      console.warn(`Config ${key}=${parsed} below minimum ${min}, using default ${defaultValue}`);
      return defaultValue;
    }
    if (max !== undefined && parsed > max) {
      console.warn(`Config ${key}=${parsed} above maximum ${max}, using default ${defaultValue}`);
      return defaultValue;
    }

    return parsed;
  }

  async getString(key: string, defaultValue: string): Promise<string> {
    const value = await this.get(key);
    return value || defaultValue;
  }

  async getBoolean(key: string, defaultValue: boolean): Promise<boolean> {
    const value = await this.get(key);
    if (value === null) return defaultValue;
    return value === 'true' || value === '1';
  }

  async set(key: string, value: string, updatedBy?: string): Promise<void> {
    await SystemConfigModel.update(key, value, updatedBy);
    // Force immediate refresh after update
    await this.refresh();
  }

  async refresh(): Promise<void> {
    try {
      const configs = await SystemConfigModel.getAll();
      this.cache.clear();
      for (const config of configs) {
        this.cache.set(config.key, config.value);
      }
      this.lastRefresh = Date.now();
    } catch (error) {
      console.error('Failed to refresh system config cache:', error);
    }
  }

  private async refreshIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRefresh > this.refreshInterval) {
      await this.refresh();
    }
  }

  /**
   * Force an immediate refresh (useful after updates)
   */
  async forceRefresh(): Promise<void> {
    this.lastRefresh = 0;
    await this.refreshIfNeeded();
  }
}

// Global cache instance
export const configCache = new SystemConfigCache();

export class SystemConfigModel {
  /**
   * Get all configuration values
   */
  static async getAll(): Promise<SystemConfigRow[]> {
    const result = await query('SELECT * FROM system_config ORDER BY category, key');
    return result.rows;
  }

  /**
   * Get configurations by category
   */
  static async getByCategory(category: string): Promise<SystemConfigRow[]> {
    const result = await query(
      'SELECT * FROM system_config WHERE category = $1 ORDER BY key',
      [category]
    );
    return result.rows;
  }

  /**
   * Get a single configuration value
   */
  static async get(key: string): Promise<string | null> {
    const result = await query('SELECT value FROM system_config WHERE key = $1', [key]);
    return result.rows.length > 0 ? result.rows[0].value : null;
  }

  /**
   * Update a configuration value
   */
  static async update(key: string, value: string, updatedBy?: string): Promise<void> {
    await query(
      'UPDATE system_config SET value = $1, updated_by = $2 WHERE key = $3',
      [value, updatedBy || null, key]
    );
  }

  /**
   * Bulk update multiple configuration values
   */
  static async updateMany(
    updates: Array<{ key: string; value: string }>,
    updatedBy?: string
  ): Promise<void> {
    for (const update of updates) {
      await this.update(update.key, update.value, updatedBy);
    }
  }
}
