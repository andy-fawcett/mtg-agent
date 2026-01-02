# Phase 2.1: Deck Backend & API

**Status:** ⏸️ Not Started
**Estimated Time:** 6-8 hours
**Prerequisites:** Phase 2.0 (Card Database) complete ✅

---

## Overview

Build a complete deck management system with CRUD operations, card management, import/export functionality, and full Commander format support. Includes audit logging for deck changes and soft validation based on deck format.

---

## Objectives

- Create database schema for decks, deck cards, and audit logs
- Implement deck CRUD operations (create, read, update, delete)
- Build card management (add/remove/update cards in deck)
- Support all deck sections (main, sideboard, maybeboard, commander)
- Import/export decks (text format, Arena format)
- Full Commander support (commander slot, partner commanders, color identity)
- Soft validation with format-specific warnings
- Audit log for tracking deck changes
- Calculate deck stats on-demand (mana curve, colors, price)

---

## Database Schema

### Migration 016: Decks Table

```sql
-- backend/src/migrations/016_create_decks_table.sql

CREATE TABLE decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Core fields
  name VARCHAR(200) NOT NULL,
  format VARCHAR(50) NOT NULL, -- 'standard', 'modern', 'commander', 'pioneer', etc.
  description TEXT,
  notes TEXT, -- Private notes for deck builder

  -- Colors (derived from cards, stored as array)
  colors TEXT[], -- ['W', 'U', 'B', 'R', 'G']

  -- Commander-specific
  commander_id UUID REFERENCES cards(id) ON DELETE RESTRICT,
  partner_commander_id UUID REFERENCES cards(id) ON DELETE RESTRICT,

  -- Tags for organization
  tags TEXT[], -- ['aggro', 'budget', 'competitive']

  -- Privacy (future-proofing)
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_unlisted BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_decks_user_id ON decks(user_id);
CREATE INDEX idx_decks_format ON decks(format);
CREATE INDEX idx_decks_colors ON decks USING GIN(colors);
CREATE INDEX idx_decks_tags ON decks USING GIN(tags);
CREATE INDEX idx_decks_created_at ON decks(created_at DESC);
CREATE INDEX idx_decks_deleted_at ON decks(deleted_at) WHERE deleted_at IS NULL; -- Only active decks

-- Auto-update updated_at trigger
CREATE TRIGGER decks_updated_at_trigger
  BEFORE UPDATE ON decks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Constraint: Format must be valid
CREATE TYPE deck_format AS ENUM (
  'standard', 'modern', 'pioneer', 'legacy', 'vintage',
  'commander', 'brawl', 'pauper', 'historic', 'explorer',
  'alchemy', 'timeless', 'oathbreaker', 'duel_commander',
  'penny_dreadful', 'premodern', 'oldschool', 'casual'
);

ALTER TABLE decks
  ALTER COLUMN format TYPE deck_format USING format::deck_format;
```

### Migration 017: Deck Cards Table

```sql
-- backend/src/migrations/017_create_deck_cards_table.sql

CREATE TABLE deck_cards (
  id SERIAL PRIMARY KEY,

  -- Deck reference
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,

  -- Card reference (RESTRICT to protect data integrity during card sync)
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,

  -- Quantity
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 100),

  -- Board type
  board_type VARCHAR(20) NOT NULL DEFAULT 'main',
  -- 'main', 'sideboard', 'maybeboard', 'commander'

  -- Timestamps
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Unique constraint: One card per board per deck
  CONSTRAINT unique_deck_card_board UNIQUE (deck_id, card_id, board_type)
);

-- Indexes
CREATE INDEX idx_deck_cards_deck_id ON deck_cards(deck_id);
CREATE INDEX idx_deck_cards_card_id ON deck_cards(card_id);
CREATE INDEX idx_deck_cards_board_type ON deck_cards(board_type);

-- Constraint: board_type must be valid
ALTER TABLE deck_cards
  ADD CONSTRAINT valid_board_type
  CHECK (board_type IN ('main', 'sideboard', 'maybeboard', 'commander'));
```

### Migration 018: Deck Audit Log Table

```sql
-- backend/src/migrations/018_create_deck_audit_log_table.sql

CREATE TABLE deck_audit_log (
  id SERIAL PRIMARY KEY,

  -- Deck reference
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,

  -- User who made the change
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  -- Action type
  action_type VARCHAR(50) NOT NULL,
  -- 'created', 'updated', 'deleted', 'card_added', 'card_removed', 'card_updated', 'imported', 'duplicated'

  -- Change details (JSONB for flexibility)
  changes JSONB,
  -- Example: {"field": "name", "old": "Old Name", "new": "New Name"}
  -- Example: {"card_id": "uuid", "card_name": "Lightning Bolt", "quantity": 4, "board": "main"}

  -- Timestamp
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_deck_audit_log_deck_id ON deck_audit_log(deck_id);
CREATE INDEX idx_deck_audit_log_user_id ON deck_audit_log(user_id);
CREATE INDEX idx_deck_audit_log_created_at ON deck_audit_log(created_at DESC);
CREATE INDEX idx_deck_audit_log_action_type ON deck_audit_log(action_type);
```

---

## TypeScript Types

**Create:** `backend/src/types/deck.types.ts`

```typescript
export type DeckFormat =
  | 'standard' | 'modern' | 'pioneer' | 'legacy' | 'vintage'
  | 'commander' | 'brawl' | 'pauper' | 'historic' | 'explorer'
  | 'alchemy' | 'timeless' | 'oathbreaker' | 'duel_commander'
  | 'penny_dreadful' | 'premodern' | 'oldschool' | 'casual';

export type BoardType = 'main' | 'sideboard' | 'maybeboard' | 'commander';

export interface Deck {
  id: string;
  user_id: string;
  name: string;
  format: DeckFormat;
  description?: string;
  notes?: string;
  colors: string[];
  commander_id?: string;
  partner_commander_id?: string;
  tags: string[];
  is_public: boolean;
  is_unlisted: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface DeckCard {
  id: number;
  deck_id: string;
  card_id: string;
  quantity: number;
  board_type: BoardType;
  added_at: Date;
}

export interface DeckWithCards extends Deck {
  cards: {
    main: DeckCard[];
    sideboard: DeckCard[];
    maybeboard: DeckCard[];
    commander: DeckCard[];
  };
}

export interface DeckStats {
  totalCards: number;
  mainDeckCards: number;
  sideboardCards: number;
  maybeboardCards: number;
  commanderCards: number;
  averageCmc: number;
  totalPriceUsd: number;
  colorDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
  manaCurve: Record<number, number>;
}

export interface DeckValidationWarning {
  type: 'error' | 'warning';
  message: string;
  field?: string;
}
```

---

## Implementation Tasks

### Task 1: Create Database Migrations (20 min)

**Steps:**
1. Create migration files (014, 015, 016)
2. Add schemas from above
3. Run migrations

```bash
# Create migration files
touch backend/src/migrations/014_create_decks_table.sql
touch backend/src/migrations/015_create_deck_cards_table.sql
touch backend/src/migrations/016_create_deck_audit_log_table.sql

# Copy SQL schemas into files

# Run migrations
cd backend
pnpm run migrate
```

**Verification:**
```bash
# Check tables
docker exec -it mtg-postgres psql -U mtg_user -d mtg_agent -c "\dt"

# Check decks table
docker exec -it mtg-postgres psql -U mtg_user -d mtg_agent -c "\d decks"
```

**Success Criteria:**
- [ ] All 3 tables created
- [ ] Indexes created
- [ ] Foreign keys configured
- [ ] Constraints working

---

### Task 2: Create Deck Model (2-3 hours)

**Create:** `backend/src/models/DeckModel.ts`

```typescript
import pool from '../config/database';
import { QueryResult } from 'pg';
import { Deck, DeckCard, DeckWithCards, DeckFormat, BoardType } from '../types/deck.types';

export class DeckModel {
  // Create new deck
  static async create(userId: string, data: {
    name: string;
    format: DeckFormat;
    description?: string;
    notes?: string;
    tags?: string[];
    commanderId?: string;
    partnerCommanderId?: string;
  }): Promise<Deck> {
    const result: QueryResult<Deck> = await pool.query(
      `INSERT INTO decks (
        user_id, name, format, description, notes, tags,
        commander_id, partner_commander_id, colors
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        userId,
        data.name,
        data.format,
        data.description || null,
        data.notes || null,
        data.tags || [],
        data.commanderId || null,
        data.partnerCommanderId || null,
        [] // Colors derived from cards later
      ]
    );

    // Log deck creation
    await this.logAction(result.rows[0].id, userId, 'created', {
      name: data.name,
      format: data.format
    });

    return result.rows[0];
  }

  // Get deck by ID
  static async getById(deckId: string, userId: string): Promise<Deck | null> {
    const result: QueryResult<Deck> = await pool.query(
      `SELECT * FROM decks
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [deckId, userId]
    );
    return result.rows[0] || null;
  }

  // Get deck with all cards
  static async getWithCards(deckId: string, userId: string): Promise<DeckWithCards | null> {
    const deck = await this.getById(deckId, userId);
    if (!deck) return null;

    const cardsResult: QueryResult<DeckCard> = await pool.query(
      `SELECT dc.*, c.name, c.mana_cost, c.cmc, c.type_line, c.colors,
              c.image_uris, c.prices
       FROM deck_cards dc
       JOIN cards c ON dc.card_id = c.id
       WHERE dc.deck_id = $1
       ORDER BY dc.board_type, c.cmc, c.name`,
      [deckId]
    );

    // Group cards by board type
    const cards = {
      main: cardsResult.rows.filter(c => c.board_type === 'main'),
      sideboard: cardsResult.rows.filter(c => c.board_type === 'sideboard'),
      maybeboard: cardsResult.rows.filter(c => c.board_type === 'maybeboard'),
      commander: cardsResult.rows.filter(c => c.board_type === 'commander'),
    };

    return { ...deck, cards };
  }

  // List user's decks
  static async listByUser(userId: string, options?: {
    format?: DeckFormat;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Deck[]> {
    const conditions = ['user_id = $1', 'deleted_at IS NULL'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (options?.format) {
      conditions.push(`format = $${paramIndex}`);
      params.push(options.format);
      paramIndex++;
    }

    if (options?.tags && options.tags.length > 0) {
      conditions.push(`tags && $${paramIndex}::text[]`);
      params.push(options.tags);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const result: QueryResult<Deck> = await pool.query(
      `SELECT * FROM decks
       WHERE ${whereClause}
       ORDER BY updated_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return result.rows;
  }

  // Update deck metadata
  static async update(deckId: string, userId: string, data: {
    name?: string;
    description?: string;
    notes?: string;
    tags?: string[];
    format?: DeckFormat;
    commanderId?: string;
    partnerCommanderId?: string;
  }): Promise<Deck | null> {
    const deck = await this.getById(deckId, userId);
    if (!deck) return null;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    const changes: any = {};

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(data.name);
      changes.name = { old: deck.name, new: data.name };
    }

    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(data.description);
      changes.description = { old: deck.description, new: data.description };
    }

    if (data.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      params.push(data.notes);
    }

    if (data.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      params.push(data.tags);
      changes.tags = { old: deck.tags, new: data.tags };
    }

    if (data.format !== undefined) {
      updates.push(`format = $${paramIndex++}`);
      params.push(data.format);
      changes.format = { old: deck.format, new: data.format };
    }

    if (data.commanderId !== undefined) {
      updates.push(`commander_id = $${paramIndex++}`);
      params.push(data.commanderId);
    }

    if (data.partnerCommanderId !== undefined) {
      updates.push(`partner_commander_id = $${paramIndex++}`);
      params.push(data.partnerCommanderId);
    }

    if (updates.length === 0) return deck;

    params.push(deckId, userId);

    const result: QueryResult<Deck> = await pool.query(
      `UPDATE decks
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++} AND deleted_at IS NULL
       RETURNING *`,
      params
    );

    if (result.rows[0] && Object.keys(changes).length > 0) {
      await this.logAction(deckId, userId, 'updated', changes);
    }

    return result.rows[0] || null;
  }

  // Soft delete deck
  static async delete(deckId: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE decks
       SET deleted_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [deckId, userId]
    );

    if (result.rows[0]) {
      await this.logAction(deckId, userId, 'deleted', {});
      return true;
    }

    return false;
  }

  // Duplicate deck
  static async duplicate(deckId: string, userId: string, newName?: string): Promise<Deck | null> {
    const original = await this.getWithCards(deckId, userId);
    if (!original) return null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create new deck
      const deckResult: QueryResult<Deck> = await client.query(
        `INSERT INTO decks (
          user_id, name, format, description, notes, tags,
          commander_id, partner_commander_id, colors
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          userId,
          newName || `${original.name} (Copy)`,
          original.format,
          original.description,
          original.notes,
          original.tags,
          original.commander_id,
          original.partner_commander_id,
          original.colors
        ]
      );

      const newDeck = deckResult.rows[0];

      // Copy all cards
      const allCards = [
        ...original.cards.main,
        ...original.cards.sideboard,
        ...original.cards.maybeboard,
        ...original.cards.commander
      ];

      for (const card of allCards) {
        await client.query(
          `INSERT INTO deck_cards (deck_id, card_id, quantity, board_type)
           VALUES ($1, $2, $3, $4)`,
          [newDeck.id, card.card_id, card.quantity, card.board_type]
        );
      }

      // Log duplication
      await client.query(
        `INSERT INTO deck_audit_log (deck_id, user_id, action_type, changes)
         VALUES ($1, $2, 'duplicated', $3)`,
        [newDeck.id, userId, JSON.stringify({ original_deck_id: deckId })]
      );

      await client.query('COMMIT');
      return newDeck;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Add card to deck
  static async addCard(
    deckId: string,
    userId: string,
    cardId: string,
    quantity: number,
    boardType: BoardType = 'main'
  ): Promise<DeckCard> {
    // Verify deck ownership
    const deck = await this.getById(deckId, userId);
    if (!deck) throw new Error('Deck not found');

    const result: QueryResult<DeckCard> = await pool.query(
      `INSERT INTO deck_cards (deck_id, card_id, quantity, board_type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (deck_id, card_id, board_type)
       DO UPDATE SET quantity = deck_cards.quantity + EXCLUDED.quantity
       RETURNING *`,
      [deckId, cardId, quantity, boardType]
    );

    // Update deck colors
    await this.updateDeckColors(deckId);

    // Log card addition
    const card = await pool.query('SELECT name FROM cards WHERE id = $1', [cardId]);
    await this.logAction(deckId, userId, 'card_added', {
      card_id: cardId,
      card_name: card.rows[0]?.name,
      quantity,
      board: boardType
    });

    return result.rows[0];
  }

  // Remove card from deck
  static async removeCard(
    deckId: string,
    userId: string,
    cardId: string,
    boardType: BoardType = 'main'
  ): Promise<boolean> {
    // Verify deck ownership
    const deck = await this.getById(deckId, userId);
    if (!deck) return false;

    const card = await pool.query('SELECT name FROM cards WHERE id = $1', [cardId]);

    const result = await pool.query(
      `DELETE FROM deck_cards
       WHERE deck_id = $1 AND card_id = $2 AND board_type = $3
       RETURNING *`,
      [deckId, cardId, boardType]
    );

    if (result.rows[0]) {
      // Update deck colors
      await this.updateDeckColors(deckId);

      // Log card removal
      await this.logAction(deckId, userId, 'card_removed', {
        card_id: cardId,
        card_name: card.rows[0]?.name,
        quantity: result.rows[0].quantity,
        board: boardType
      });

      return true;
    }

    return false;
  }

  // Update card in deck
  static async updateCard(
    deckId: string,
    userId: string,
    cardId: string,
    boardType: BoardType,
    newQuantity: number
  ): Promise<DeckCard | null> {
    // Verify deck ownership
    const deck = await this.getById(deckId, userId);
    if (!deck) return null;

    const result: QueryResult<DeckCard> = await pool.query(
      `UPDATE deck_cards
       SET quantity = $1
       WHERE deck_id = $2 AND card_id = $3 AND board_type = $4
       RETURNING *`,
      [newQuantity, deckId, cardId, boardType]
    );

    if (result.rows[0]) {
      const card = await pool.query('SELECT name FROM cards WHERE id = $1', [cardId]);
      await this.logAction(deckId, userId, 'card_updated', {
        card_id: cardId,
        card_name: card.rows[0]?.name,
        new_quantity: newQuantity,
        board: boardType
      });
    }

    return result.rows[0] || null;
  }

  // Bulk add cards to deck (for performance with validation)
  static async bulkAddCards(
    deckId: string,
    userId: string,
    cards: Array<{ cardId: string; quantity: number; boardType: BoardType }>
  ): Promise<number> {
    // Verify deck ownership
    const deck = await this.getById(deckId, userId);
    if (!deck) throw new Error('Deck not found');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let added = 0;
      for (const card of cards) {
        await client.query(
          `INSERT INTO deck_cards (deck_id, card_id, quantity, board_type)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (deck_id, card_id, board_type)
           DO UPDATE SET quantity = deck_cards.quantity + EXCLUDED.quantity`,
          [deckId, card.cardId, card.quantity, card.boardType]
        );
        added++;
      }

      // Update deck colors once at the end
      await this.updateDeckColors(deckId);

      // Log bulk addition
      await client.query(
        `INSERT INTO deck_audit_log (deck_id, user_id, action_type, changes)
         VALUES ($1, $2, 'cards_bulk_added', $3)`,
        [deckId, userId, JSON.stringify({ cards_added: added })]
      );

      await client.query('COMMIT');
      return added;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Bulk remove cards from deck
  static async bulkRemoveCards(
    deckId: string,
    userId: string,
    cards: Array<{ cardId: string; boardType: BoardType }>
  ): Promise<number> {
    // Verify deck ownership
    const deck = await this.getById(deckId, userId);
    if (!deck) return 0;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let removed = 0;
      for (const card of cards) {
        const result = await client.query(
          `DELETE FROM deck_cards
           WHERE deck_id = $1 AND card_id = $2 AND board_type = $3
           RETURNING *`,
          [deckId, card.cardId, card.boardType]
        );
        if (result.rows[0]) removed++;
      }

      // Update deck colors once at the end
      await this.updateDeckColors(deckId);

      // Log bulk removal
      await client.query(
        `INSERT INTO deck_audit_log (deck_id, user_id, action_type, changes)
         VALUES ($1, $2, 'cards_bulk_removed', $3)`,
        [deckId, userId, JSON.stringify({ cards_removed: removed })]
      );

      await client.query('COMMIT');
      return removed;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Bulk update cards in deck
  static async bulkUpdateCards(
    deckId: string,
    userId: string,
    cards: Array<{ cardId: string; boardType: BoardType; quantity: number }>
  ): Promise<number> {
    // Verify deck ownership
    const deck = await this.getById(deckId, userId);
    if (!deck) return 0;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let updated = 0;
      for (const card of cards) {
        const result = await client.query(
          `UPDATE deck_cards
           SET quantity = $1
           WHERE deck_id = $2 AND card_id = $3 AND board_type = $4
           RETURNING *`,
          [card.quantity, deckId, card.cardId, card.boardType]
        );
        if (result.rows[0]) updated++;
      }

      // Log bulk update
      await client.query(
        `INSERT INTO deck_audit_log (deck_id, user_id, action_type, changes)
         VALUES ($1, $2, 'cards_bulk_updated', $3)`,
        [deckId, userId, JSON.stringify({ cards_updated: updated })]
      );

      await client.query('COMMIT');
      return updated;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Update deck colors based on cards
  private static async updateDeckColors(deckId: string): Promise<void> {
    const result = await pool.query(
      `UPDATE decks
       SET colors = (
         SELECT ARRAY_AGG(DISTINCT color)
         FROM deck_cards dc
         JOIN cards c ON dc.card_id = c.id
         CROSS JOIN unnest(c.colors) AS color
         WHERE dc.deck_id = $1 AND dc.board_type = 'main'
       )
       WHERE id = $1`,
      [deckId]
    );
  }

  // Log deck action
  private static async logAction(
    deckId: string,
    userId: string,
    actionType: string,
    changes: any
  ): Promise<void> {
    await pool.query(
      `INSERT INTO deck_audit_log (deck_id, user_id, action_type, changes)
       VALUES ($1, $2, $3, $4)`,
      [deckId, userId, actionType, JSON.stringify(changes)]
    );
  }

  // Get deck audit log
  static async getAuditLog(deckId: string, userId: string, limit = 50): Promise<any[]> {
    // Verify deck ownership
    const deck = await this.getById(deckId, userId);
    if (!deck) return [];

    const result = await pool.query(
      `SELECT dal.*, u.email as user_email
       FROM deck_audit_log dal
       LEFT JOIN users u ON dal.user_id = u.id
       WHERE dal.deck_id = $1
       ORDER BY dal.created_at DESC
       LIMIT $2`,
      [deckId, limit]
    );

    return result.rows;
  }
}
```

**Success Criteria:**
- [ ] DeckModel compiles without errors
- [ ] All CRUD methods implemented
- [ ] Card management methods implemented
- [ ] Audit logging working
- [ ] Color auto-update working

---

### Task 3: Create Deck Validation Service (1 hour)

**Note:** This is a basic validation stub. Phase 2.2 will replace this with comprehensive format validation including banned lists, color identity, and legality checking.

**Create:** `backend/src/services/deckValidationService.ts`

```typescript
import { DeckFormat, DeckWithCards } from '../types/deck.types';
import { DeckValidationWarning } from '../types/deck.types';

export class DeckValidationService {
  // Validate deck based on format
  static validate(deck: DeckWithCards): DeckValidationWarning[] {
    const warnings: DeckValidationWarning[] = [];

    // Get format-specific rules
    const rules = this.getFormatRules(deck.format);

    // Check minimum deck size
    const mainDeckSize = deck.cards.main.reduce((sum, card) => sum + card.quantity, 0);
    if (mainDeckSize < rules.minDeckSize) {
      warnings.push({
        type: 'warning',
        message: `Deck has ${mainDeckSize} cards, minimum is ${rules.minDeckSize} for ${deck.format}`,
        field: 'main_deck'
      });
    }

    // Check maximum deck size (for Commander)
    if (rules.maxDeckSize && mainDeckSize > rules.maxDeckSize) {
      warnings.push({
        type: 'warning',
        message: `Deck has ${mainDeckSize} cards, maximum is ${rules.maxDeckSize} for ${deck.format}`,
        field: 'main_deck'
      });
    }

    // Check card limits (4-of rule or singleton)
    const allCards = [...deck.cards.main, ...deck.cards.sideboard];
    for (const card of allCards) {
      if (card.quantity > rules.maxCopies && !this.isBasicLand(card)) {
        warnings.push({
          type: 'warning',
          message: `${card.name} has ${card.quantity} copies, max is ${rules.maxCopies} for ${deck.format}`,
          field: 'card_limit'
        });
      }
    }

    // Check sideboard size
    if (rules.maxSideboardSize !== null) {
      const sideboardSize = deck.cards.sideboard.reduce((sum, card) => sum + card.quantity, 0);
      if (sideboardSize > rules.maxSideboardSize) {
        warnings.push({
          type: 'warning',
          message: `Sideboard has ${sideboardSize} cards, maximum is ${rules.maxSideboardSize}`,
          field: 'sideboard'
        });
      }
    }

    // Commander-specific validation
    if (deck.format === 'commander' || deck.format === 'brawl' || deck.format === 'oathbreaker') {
      warnings.push(...this.validateCommander(deck));
    }

    return warnings;
  }

  // Get format-specific rules
  private static getFormatRules(format: DeckFormat) {
    const rules: Record<DeckFormat, any> = {
      standard: { minDeckSize: 60, maxDeckSize: null, maxCopies: 4, maxSideboardSize: 15 },
      modern: { minDeckSize: 60, maxDeckSize: null, maxCopies: 4, maxSideboardSize: 15 },
      pioneer: { minDeckSize: 60, maxDeckSize: null, maxCopies: 4, maxSideboardSize: 15 },
      legacy: { minDeckSize: 60, maxDeckSize: null, maxCopies: 4, maxSideboardSize: 15 },
      vintage: { minDeckSize: 60, maxDeckSize: null, maxCopies: 4, maxSideboardSize: 15 },
      commander: { minDeckSize: 100, maxDeckSize: 100, maxCopies: 1, maxSideboardSize: null },
      brawl: { minDeckSize: 60, maxDeckSize: 60, maxCopies: 1, maxSideboardSize: null },
      pauper: { minDeckSize: 60, maxDeckSize: null, maxCopies: 4, maxSideboardSize: 15 },
      historic: { minDeckSize: 60, maxDeckSize: null, maxCopies: 4, maxSideboardSize: 15 },
      explorer: { minDeckSize: 60, maxDeckSize: null, maxCopies: 4, maxSideboardSize: 15 },
      alchemy: { minDeckSize: 60, maxDeckSize: null, maxCopies: 4, maxSideboardSize: 15 },
      timeless: { minDeckSize: 60, maxDeckSize: null, maxCopies: 4, maxSideboardSize: 15 },
      oathbreaker: { minDeckSize: 60, maxDeckSize: 60, maxCopies: 1, maxSideboardSize: null },
      duel_commander: { minDeckSize: 100, maxDeckSize: 100, maxCopies: 1, maxSideboardSize: null },
      penny_dreadful: { minDeckSize: 60, maxDeckSize: null, maxCopies: 4, maxSideboardSize: 15 },
      premodern: { minDeckSize: 60, maxDeckSize: null, maxCopies: 4, maxSideboardSize: 15 },
      oldschool: { minDeckSize: 60, maxDeckSize: null, maxCopies: 4, maxSideboardSize: null },
      casual: { minDeckSize: 60, maxDeckSize: null, maxCopies: 4, maxSideboardSize: null },
    };

    return rules[format];
  }

  // Validate Commander deck
  private static validateCommander(deck: DeckWithCards): DeckValidationWarning[] {
    const warnings: DeckValidationWarning[] = [];

    // Check for commander
    if (deck.cards.commander.length === 0 && !deck.commander_id) {
      warnings.push({
        type: 'warning',
        message: 'Commander deck must have a commander',
        field: 'commander'
      });
    }

    // Check commander count (1 or 2 for partners)
    if (deck.cards.commander.length > 2) {
      warnings.push({
        type: 'warning',
        message: 'Commander deck can have at most 2 commanders (partners)',
        field: 'commander'
      });
    }

    // TODO: Color identity validation (Phase 2.2)
    // TODO: Partner validation (Phase 2.2)

    return warnings;
  }

  // Check if card is basic land
  private static isBasicLand(card: any): boolean {
    const basicLands = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes', 'Snow-Covered Plains', 'Snow-Covered Island', 'Snow-Covered Swamp', 'Snow-Covered Mountain', 'Snow-Covered Forest'];
    return basicLands.includes(card.name);
  }
}
```

**Success Criteria:**
- [ ] Validation service compiles
- [ ] Format-specific rules defined
- [ ] Returns warnings (not errors)
- [ ] Commander validation working

---

### Task 4: Create Deck Import/Export Service (1-2 hours)

**Create:** `backend/src/services/deckImportExportService.ts`

```typescript
import { CardModel } from '../models/CardModel';

export interface ParsedDeckCard {
  quantity: number;
  cardName: string;
  setCode?: string;
  collectorNumber?: string;
  boardType: 'main' | 'sideboard' | 'maybeboard' | 'commander';
}

export class DeckImportExportService {
  // Parse text format deck list
  static async parseTextFormat(text: string): Promise<ParsedDeckCard[]> {
    const lines = text.split('\n');
    const cards: ParsedDeckCard[] = [];
    let currentBoard: 'main' | 'sideboard' | 'maybeboard' | 'commander' = 'main';

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) continue;

      // Check for board markers
      if (trimmed.toLowerCase().startsWith('//')) {
        const marker = trimmed.toLowerCase();
        if (marker.includes('sideboard')) currentBoard = 'sideboard';
        else if (marker.includes('maybeboard') || marker.includes('maybe')) currentBoard = 'maybeboard';
        else if (marker.includes('commander')) currentBoard = 'commander';
        else currentBoard = 'main';
        continue;
      }

      // Parse card line: "4 Lightning Bolt"
      const match = trimmed.match(/^(\d+)x?\s+(.+)$/);
      if (match) {
        const quantity = parseInt(match[1]);
        const cardName = match[2].trim();

        cards.push({
          quantity,
          cardName,
          boardType: currentBoard
        });
      }
    }

    return cards;
  }

  // Parse Arena format deck list
  static async parseArenaFormat(text: string): Promise<ParsedDeckCard[]> {
    const lines = text.split('\n');
    const cards: ParsedDeckCard[] = [];
    let currentBoard: 'main' | 'sideboard' = 'main';

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) continue;

      // Check for "Deck" or "Sideboard" markers
      if (trimmed.toLowerCase() === 'deck') {
        currentBoard = 'main';
        continue;
      }
      if (trimmed.toLowerCase() === 'sideboard') {
        currentBoard = 'sideboard';
        continue;
      }

      // Parse Arena format: "4 Lightning Bolt (M11) 149"
      const match = trimmed.match(/^(\d+)\s+([^(]+?)(?:\s*\(([^)]+)\)\s*(\d+))?$/);
      if (match) {
        const quantity = parseInt(match[1]);
        const cardName = match[2].trim();
        const setCode = match[3];
        const collectorNumber = match[4];

        cards.push({
          quantity,
          cardName,
          setCode,
          collectorNumber,
          boardType: currentBoard
        });
      }
    }

    return cards;
  }

  // Resolve card names to card IDs
  static async resolveCards(parsedCards: ParsedDeckCard[]): Promise<Array<{
    cardId: string;
    quantity: number;
    boardType: string;
  }>> {
    const resolved: Array<{ cardId: string; quantity: number; boardType: string }> = [];

    for (const parsed of parsedCards) {
      // Search for card by name
      const cards = await CardModel.getByName(parsed.cardName);

      if (cards.length === 0) {
        console.warn(`Card not found: ${parsed.cardName}`);
        continue;
      }

      // If set code provided, try to match exact printing
      let card = cards[0];
      if (parsed.setCode) {
        const matchingSet = cards.find(c => c.set_code.toLowerCase() === parsed.setCode.toLowerCase());
        if (matchingSet) card = matchingSet;
      }

      resolved.push({
        cardId: card.id,
        quantity: parsed.quantity,
        boardType: parsed.boardType
      });
    }

    return resolved;
  }

  // Export deck to text format
  static async exportTextFormat(deck: any): Promise<string> {
    let output = '';

    // Commander
    if (deck.cards.commander && deck.cards.commander.length > 0) {
      output += '// Commander\n';
      for (const card of deck.cards.commander) {
        output += `${card.quantity} ${card.name}\n`;
      }
      output += '\n';
    }

    // Main deck
    if (deck.cards.main && deck.cards.main.length > 0) {
      output += '// Main Deck\n';
      for (const card of deck.cards.main) {
        output += `${card.quantity} ${card.name}\n`;
      }
      output += '\n';
    }

    // Sideboard
    if (deck.cards.sideboard && deck.cards.sideboard.length > 0) {
      output += '// Sideboard\n';
      for (const card of deck.cards.sideboard) {
        output += `${card.quantity} ${card.name}\n`;
      }
      output += '\n';
    }

    // Maybeboard
    if (deck.cards.maybeboard && deck.cards.maybeboard.length > 0) {
      output += '// Maybeboard\n';
      for (const card of deck.cards.maybeboard) {
        output += `${card.quantity} ${card.name}\n`;
      }
    }

    return output.trim();
  }

  // Export deck to Arena format
  static async exportArenaFormat(deck: any): Promise<string> {
    let output = 'Deck\n';

    // Main deck
    if (deck.cards.main) {
      for (const card of deck.cards.main) {
        output += `${card.quantity} ${card.name} (${card.set_code.toUpperCase()}) ${card.collector_number || ''}\n`;
      }
    }

    output += '\nSideboard\n';

    // Sideboard
    if (deck.cards.sideboard) {
      for (const card of deck.cards.sideboard) {
        output += `${card.quantity} ${card.name} (${card.set_code.toUpperCase()}) ${card.collector_number || ''}\n`;
      }
    }

    return output.trim();
  }
}
```

**Success Criteria:**
- [ ] Text format parsing works
- [ ] Arena format parsing works
- [ ] Card name resolution works
- [ ] Export formats generate correctly

---

### Task 5: Create Deck Stats Service (1 hour)

**Create:** `backend/src/services/deckStatsService.ts`

```typescript
import { DeckWithCards, DeckStats } from '../types/deck.types';
import pool from '../config/database';

export class DeckStatsService {
  // Calculate deck statistics
  static async calculate(deck: DeckWithCards): Promise<DeckStats> {
    // Get all cards with full details
    const deckId = deck.id;
    const cardsResult = await pool.query(
      `SELECT dc.quantity, dc.board_type, c.*
       FROM deck_cards dc
       JOIN cards c ON dc.card_id = c.id
       WHERE dc.deck_id = $1`,
      [deckId]
    );

    const cards = cardsResult.rows;
    const mainDeckCards = cards.filter(c => c.board_type === 'main');

    // Total cards
    const totalCards = cards.reduce((sum, card) => sum + card.quantity, 0);
    const mainDeckCount = mainDeckCards.reduce((sum, card) => sum + card.quantity, 0);
    const sideboardCount = cards.filter(c => c.board_type === 'sideboard')
      .reduce((sum, card) => sum + card.quantity, 0);
    const maybeboardCount = cards.filter(c => c.board_type === 'maybeboard')
      .reduce((sum, card) => sum + card.quantity, 0);
    const commanderCount = cards.filter(c => c.board_type === 'commander')
      .reduce((sum, card) => sum + card.quantity, 0);

    // Average CMC (main deck only)
    const totalCmc = mainDeckCards.reduce((sum, card) => sum + (card.cmc * card.quantity), 0);
    const averageCmc = mainDeckCount > 0 ? totalCmc / mainDeckCount : 0;

    // Total price (USD)
    const totalPriceUsd = cards.reduce((sum, card) => {
      const price = parseFloat(card.prices?.usd || '0');
      return sum + (price * card.quantity);
    }, 0);

    // Color distribution
    const colorDistribution: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    for (const card of mainDeckCards) {
      if (card.colors && Array.isArray(card.colors)) {
        for (const color of card.colors) {
          colorDistribution[color] = (colorDistribution[color] || 0) + card.quantity;
        }
      }
    }

    // Type distribution
    const typeDistribution: Record<string, number> = {};
    for (const card of mainDeckCards) {
      const types = this.extractTypes(card.type_line);
      for (const type of types) {
        typeDistribution[type] = (typeDistribution[type] || 0) + card.quantity;
      }
    }

    // Mana curve
    const manaCurve: Record<number, number> = {};
    for (const card of mainDeckCards) {
      const cmc = Math.min(Math.floor(card.cmc), 7); // Cap at 7+
      manaCurve[cmc] = (manaCurve[cmc] || 0) + card.quantity;
    }

    return {
      totalCards,
      mainDeckCards: mainDeckCount,
      sideboardCards: sideboardCount,
      maybeboardCards: maybeboardCount,
      commanderCards: commanderCount,
      averageCmc: Math.round(averageCmc * 100) / 100,
      totalPriceUsd: Math.round(totalPriceUsd * 100) / 100,
      colorDistribution,
      typeDistribution,
      manaCurve
    };
  }

  // Extract card types from type line
  private static extractTypes(typeLine: string): string[] {
    const types: string[] = [];
    const lowerType = typeLine.toLowerCase();

    if (lowerType.includes('creature')) types.push('Creature');
    if (lowerType.includes('instant')) types.push('Instant');
    if (lowerType.includes('sorcery')) types.push('Sorcery');
    if (lowerType.includes('enchantment')) types.push('Enchantment');
    if (lowerType.includes('artifact')) types.push('Artifact');
    if (lowerType.includes('planeswalker')) types.push('Planeswalker');
    if (lowerType.includes('land')) types.push('Land');
    if (lowerType.includes('battle')) types.push('Battle');

    return types.length > 0 ? types : ['Other'];
  }
}
```

**Success Criteria:**
- [ ] Stats calculation works
- [ ] Mana curve calculated correctly
- [ ] Price totaling accurate
- [ ] Color/type distribution working

---

### Task 6: Create Deck API Routes (1-2 hours)

**Create:** `backend/src/routes/decks.ts`

```typescript
import { Router, Request, Response } from 'express';
import { DeckModel } from '../models/DeckModel';
import { DeckValidationService } from '../services/deckValidationService';
import { DeckStatsService } from '../services/deckStatsService';
import { DeckImportExportService } from '../services/deckImportExportService';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

const router: Router = Router();

// Validation schemas
const CreateDeckSchema = z.object({
  name: z.string().min(1).max(200),
  format: z.string(),
  description: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  commanderId: z.string().uuid().optional(),
  partnerCommanderId: z.string().uuid().optional(),
});

const UpdateDeckSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  format: z.string().optional(),
  commanderId: z.string().uuid().optional(),
  partnerCommanderId: z.string().uuid().optional(),
});

const AddCardSchema = z.object({
  cardId: z.string().uuid(),
  quantity: z.number().min(1).max(100),
  boardType: z.enum(['main', 'sideboard', 'maybeboard', 'commander']).optional(),
});

// POST /api/decks - Create deck
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = CreateDeckSchema.parse(req.body);
    const userId = req.session.userId!;

    const deck = await DeckModel.create(userId, data);

    res.status(201).json({
      success: true,
      deck,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid deck data',
        details: error.errors,
      });
    }

    console.error('Create deck error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create deck',
    });
  }
});

// GET /api/decks - List user's decks
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { format, tags, limit, offset } = req.query;

    const decks = await DeckModel.listByUser(userId, {
      format: format as any,
      tags: tags ? (tags as string).split(',') : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      decks,
      count: decks.length,
    });
  } catch (error) {
    console.error('List decks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list decks',
    });
  }
});

// GET /api/decks/:id - Get deck with cards
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const deck = await DeckModel.getWithCards(req.params.id, userId);

    if (!deck) {
      return res.status(404).json({
        success: false,
        error: 'Deck not found',
      });
    }

    // Calculate stats
    const stats = await DeckStatsService.calculate(deck);

    // Validate deck
    const warnings = DeckValidationService.validate(deck);

    res.json({
      success: true,
      deck,
      stats,
      warnings,
    });
  } catch (error) {
    console.error('Get deck error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get deck',
    });
  }
});

// PATCH /api/decks/:id - Update deck
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = UpdateDeckSchema.parse(req.body);
    const userId = req.session.userId!;

    const deck = await DeckModel.update(req.params.id, userId, data);

    if (!deck) {
      return res.status(404).json({
        success: false,
        error: 'Deck not found',
      });
    }

    res.json({
      success: true,
      deck,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid update data',
        details: error.errors,
      });
    }

    console.error('Update deck error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update deck',
    });
  }
});

// DELETE /api/decks/:id - Delete deck
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const success = await DeckModel.delete(req.params.id, userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Deck not found',
      });
    }

    res.json({
      success: true,
      message: 'Deck deleted',
    });
  } catch (error) {
    console.error('Delete deck error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete deck',
    });
  }
});

// POST /api/decks/:id/duplicate - Duplicate deck
router.post('/:id/duplicate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { name } = req.body;

    const deck = await DeckModel.duplicate(req.params.id, userId, name);

    if (!deck) {
      return res.status(404).json({
        success: false,
        error: 'Deck not found',
      });
    }

    res.status(201).json({
      success: true,
      deck,
    });
  } catch (error) {
    console.error('Duplicate deck error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to duplicate deck',
    });
  }
});

// POST /api/decks/:id/cards - Add card to deck
router.post('/:id/cards', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = AddCardSchema.parse(req.body);
    const userId = req.session.userId!;

    const deckCard = await DeckModel.addCard(
      req.params.id,
      userId,
      data.cardId,
      data.quantity,
      data.boardType || 'main'
    );

    res.status(201).json({
      success: true,
      deckCard,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid card data',
        details: error.errors,
      });
    }

    console.error('Add card error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add card',
    });
  }
});

// DELETE /api/decks/:id/cards/:cardId - Remove card from deck
router.delete('/:id/cards/:cardId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { boardType } = req.query;

    const success = await DeckModel.removeCard(
      req.params.id,
      userId,
      req.params.cardId,
      (boardType as any) || 'main'
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Card not found in deck',
      });
    }

    res.json({
      success: true,
      message: 'Card removed',
    });
  } catch (error) {
    console.error('Remove card error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove card',
    });
  }
});

// PATCH /api/decks/:id/cards/:cardId - Update card in deck
router.patch('/:id/cards/:cardId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { quantity, boardType } = req.body;

    if (!quantity || !boardType) {
      return res.status(400).json({
        success: false,
        error: 'Quantity and boardType required',
      });
    }

    const deckCard = await DeckModel.updateCard(
      req.params.id,
      userId,
      req.params.cardId,
      boardType,
      quantity
    );

    if (!deckCard) {
      return res.status(404).json({
        success: false,
        error: 'Card not found in deck',
      });
    }

    res.json({
      success: true,
      deckCard,
    });
  } catch (error) {
    console.error('Update card error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update card',
    });
  }
});

// POST /api/decks/:id/cards/bulk - Bulk add cards to deck
router.post('/:id/cards/bulk', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { cards } = req.body; // Array of { cardId, quantity, boardType }

    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cards array required',
      });
    }

    const added = await DeckModel.bulkAddCards(req.params.id, userId, cards);

    res.json({
      success: true,
      cardsAdded: added,
    });
  } catch (error) {
    console.error('Bulk add cards error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add cards',
    });
  }
});

// DELETE /api/decks/:id/cards/bulk - Bulk remove cards from deck
router.delete('/:id/cards/bulk', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { cards } = req.body; // Array of { cardId, boardType }

    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cards array required',
      });
    }

    const removed = await DeckModel.bulkRemoveCards(req.params.id, userId, cards);

    res.json({
      success: true,
      cardsRemoved: removed,
    });
  } catch (error) {
    console.error('Bulk remove cards error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove cards',
    });
  }
});

// PATCH /api/decks/:id/cards/bulk - Bulk update cards in deck
router.patch('/:id/cards/bulk', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { cards } = req.body; // Array of { cardId, boardType, quantity }

    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cards array required',
      });
    }

    const updated = await DeckModel.bulkUpdateCards(req.params.id, userId, cards);

    res.json({
      success: true,
      cardsUpdated: updated,
    });
  } catch (error) {
    console.error('Bulk update cards error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update cards',
    });
  }
});

// POST /api/decks/:id/import - Import deck from text
router.post('/:id/import', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { text, format } = req.body; // format: 'text' or 'arena'

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Deck text required',
      });
    }

    // Parse deck based on format
    const parsedCards = format === 'arena'
      ? await DeckImportExportService.parseArenaFormat(text)
      : await DeckImportExportService.parseTextFormat(text);

    // Resolve card names to IDs
    const resolvedCards = await DeckImportExportService.resolveCards(parsedCards);

    // Add cards to deck
    for (const card of resolvedCards) {
      await DeckModel.addCard(
        req.params.id,
        userId,
        card.cardId,
        card.quantity,
        card.boardType as any
      );
    }

    // Log import action
    await DeckModel.logAction(req.params.id, userId, 'imported', {
      format,
      cards_imported: resolvedCards.length
    });

    res.json({
      success: true,
      message: `Imported ${resolvedCards.length} cards`,
      imported: resolvedCards.length,
    });
  } catch (error) {
    console.error('Import deck error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import deck',
    });
  }
});

// GET /api/decks/:id/export - Export deck to text
router.get('/:id/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { format } = req.query; // format: 'text' or 'arena'

    const deck = await DeckModel.getWithCards(req.params.id, userId);

    if (!deck) {
      return res.status(404).json({
        success: false,
        error: 'Deck not found',
      });
    }

    const exportedText = format === 'arena'
      ? await DeckImportExportService.exportArenaFormat(deck)
      : await DeckImportExportService.exportTextFormat(deck);

    res.json({
      success: true,
      format: format || 'text',
      text: exportedText,
    });
  } catch (error) {
    console.error('Export deck error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export deck',
    });
  }
});

// GET /api/decks/:id/audit-log - Get deck audit log
router.get('/:id/audit-log', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { limit } = req.query;

    const auditLog = await DeckModel.getAuditLog(
      req.params.id,
      userId,
      limit ? parseInt(limit as string) : 50
    );

    res.json({
      success: true,
      auditLog,
    });
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get audit log',
    });
  }
});

export default router;
```

**Update:** `backend/src/index.ts`

```typescript
import decksRouter from './routes/decks';
app.use('/api/decks', decksRouter);
```

**Success Criteria:**
- [ ] All deck endpoints compile
- [ ] CRUD operations working
- [ ] Card management endpoints working
- [ ] Import/export endpoints working
- [ ] Audit log endpoint working

---

## Verification

### API Testing

```bash
# Create a deck
curl -X POST http://localhost:3001/api/decks \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Red Deck Wins",
    "format": "standard",
    "description": "Aggressive red deck",
    "tags": ["aggro", "competitive"]
  }'

# List decks
curl http://localhost:3001/api/decks \
  -H "Cookie: connect.sid=<session>"

# Get deck with cards
curl http://localhost:3001/api/decks/<deck-id> \
  -H "Cookie: connect.sid=<session>"

# Add card to deck
curl -X POST http://localhost:3001/api/decks/<deck-id>/cards \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{
    "cardId": "<lightning-bolt-id>",
    "quantity": 4,
    "boardType": "main"
  }'

# Import deck
curl -X POST http://localhost:3001/api/decks/<deck-id>/import \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "4 Lightning Bolt\n4 Monastery Swiftspear\n20 Mountain",
    "format": "text"
  }'

# Export deck
curl "http://localhost:3001/api/decks/<deck-id>/export?format=text" \
  -H "Cookie: connect.sid=<session>"

# Duplicate deck
curl -X POST http://localhost:3001/api/decks/<deck-id>/duplicate \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Red Deck Wins v2"}'

# Get audit log
curl http://localhost:3001/api/decks/<deck-id>/audit-log \
  -H "Cookie: connect.sid=<session>"
```

---

## Success Criteria

- [ ] Database schema created (decks, deck_cards, deck_audit_log)
- [ ] All indexes and foreign keys working
- [ ] DeckModel CRUD operations functional
- [ ] Card management working (add/remove/update)
- [ ] Deck validation returns warnings
- [ ] Import/export working (text + Arena formats)
- [ ] Deck duplication works
- [ ] Audit log tracking all changes
- [ ] Stats calculation accurate
- [ ] Commander support implemented
- [ ] Format validation working
- [ ] All API endpoints functional
- [ ] Tests passing (>70% coverage)

---

## Next Steps

After Phase 2.1 is complete:
- **Phase 2.2:** Format Validation (banned lists, color identity, hard validation)
- **Phase 2.3:** Deck Analysis API (advanced insights, synergy detection)

---

**Last Updated:** 2026-01-01
**Status:** Ready to implement
**Next:** Begin Task 1 (Database Migrations)
