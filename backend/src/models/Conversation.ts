import { query } from '../config/database';

export interface Conversation {
  id: string;
  userId: string;
  title: string | null;
  totalTokens: number;
  summaryContext: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
  deletedAt: Date | null;
  archivedAt: Date | null;
}

export interface ConversationWithStats extends Conversation {
  messageCount: number;
  lastMessage: string | null;
}

export class ConversationModel {
  /**
   * Create a new conversation
   */
  static async create(userId: string, title?: string): Promise<Conversation> {
    const result = await query<Conversation>(
      `INSERT INTO conversations (user_id, title)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, title || null]
    );

    return this.mapRow(result.rows[0]!);
  }

  /**
   * Get all conversations for a user (excluding archived and deleted)
   */
  static async getByUserId(userId: string): Promise<ConversationWithStats[]> {
    const result = await query(
      `SELECT
        c.*,
        COUNT(cl.id) as message_count,
        (SELECT user_message FROM chat_logs
         WHERE conversation_id = c.id
         ORDER BY created_at DESC
         LIMIT 1) as last_message
       FROM conversations c
       LEFT JOIN chat_logs cl ON cl.conversation_id = c.id
       WHERE c.user_id = $1 AND c.deleted_at IS NULL AND c.archived_at IS NULL
       GROUP BY c.id
       ORDER BY c.last_message_at DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      ...this.mapRow(row),
      messageCount: parseInt(row.message_count) || 0,
      lastMessage: row.last_message,
    }));
  }

  /**
   * Get a specific conversation by ID
   */
  static async getById(id: string, userId: string): Promise<Conversation | null> {
    const result = await query<Conversation>(
      `SELECT * FROM conversations
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Get conversation with token count check
   * Returns conversation along with flags for whether it can continue
   */
  static async getByIdWithTokenCheck(
    id: string,
    userId: string,
    maxTokens: number
  ): Promise<{
    conversation: Conversation;
    canContinue: boolean;
    requiresSummary: boolean;
  }> {
    const conversation = await this.getById(id, userId);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    return {
      conversation,
      canContinue: conversation.totalTokens < maxTokens,
      requiresSummary: conversation.totalTokens >= maxTokens,
    };
  }

  /**
   * Update conversation title
   */
  static async updateTitle(id: string, userId: string, title: string): Promise<void> {
    await query(
      `UPDATE conversations
       SET title = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL`,
      [title, id, userId]
    );
  }

  /**
   * Set summary context for continued conversation
   */
  static async setSummaryContext(id: string, summary: string): Promise<void> {
    await query(
      `UPDATE conversations
       SET summary_context = $1, updated_at = NOW()
       WHERE id = $2`,
      [summary, id]
    );
  }

  /**
   * Archive conversation (soft archive, different from delete)
   * Used when conversation is summarized and continued
   */
  static async archive(id: string): Promise<void> {
    await query(
      `UPDATE conversations
       SET archived_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  /**
   * Soft delete conversation
   */
  static async delete(id: string, userId: string): Promise<void> {
    await query(
      `UPDATE conversations
       SET deleted_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
  }

  /**
   * Generate title from first message
   * Simple implementation: take first 50 chars of message
   */
  static generateTitle(firstMessage: string): string {
    const cleanMessage = firstMessage.trim();
    const title = cleanMessage.substring(0, 50) + (cleanMessage.length > 50 ? '...' : '');
    return title;
  }

  /**
   * Map database row to Conversation interface
   */
  private static mapRow(row: any): Conversation {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      totalTokens: row.total_tokens || 0,
      summaryContext: row.summary_context,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastMessageAt: row.last_message_at,
      deletedAt: row.deleted_at,
      archivedAt: row.archived_at,
    };
  }
}
