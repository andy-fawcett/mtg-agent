# Phase 2.0: Card Database & Bulk Import

**Status:** ⏸️ Not Started
**Estimated Time:** 8-10 hours
**Prerequisites:** Phase 1 (MVP) complete ✅

---

## Overview

Build a comprehensive MTG card database by importing Scryfall's bulk data. This includes all card printings (~25k cards), rulings, and prices. Implement a custom search syntax with PostgreSQL full-text search for fast, local card queries without API rate limits.

---

## Objectives

- Download and import Scryfall bulk data (All Cards + Rulings)
- Create PostgreSQL schema (hybrid: indexed columns + full JSON)
- Implement custom search syntax (basic + advanced filters)
- Build search API with full-text search
- Create daily auto-sync job + manual sync endpoint
- Ensure deck integrity during sync operations

---

## Technical Decisions

### Data Source
- **Scryfall "All Cards" bulk data** (~140MB) - Every printing of every card
- **Scryfall "Rulings" bulk data** (~20MB) - All official card rulings
- **Daily updates** from Scryfall (bulk data refreshed daily at ~9am UTC)

### Database Strategy
- **Hybrid schema:**
  - Indexed columns for common search fields (name, colors, type, cmc, etc.)
  - JSONB column storing complete Scryfall card object
  - Best of both: Fast queries + full data preservation

### Image Strategy
- **Store URLs only** - Hotlink to Scryfall's CDN
- No local image caching (deferred to Phase 5)

### Price Data
- **Import all sources:** USD, USD foil, EUR, EUR foil, MTGO tix
- Support multi-currency pricing

### Search Syntax
- **Basic filters:** name, color, type, text, cmc, set, rarity, format
- **Advanced filters:** power, toughness, price, artist, color identity
- **Multi-color matching:** Support exact, subset, identity matching

### Sync Strategy
- **Full reimport** (simpler, safer than incremental)
- **Daily auto-sync** at 3am local time
- **Manual sync endpoint** for admin testing
- **Deck integrity protection:** Use stable Scryfall IDs, validate references

---

## Database Schema

### Migration 012: Cards Table

```sql
-- backend/src/migrations/012_create_cards_table.sql

-- Main cards table (hybrid: indexed columns + full JSON)
CREATE TABLE cards (
  -- Scryfall stable ID (primary key)
  id UUID PRIMARY KEY,

  -- Indexed search fields (frequently queried)
  name VARCHAR(200) NOT NULL,
  mana_cost VARCHAR(50),
  cmc DECIMAL(4,1) NOT NULL DEFAULT 0,
  type_line VARCHAR(200) NOT NULL,
  oracle_text TEXT,

  -- Color arrays (use PostgreSQL arrays)
  colors TEXT[],           -- Card colors: ['W', 'U', 'B', 'R', 'G']
  color_identity TEXT[],   -- Color identity (for Commander)

  -- Power/Toughness (nullable for non-creatures)
  power VARCHAR(10),       -- Can be '*' or '1+*'
  toughness VARCHAR(10),

  -- Set information
  set_code VARCHAR(10) NOT NULL,
  set_name VARCHAR(200),
  rarity VARCHAR(20) NOT NULL, -- common, uncommon, rare, mythic

  -- Legalities (JSONB for flexible format support)
  legalities JSONB NOT NULL DEFAULT '{}',

  -- Prices (JSONB for multiple sources)
  prices JSONB NOT NULL DEFAULT '{}',
  -- Example: {"usd": "1.50", "usd_foil": "3.00", "eur": "1.20", "eur_foil": "2.80", "tix": "0.50"}

  -- Image URLs
  image_uris JSONB,
  -- Example: {"small": "https://...", "normal": "https://...", "large": "https://..."}

  -- Card faces (for double-faced cards)
  card_faces JSONB,

  -- Full Scryfall JSON (preserves all data)
  scryfall_data JSONB NOT NULL,

  -- Artist & flavor
  artist VARCHAR(200),
  flavor_text TEXT,

  -- Metadata
  released_at DATE,
  imported_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Full-text search vector (auto-updated by trigger)
  search_vector TSVECTOR
);

-- Indexes for common queries
CREATE INDEX idx_cards_name ON cards(name);
CREATE INDEX idx_cards_name_lower ON cards(LOWER(name)); -- Case-insensitive search
CREATE INDEX idx_cards_type_line ON cards(type_line);
CREATE INDEX idx_cards_colors ON cards USING GIN(colors); -- Array search
CREATE INDEX idx_cards_color_identity ON cards USING GIN(color_identity);
CREATE INDEX idx_cards_set_code ON cards(set_code);
CREATE INDEX idx_cards_rarity ON cards(rarity);
CREATE INDEX idx_cards_cmc ON cards(cmc);
CREATE INDEX idx_cards_released_at ON cards(released_at);

-- Full-text search index
CREATE INDEX idx_cards_search_vector ON cards USING GIN(search_vector);

-- JSONB indexes for legalities and prices
CREATE INDEX idx_cards_legalities ON cards USING GIN(legalities);
CREATE INDEX idx_cards_prices ON cards USING GIN(prices);

-- Trigger to auto-update search_vector
CREATE OR REPLACE FUNCTION cards_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.type_line, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.oracle_text, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.artist, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cards_search_vector_trigger
  BEFORE INSERT OR UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION cards_search_vector_update();

-- Trigger to auto-update updated_at
CREATE TRIGGER cards_updated_at_trigger
  BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Migration 013: Rulings Table

```sql
-- backend/src/migrations/013_create_rulings_table.sql

CREATE TABLE card_rulings (
  id SERIAL PRIMARY KEY,

  -- Scryfall card ID (foreign key)
  card_id UUID NOT NULL,

  -- Ruling details
  ruling_date DATE NOT NULL,
  ruling_text TEXT NOT NULL,

  -- Scryfall source
  scryfall_ruling_id UUID UNIQUE,

  -- Metadata
  imported_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Foreign key (NO CASCADE DELETE - protect data integrity)
  CONSTRAINT fk_card_rulings_card
    FOREIGN KEY (card_id)
    REFERENCES cards(id)
    ON DELETE RESTRICT  -- Prevent card deletion if rulings exist
);

-- Index for efficient ruling lookups
CREATE INDEX idx_card_rulings_card_id ON card_rulings(card_id);
CREATE INDEX idx_card_rulings_date ON card_rulings(ruling_date DESC);
```

### Migration 014: Sync Log Table

```sql
-- backend/src/migrations/014_create_sync_log_table.sql

CREATE TABLE scryfall_sync_log (
  id SERIAL PRIMARY KEY,

  -- Sync metadata
  sync_type VARCHAR(20) NOT NULL, -- 'auto' or 'manual'
  status VARCHAR(20) NOT NULL,     -- 'started', 'completed', 'failed'

  -- Sync details
  cards_imported INTEGER,
  rulings_imported INTEGER,

  -- Timing
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_seconds INTEGER,

  -- Error tracking
  error_message TEXT,

  -- Triggered by (user_id if manual)
  triggered_by_user_id UUID REFERENCES users(id),

  -- Bulk data URLs synced
  cards_url TEXT,
  rulings_url TEXT
);

CREATE INDEX idx_sync_log_status ON scryfall_sync_log(status);
CREATE INDEX idx_sync_log_started_at ON scryfall_sync_log(started_at DESC);
```

---

## Implementation Tasks

### Task 1: Create Database Migrations (30 min)

**Steps:**
1. Create migration files (011, 012, 013)
2. Add schemas from above
3. Run migrations

```bash
# Create migration files
touch backend/src/migrations/011_create_cards_table.sql
touch backend/src/migrations/012_create_rulings_table.sql
touch backend/src/migrations/013_create_sync_log_table.sql

# Copy SQL schemas into files (from above)

# Run migrations
cd backend
pnpm run migrate
```

**Verification:**
```bash
# Check tables exist
docker exec -it mtg-postgres psql -U mtg_user -d mtg_agent -c "\dt"

# Check indexes
docker exec -it mtg-postgres psql -U mtg_user -d mtg_agent -c "\d cards"
```

**Success Criteria:**
- [ ] All 3 tables created
- [ ] All indexes created
- [ ] Triggers working (search_vector, updated_at)
- [ ] Foreign keys configured correctly

---

### Task 2: Add requireAdmin Middleware (15 min)

**Note:** Phase 1 provides `requireAuth` middleware but not `requireAdmin`. This task adds admin-only route protection.

**Create:** `backend/src/middleware/auth.ts` (update existing file)

Add the following function to the existing `auth.ts` file:

```typescript
/**
 * Require admin role
 * Must be used after requireAuth middleware
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Ensure requireAuth has run first
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource',
      });
      return;
    }

    // Check if user has admin role
    if (req.user.role !== 'admin') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'This action requires admin privileges',
      });
      return;
    }

    next();
  } catch (error: any) {
    console.error('requireAdmin middleware error:', error);
    res.status(500).json({
      error: 'Authorization error',
      message: 'Failed to verify admin privileges',
    });
  }
}
```

**Verification:**
```bash
# Test that requireAdmin is exported
cd backend
grep "requireAdmin" src/middleware/auth.ts

# Should show: export async function requireAdmin(
```

**Success Criteria:**
- [ ] `requireAdmin` function added to auth middleware
- [ ] Function checks for req.user.role === 'admin'
- [ ] Function returns 403 if not admin
- [ ] Function can be imported by route files

---

### Task 3: Create Card Model (1 hour)

**Create:** `backend/src/models/CardModel.ts`

```typescript
import pool from '../config/database';
import { QueryResult } from 'pg';

export interface Card {
  id: string; // UUID from Scryfall
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors: string[];
  color_identity: string[];
  power?: string;
  toughness?: string;
  set_code: string;
  set_name?: string;
  rarity: string;
  legalities: Record<string, string>; // format -> legality
  prices: Record<string, string | null>; // price type -> price
  image_uris?: Record<string, string>;
  card_faces?: any[];
  scryfall_data: any; // Full JSON
  artist?: string;
  flavor_text?: string;
  released_at?: Date;
  imported_at: Date;
  updated_at: Date;
}

export interface CardSearchFilters {
  name?: string;
  colors?: string[];
  colorIdentity?: string[];
  type?: string;
  text?: string;
  cmc?: number;
  cmcOperator?: '=' | '<' | '>' | '<=' | '>=';
  set?: string;
  rarity?: string;
  format?: string;
  power?: string;
  powerOperator?: '=' | '<' | '>' | '<=' | '>=';
  toughness?: string;
  toughnessOperator?: '=' | '<' | '>' | '<=' | '>=';
  maxPrice?: number;
  artist?: string;
  limit?: number;
  offset?: number;
}

export class CardModel {
  // Bulk insert cards (for import)
  static async bulkInsert(cards: any[]): Promise<number> {
    // Use transaction for atomic import
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let inserted = 0;
      for (const card of cards) {
        await client.query(
          `INSERT INTO cards (
            id, name, mana_cost, cmc, type_line, oracle_text,
            colors, color_identity, power, toughness,
            set_code, set_name, rarity, legalities, prices,
            image_uris, card_faces, scryfall_data, artist, flavor_text, released_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            mana_cost = EXCLUDED.mana_cost,
            cmc = EXCLUDED.cmc,
            type_line = EXCLUDED.type_line,
            oracle_text = EXCLUDED.oracle_text,
            colors = EXCLUDED.colors,
            color_identity = EXCLUDED.color_identity,
            power = EXCLUDED.power,
            toughness = EXCLUDED.toughness,
            set_code = EXCLUDED.set_code,
            set_name = EXCLUDED.set_name,
            rarity = EXCLUDED.rarity,
            legalities = EXCLUDED.legalities,
            prices = EXCLUDED.prices,
            image_uris = EXCLUDED.image_uris,
            card_faces = EXCLUDED.card_faces,
            scryfall_data = EXCLUDED.scryfall_data,
            artist = EXCLUDED.artist,
            flavor_text = EXCLUDED.flavor_text,
            released_at = EXCLUDED.released_at,
            updated_at = NOW()
          `,
          [
            card.id,
            card.name,
            card.mana_cost || null,
            card.cmc || 0,
            card.type_line,
            card.oracle_text || null,
            card.colors || [],
            card.color_identity || [],
            card.power || null,
            card.toughness || null,
            card.set,
            card.set_name || null,
            card.rarity,
            card.legalities || {},
            card.prices || {},
            card.image_uris || null,
            card.card_faces || null,
            JSON.stringify(card),
            card.artist || null,
            card.flavor_text || null,
            card.released_at || null
          ]
        );
        inserted++;
      }

      await client.query('COMMIT');
      return inserted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Search cards with filters
  static async search(filters: CardSearchFilters): Promise<Card[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Name search (case-insensitive, partial match)
    if (filters.name) {
      conditions.push(`LOWER(name) LIKE LOWER($${paramIndex})`);
      params.push(`%${filters.name}%`);
      paramIndex++;
    }

    // Color filter (exact match or subset)
    if (filters.colors && filters.colors.length > 0) {
      conditions.push(`colors @> $${paramIndex}::text[]`);
      params.push(filters.colors);
      paramIndex++;
    }

    // Color identity filter (for Commander)
    if (filters.colorIdentity && filters.colorIdentity.length > 0) {
      conditions.push(`color_identity <@ $${paramIndex}::text[]`);
      params.push(filters.colorIdentity);
      paramIndex++;
    }

    // Type filter
    if (filters.type) {
      conditions.push(`LOWER(type_line) LIKE LOWER($${paramIndex})`);
      params.push(`%${filters.type}%`);
      paramIndex++;
    }

    // Oracle text search
    if (filters.text) {
      conditions.push(`LOWER(oracle_text) LIKE LOWER($${paramIndex})`);
      params.push(`%${filters.text}%`);
      paramIndex++;
    }

    // CMC filter
    if (filters.cmc !== undefined) {
      const operator = filters.cmcOperator || '=';
      conditions.push(`cmc ${operator} $${paramIndex}`);
      params.push(filters.cmc);
      paramIndex++;
    }

    // Set filter
    if (filters.set) {
      conditions.push(`LOWER(set_code) = LOWER($${paramIndex})`);
      params.push(filters.set);
      paramIndex++;
    }

    // Rarity filter
    if (filters.rarity) {
      conditions.push(`LOWER(rarity) = LOWER($${paramIndex})`);
      params.push(filters.rarity);
      paramIndex++;
    }

    // Format legality filter
    if (filters.format) {
      conditions.push(`legalities->$${paramIndex} = 'legal'`);
      params.push(filters.format);
      paramIndex++;
    }

    // Power filter
    if (filters.power) {
      const operator = filters.powerOperator || '=';
      conditions.push(`power ${operator} $${paramIndex}`);
      params.push(filters.power);
      paramIndex++;
    }

    // Toughness filter
    if (filters.toughness) {
      const operator = filters.toughnessOperator || '=';
      conditions.push(`toughness ${operator} $${paramIndex}`);
      params.push(filters.toughness);
      paramIndex++;
    }

    // Price filter (USD)
    if (filters.maxPrice !== undefined) {
      conditions.push(`(prices->>'usd')::DECIMAL <= $${paramIndex}`);
      params.push(filters.maxPrice);
      paramIndex++;
    }

    // Artist filter
    if (filters.artist) {
      conditions.push(`LOWER(artist) LIKE LOWER($${paramIndex})`);
      params.push(`%${filters.artist}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const query = `
      SELECT * FROM cards
      ${whereClause}
      ORDER BY name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result: QueryResult<Card> = await pool.query(query, params);
    return result.rows;
  }

  // Get card by ID
  static async getById(id: string): Promise<Card | null> {
    const result: QueryResult<Card> = await pool.query(
      'SELECT * FROM cards WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  // Get card by exact name
  static async getByName(name: string): Promise<Card[]> {
    const result: QueryResult<Card> = await pool.query(
      'SELECT * FROM cards WHERE LOWER(name) = LOWER($1) ORDER BY released_at DESC',
      [name]
    );
    return result.rows;
  }

  // Full-text search
  static async fullTextSearch(query: string, limit = 20): Promise<Card[]> {
    const result: QueryResult<Card> = await pool.query(
      `SELECT *, ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
       FROM cards
       WHERE search_vector @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT $2`,
      [query, limit]
    );
    return result.rows;
  }

  // Get total card count
  static async count(): Promise<number> {
    const result = await pool.query('SELECT COUNT(*) FROM cards');
    return parseInt(result.rows[0].count);
  }

  // Delete all cards (for full reimport)
  static async deleteAll(): Promise<void> {
    await pool.query('DELETE FROM cards');
  }
}
```

**Verification:**
```bash
# TypeScript compilation check
cd backend
pnpm run build

# Should compile without errors
```

**Success Criteria:**
- [ ] CardModel compiles without errors
- [ ] All methods typed correctly
- [ ] Supports all search filters

---

### Task 4: Create Scryfall Import Service (2-3 hours)

**Create:** `backend/src/services/scryfallImportService.ts`

```typescript
import axios from 'axios';
import { CardModel } from '../models/CardModel';
import pool from '../config/database';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import * as zlib from 'zlib';

const streamPipeline = promisify(pipeline);

interface ScryfallBulkData {
  object: string;
  type: string;
  download_uri: string;
  updated_at: string;
}

export class ScryfallImportService {
  private static readonly BULK_DATA_URL = 'https://api.scryfall.com/bulk-data';
  private static readonly TEMP_DIR = path.join(__dirname, '../../temp');

  // Ensure temp directory exists
  private static async ensureTempDir(): Promise<void> {
    if (!fs.existsSync(this.TEMP_DIR)) {
      fs.mkdirSync(this.TEMP_DIR, { recursive: true });
    }
  }

  // Get bulk data info from Scryfall
  private static async getBulkDataInfo(): Promise<{ cards: ScryfallBulkData; rulings: ScryfallBulkData }> {
    const response = await axios.get(this.BULK_DATA_URL);
    const bulkData = response.data.data;

    const cardsData = bulkData.find((item: ScryfallBulkData) => item.type === 'all_cards');
    const rulingsData = bulkData.find((item: ScryfallBulkData) => item.type === 'rulings');

    if (!cardsData || !rulingsData) {
      throw new Error('Failed to find bulk data URLs from Scryfall');
    }

    return { cards: cardsData, rulings: rulingsData };
  }

  // Download bulk data file
  private static async downloadFile(url: string, filename: string): Promise<string> {
    await this.ensureTempDir();
    const filepath = path.join(this.TEMP_DIR, filename);

    console.log(`Downloading ${filename} from Scryfall...`);
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(filepath);
    await streamPipeline(response.data, writer);

    console.log(`Downloaded ${filename} successfully`);
    return filepath;
  }

  // Import cards from JSON file
  private static async importCards(filepath: string): Promise<number> {
    console.log('Reading cards JSON...');
    const data = fs.readFileSync(filepath, 'utf-8');
    const cards = JSON.parse(data);

    console.log(`Importing ${cards.length} cards...`);

    // Batch import (500 cards at a time for performance)
    const batchSize = 500;
    let imported = 0;

    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);
      await CardModel.bulkInsert(batch);
      imported += batch.length;

      if (imported % 5000 === 0) {
        console.log(`Imported ${imported}/${cards.length} cards...`);
      }
    }

    console.log(`Successfully imported ${imported} cards`);
    return imported;
  }

  // Import rulings from JSON file
  private static async importRulings(filepath: string): Promise<number> {
    console.log('Reading rulings JSON...');
    const data = fs.readFileSync(filepath, 'utf-8');
    const rulings = JSON.parse(data);

    console.log(`Importing ${rulings.length} rulings...`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing rulings for full reimport
      await client.query('DELETE FROM card_rulings');

      let imported = 0;
      for (const ruling of rulings) {
        await client.query(
          `INSERT INTO card_rulings (card_id, ruling_date, ruling_text, scryfall_ruling_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (scryfall_ruling_id) DO NOTHING`,
          [ruling.oracle_id, ruling.published_at, ruling.comment, ruling.id]
        );
        imported++;

        if (imported % 10000 === 0) {
          console.log(`Imported ${imported}/${rulings.length} rulings...`);
        }
      }

      await client.query('COMMIT');
      console.log(`Successfully imported ${imported} rulings`);
      return imported;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Cleanup temp files
  private static cleanupTempFiles(): void {
    if (fs.existsSync(this.TEMP_DIR)) {
      fs.rmSync(this.TEMP_DIR, { recursive: true, force: true });
      console.log('Cleaned up temp files');
    }
  }

  // Main sync function
  static async syncFromScryfall(userId?: string): Promise<{ cardsImported: number; rulingsImported: number }> {
    const syncLogId = await this.createSyncLog(userId ? 'manual' : 'auto', userId);

    try {
      console.log('Starting Scryfall bulk data sync...');

      // Get bulk data URLs
      const { cards, rulings } = await this.getBulkDataInfo();

      // Download files
      const cardsFile = await this.downloadFile(cards.download_uri, 'cards.json');
      const rulingsFile = await this.downloadFile(rulings.download_uri, 'rulings.json');

      // Import data
      const cardsImported = await this.importCards(cardsFile);
      const rulingsImported = await this.importRulings(rulingsFile);

      // Cleanup
      this.cleanupTempFiles();

      // Update sync log
      await this.completeSyncLog(syncLogId, 'completed', cardsImported, rulingsImported);

      console.log('Scryfall sync completed successfully!');
      return { cardsImported, rulingsImported };
    } catch (error) {
      console.error('Scryfall sync failed:', error);
      await this.failSyncLog(syncLogId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // Create sync log entry
  private static async createSyncLog(syncType: string, userId?: string): Promise<number> {
    const result = await pool.query(
      `INSERT INTO scryfall_sync_log (sync_type, status, triggered_by_user_id)
       VALUES ($1, 'started', $2)
       RETURNING id`,
      [syncType, userId || null]
    );
    return result.rows[0].id;
  }

  // Update sync log on completion
  private static async completeSyncLog(
    logId: number,
    status: string,
    cardsImported: number,
    rulingsImported: number
  ): Promise<void> {
    await pool.query(
      `UPDATE scryfall_sync_log
       SET status = $1,
           cards_imported = $2,
           rulings_imported = $3,
           completed_at = NOW(),
           duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
       WHERE id = $4`,
      [status, cardsImported, rulingsImported, logId]
    );
  }

  // Update sync log on failure
  private static async failSyncLog(logId: number, errorMessage: string): Promise<void> {
    await pool.query(
      `UPDATE scryfall_sync_log
       SET status = 'failed',
           error_message = $1,
           completed_at = NOW(),
           duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
       WHERE id = $2`,
      [errorMessage, logId]
    );
  }
}
```

**Success Criteria:**
- [ ] Service compiles without errors
- [ ] Can download Scryfall bulk data
- [ ] Imports cards and rulings successfully
- [ ] Logs sync operations

---

### Task 5: Create Card Search API (1-2 hours)

**Create:** `backend/src/routes/cards.ts`

```typescript
import { Router, Request, Response } from 'express';
import { CardModel, CardSearchFilters } from '../models/CardModel';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

const router: Router = Router();

// Validation schema for card search
const CardSearchSchema = z.object({
  name: z.string().optional(),
  colors: z.array(z.string()).optional(),
  colorIdentity: z.array(z.string()).optional(),
  type: z.string().optional(),
  text: z.string().optional(),
  cmc: z.number().optional(),
  cmcOperator: z.enum(['=', '<', '>', '<=', '>=']).optional(),
  set: z.string().optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'mythic']).optional(),
  format: z.string().optional(),
  power: z.string().optional(),
  powerOperator: z.enum(['=', '<', '>', '<=', '>=']).optional(),
  toughness: z.string().optional(),
  toughnessOperator: z.enum(['=', '<', '>', '<=', '>=']).optional(),
  maxPrice: z.number().optional(),
  artist: z.string().optional(),
  limit: z.number().min(1).max(500).optional(),
  offset: z.number().min(0).optional(),
});

// POST /api/cards/search - Search cards
router.post('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const filters = CardSearchSchema.parse(req.body);
    const cards = await CardModel.search(filters as CardSearchFilters);

    res.json({
      success: true,
      cards,
      count: cards.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid search filters',
        details: error.errors,
      });
    }

    console.error('Card search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search cards',
    });
  }
});

// GET /api/cards/:id - Get card by ID
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const card = await CardModel.getById(req.params.id);

    if (!card) {
      return res.status(404).json({
        success: false,
        error: 'Card not found',
      });
    }

    res.json({
      success: true,
      card,
    });
  } catch (error) {
    console.error('Get card error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get card',
    });
  }
});

// GET /api/cards/name/:name - Get card by name
router.get('/name/:name', requireAuth, async (req: Request, res: Response) => {
  try {
    const cards = await CardModel.getByName(req.params.name);

    res.json({
      success: true,
      cards,
      count: cards.length,
    });
  } catch (error) {
    console.error('Get card by name error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get card',
    });
  }
});

// POST /api/cards/fulltext - Full-text search
router.post('/fulltext', requireAuth, async (req: Request, res: Response) => {
  try {
    const { query, limit } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query string required',
      });
    }

    const cards = await CardModel.fullTextSearch(query, limit);

    res.json({
      success: true,
      cards,
      count: cards.length,
    });
  } catch (error) {
    console.error('Full-text search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search cards',
    });
  }
});

// GET /api/cards/stats - Get card database stats
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const totalCards = await CardModel.count();

    res.json({
      success: true,
      stats: {
        totalCards,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats',
    });
  }
});

export default router;
```

**Update:** `backend/src/index.ts`

```typescript
// Add to routes section
import cardsRouter from './routes/cards';
app.use('/api/cards', cardsRouter);
```

**Success Criteria:**
- [ ] All card API endpoints compile
- [ ] Zod validation working
- [ ] Routes registered in Express

---

### Task 6: Create Admin Sync Endpoint (1 hour)

**Update:** `backend/src/routes/admin.ts`

```typescript
import { ScryfallImportService } from '../services/scryfallImportService';

// POST /api/admin/sync/scryfall - Trigger Scryfall sync
router.post('/sync/scryfall', requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;

    // Run sync in background (don't block response)
    ScryfallImportService.syncFromScryfall(userId)
      .then((result) => {
        console.log('Scryfall sync completed:', result);
      })
      .catch((error) => {
        console.error('Scryfall sync failed:', error);
      });

    res.json({
      success: true,
      message: 'Scryfall sync started in background',
    });
  } catch (error) {
    console.error('Trigger sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger sync',
    });
  }
});

// GET /api/admin/sync/status - Get sync status
router.get('/sync/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, sync_type, status, cards_imported, rulings_imported,
              started_at, completed_at, duration_seconds, error_message
       FROM scryfall_sync_log
       ORDER BY started_at DESC
       LIMIT 10`
    );

    res.json({
      success: true,
      syncs: result.rows,
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status',
    });
  }
});
```

**Success Criteria:**
- [ ] Admin can trigger manual sync
- [ ] Admin can view sync history
- [ ] Sync runs in background

---

### Task 7: Create Cron Job for Auto-Sync (1 hour)

**Note:** This task creates the daily sync infrastructure for Scryfall data. Phase 2.3 will update this service to also check MTG Comprehensive Rules updates.

**Initial implementation (Phase 2.0):** Scryfall bulk data only
**Updated in Phase 2.3:** Adds MTG Rules sync integration

The job uses hash comparison to avoid unnecessary downloads/imports.

**Install dependency:**
```bash
cd backend
pnpm add node-cron
pnpm add -D @types/node-cron
```

**Create:** `backend/src/jobs/dailyDataSync.ts`

```typescript
import cron from 'node-cron';
import { ScryfallImportService } from '../services/scryfallImportService';
import crypto from 'crypto';
import axios from 'axios';
import pool from '../config/database';

// Track last known data hashes
interface DataHashes {
  scryfall_cards: string | null;
  scryfall_rulings: string | null;
  mtg_rules: string | null;
}

let lastKnownHashes: DataHashes = {
  scryfall_cards: null,
  scryfall_rulings: null,
  mtg_rules: null,
};

export function startDailyDataSync() {
  // Run daily at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('Starting scheduled data sync...');
    try {
      await checkAndSyncAllData();
      console.log('Scheduled data sync completed successfully');
    } catch (error) {
      console.error('Scheduled data sync failed:', error);
    }
  });

  // Load initial hashes from database on startup
  loadLastKnownHashes();

  console.log('Daily data sync job scheduled (daily at 3:00 AM)');
}

// Load last known hashes from database
async function loadLastKnownHashes() {
  try {
    const result = await pool.query(
      `SELECT data_type, hash FROM data_sync_hashes ORDER BY updated_at DESC LIMIT 3`
    );

    for (const row of result.rows) {
      if (row.data_type === 'scryfall_cards') lastKnownHashes.scryfall_cards = row.hash;
      if (row.data_type === 'scryfall_rulings') lastKnownHashes.scryfall_rulings = row.hash;
      if (row.data_type === 'mtg_rules') lastKnownHashes.mtg_rules = row.hash;
    }

    console.log('Loaded last known data hashes');
  } catch (error) {
    console.warn('Could not load last known hashes (table may not exist yet)');
  }
}

// Check and sync all data sources
async function checkAndSyncAllData() {
  let updateDetected = false;

  // 1. Check Scryfall bulk data
  const scryfallUpdated = await checkScryfallUpdates();
  if (scryfallUpdated) {
    console.log('Scryfall data update detected, syncing...');
    await ScryfallImportService.syncFromScryfall();
    updateDetected = true;
  }

  // 2. Check MTG Rules (Phase 2.3)
  const rulesUpdated = await checkRulesUpdates();
  if (rulesUpdated) {
    console.log('MTG Rules update detected, will sync in Phase 2.3');
    // Note: RulesImportService will be implemented in Phase 2.3
    updateDetected = true;
  }

  if (!updateDetected) {
    console.log('No updates detected for any data sources');
  }
}

// Check if Scryfall bulk data has been updated
async function checkScryfallUpdates(): Promise<boolean> {
  try {
    const response = await axios.get('https://api.scryfall.com/bulk-data');
    const bulkData = response.data.data;

    const cardsData = bulkData.find((item: any) => item.type === 'all_cards');
    const rulingsData = bulkData.find((item: any) => item.type === 'rulings');

    if (!cardsData || !rulingsData) {
      console.warn('Could not find Scryfall bulk data');
      return false;
    }

    // Use download_uri as a hash proxy (changes when data updates)
    const cardsHash = crypto.createHash('md5').update(cardsData.download_uri).digest('hex');
    const rulingsHash = crypto.createHash('md5').update(rulingsData.download_uri).digest('hex');

    const updated =
      cardsHash !== lastKnownHashes.scryfall_cards ||
      rulingsHash !== lastKnownHashes.scryfall_rulings;

    if (updated) {
      lastKnownHashes.scryfall_cards = cardsHash;
      lastKnownHashes.scryfall_rulings = rulingsHash;

      // Save hashes to database
      await saveDataHash('scryfall_cards', cardsHash);
      await saveDataHash('scryfall_rulings', rulingsHash);
    }

    return updated;
  } catch (error) {
    console.error('Error checking Scryfall updates:', error);
    return false;
  }
}

// Check if MTG Rules have been updated
async function checkRulesUpdates(): Promise<boolean> {
  try {
    // Download just the first 1KB to get the "effective as of" date
    const response = await axios.get(
      'https://media.wizards.com/2025/downloads/MagicCompRules%2020251114.txt',
      {
        headers: { Range: 'bytes=0-1024' },
        validateStatus: (status) => status === 206 || status === 200
      }
    );

    // Extract effective date from header
    const effectiveDateMatch = response.data.match(/effective as of ([^.]+)/i);
    const effectiveDate = effectiveDateMatch ? effectiveDateMatch[1] : null;

    if (!effectiveDate) {
      console.warn('Could not extract effective date from rules file');
      return false;
    }

    const rulesHash = crypto.createHash('md5').update(effectiveDate).digest('hex');

    const updated = rulesHash !== lastKnownHashes.mtg_rules;

    if (updated) {
      lastKnownHashes.mtg_rules = rulesHash;
      await saveDataHash('mtg_rules', rulesHash);
    }

    return updated;
  } catch (error) {
    console.error('Error checking MTG Rules updates:', error);
    return false;
  }
}

// Save data hash to database
async function saveDataHash(dataType: string, hash: string) {
  try {
    await pool.query(
      `INSERT INTO data_sync_hashes (data_type, hash)
       VALUES ($1, $2)
       ON CONFLICT (data_type) DO UPDATE SET hash = $2, updated_at = NOW()`,
      [dataType, hash]
    );
  } catch (error) {
    console.warn(`Could not save ${dataType} hash (table may not exist yet)`);
  }
}
```

**Create migration for hash tracking:**

`backend/src/migrations/015_create_data_sync_hashes.sql`

```sql
-- Track data sync hashes to detect updates
CREATE TABLE IF NOT EXISTS data_sync_hashes (
  data_type VARCHAR(50) PRIMARY KEY,
  hash VARCHAR(64) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_data_sync_hashes_updated ON data_sync_hashes(updated_at DESC);
```

**Update:** `backend/src/index.ts`

```typescript
import { startDailyDataSync } from './jobs/dailyDataSync';

// After server starts
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Start cron jobs
  startDailyDataSync();
});
```

**Success Criteria:**
- [ ] Cron job scheduled
- [ ] Runs at 3am daily
- [ ] Checks for Scryfall updates (hash comparison)
- [ ] Checks for Rules updates (effective date comparison)
- [ ] Only syncs when updates detected
- [ ] Logs execution

---

### Task 8: Initial Data Import (30-60 min)

**Manual sync to populate database:**

```bash
# Start backend server
cd backend
pnpm run dev

# In another terminal, trigger sync
curl -X POST http://localhost:3001/api/admin/sync/scryfall \
  -H "Cookie: connect.sid=<your-session-cookie>" \
  -H "Content-Type: application/json"

# Check sync status
curl http://localhost:3001/api/admin/sync/status \
  -H "Cookie: connect.sid=<your-session-cookie>"

# Wait for sync to complete (10-15 minutes)
# Check logs: ./dev.sh logs-backend
```

**Verification:**
```bash
# Check card count
curl http://localhost:3001/api/cards/stats \
  -H "Cookie: connect.sid=<your-session-cookie>"

# Should show ~25,000+ cards

# Test search
curl -X POST http://localhost:3001/api/cards/search \
  -H "Cookie: connect.sid=<your-session-cookie>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Lightning Bolt", "limit": 10}'

# Should return Lightning Bolt cards
```

**Success Criteria:**
- [ ] 25,000+ cards imported
- [ ] Rulings imported
- [ ] Search API working
- [ ] Card details accessible

---

## Testing

### Unit Tests

**Create:** `backend/tests/cardModel.test.ts`

```typescript
import { CardModel } from '../src/models/CardModel';

describe('CardModel', () => {
  describe('search', () => {
    it('should search cards by name', async () => {
      const cards = await CardModel.search({ name: 'Lightning Bolt', limit: 10 });
      expect(cards.length).toBeGreaterThan(0);
      expect(cards[0].name).toContain('Lightning Bolt');
    });

    it('should filter by color', async () => {
      const cards = await CardModel.search({ colors: ['R'], limit: 10 });
      expect(cards.length).toBeGreaterThan(0);
      cards.forEach(card => {
        expect(card.colors).toContain('R');
      });
    });

    it('should filter by CMC', async () => {
      const cards = await CardModel.search({ cmc: 3, cmcOperator: '<=', limit: 10 });
      expect(cards.length).toBeGreaterThan(0);
      cards.forEach(card => {
        expect(card.cmc).toBeLessThanOrEqual(3);
      });
    });

    it('should filter by format legality', async () => {
      const cards = await CardModel.search({ format: 'standard', limit: 10 });
      expect(cards.length).toBeGreaterThan(0);
      cards.forEach(card => {
        expect(card.legalities.standard).toBe('legal');
      });
    });
  });

  describe('fullTextSearch', () => {
    it('should find cards by text search', async () => {
      const cards = await CardModel.fullTextSearch('deals 3 damage', 20);
      expect(cards.length).toBeGreaterThan(0);
    });
  });
});
```

**Run tests:**
```bash
cd backend
pnpm test -- cardModel.test.ts
```

---

## Verification

### Database Verification
```bash
# Check tables
docker exec -it mtg-postgres psql -U mtg_user -d mtg_agent -c "
  SELECT
    (SELECT COUNT(*) FROM cards) as cards_count,
    (SELECT COUNT(*) FROM card_rulings) as rulings_count;
"

# Sample cards
docker exec -it mtg-postgres psql -U mtg_user -d mtg_agent -c "
  SELECT name, mana_cost, type_line, set_code, rarity
  FROM cards
  LIMIT 5;
"
```

### API Verification
```bash
# Search by name
curl -X POST http://localhost:3001/api/cards/search \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{"name": "bolt"}'

# Search by color
curl -X POST http://localhost:3001/api/cards/search \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{"colors": ["R"], "limit": 5}'

# Search Commander-legal cards
curl -X POST http://localhost:3001/api/cards/search \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{"format": "commander", "colorIdentity": ["R", "G"], "limit": 5}'
```

---

## Success Criteria

- [ ] Database schema created (cards, card_rulings, scryfall_sync_log tables)
- [ ] All indexes and triggers working
- [ ] Scryfall bulk data imported (25k+ cards, rulings)
- [ ] Card search API working with all filters
- [ ] Full-text search functional
- [ ] Admin sync endpoint working
- [ ] Daily auto-sync job scheduled
- [ ] Deck integrity protected (foreign key constraints)
- [ ] Tests passing (>70% coverage)
- [ ] API response time < 500ms for searches
- [ ] Documentation complete

---

## Common Issues & Troubleshooting

**Issue: Download fails**
```bash
# Check network connectivity
curl https://api.scryfall.com/bulk-data

# Check disk space
df -h
```

**Issue: Import slow**
- Batch imports in smaller chunks (reduce from 500 to 100)
- Check PostgreSQL connection pool settings
- Monitor Docker container resources

**Issue: Search returns no results**
- Check if cards imported: `SELECT COUNT(*) FROM cards;`
- Verify search_vector trigger: `SELECT search_vector FROM cards LIMIT 1;`
- Check filter values (case-sensitive)

**Issue: Deck corruption during sync**
- Foreign key constraint should prevent card deletion if referenced
- If sync fails, rollback happens automatically (transaction-based)
- Manual verification: `SELECT * FROM deck_cards WHERE card_id NOT IN (SELECT id FROM cards);`

---

## Rollback Procedure

If Phase 2.0 causes issues:

```bash
# Stop backend
./dev.sh stop

# Rollback migrations
cd backend
pnpm run migrate:rollback  # Rollback 013
pnpm run migrate:rollback  # Rollback 012
pnpm run migrate:rollback  # Rollback 011

# Restart
./dev.sh start
```

---

## Next Steps

After Phase 2.0 is complete:
- **Phase 2.1:** Deck Backend & API (build on card database)
- **Phase 2.2:** Format Validation (use card legalities data)

---

**Last Updated:** 2026-01-01
**Status:** Ready to implement
**Next:** Begin Task 1 (Database Migrations)
