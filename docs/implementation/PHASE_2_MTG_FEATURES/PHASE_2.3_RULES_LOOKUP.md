# Phase 2.3: Rules Lookup Backend

**Status:** ⏸️ Not Started
**Estimated Time:** 3-4 hours
**Prerequisites:** Phase 2.0 (Card Database) ✅

---

## Overview

Build a comprehensive MTG rules lookup system by importing the official MTG Comprehensive Rules document, parsing it into a searchable database, and providing a fast search API. Enable keyword searches, rule number lookups, and topic-based queries using PostgreSQL full-text search.

---

## Objectives

- Download and parse MTG Comprehensive Rules TXT file
- Create PostgreSQL schema for rules, keywords, and glossary
- Import all 900+ rules into database
- Implement full-text search for rules
- Build search API (by keyword, rule number, topic)
- Integrate card rulings from Scryfall data
- Support natural language queries

---

## Technical Decisions

### Data Source
- **MTG Comprehensive Rules:** Official TXT file from Wizards of the Coast
- **URL:** https://media.wizards.com/2025/downloads/MagicCompRules%2020251114.txt
- **Updates:** Quarterly (with each set release)
- **Size:** ~300KB text, 900+ numbered rules

### Storage Strategy
- **PostgreSQL tables:** Structured rules storage
- **Full-text search:** PostgreSQL's built-in tsvector/tsquery
- **No external dependencies:** Self-contained solution

### Search Approach
- **Keyword search:** "flying", "first strike", "commander damage"
- **Rule number search:** "100.1", "702.7"
- **Section search:** "combat", "stack", "priority"
- **Returns top N results** with relevance ranking

---

## Database Schema

### Migration 020: Rules Tables

```sql
-- backend/src/migrations/020_create_rules_tables.sql

-- Main rules table (numbered rules from Comprehensive Rules)
CREATE TABLE mtg_rules (
  id SERIAL PRIMARY KEY,

  -- Rule number (e.g., "100.1", "702.7a")
  rule_number VARCHAR(20) NOT NULL UNIQUE,

  -- Section information
  section_number VARCHAR(10),     -- "1", "7", etc.
  section_title VARCHAR(200),     -- "Game Concepts", "Additional Rules"

  -- Rule content
  content TEXT NOT NULL,

  -- Full-text search vector
  search_vector TSVECTOR,

  -- Metadata
  imported_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_mtg_rules_number ON mtg_rules(rule_number);
CREATE INDEX idx_mtg_rules_section ON mtg_rules(section_number);
CREATE INDEX idx_mtg_rules_search_vector ON mtg_rules USING GIN(search_vector);

-- Trigger to auto-update search_vector
CREATE OR REPLACE FUNCTION mtg_rules_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.rule_number, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.section_title, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mtg_rules_search_vector_trigger
  BEFORE INSERT OR UPDATE ON mtg_rules
  FOR EACH ROW EXECUTE FUNCTION mtg_rules_search_vector_update();

-- Keyword abilities table
CREATE TABLE mtg_keywords (
  id SERIAL PRIMARY KEY,

  -- Keyword name
  keyword VARCHAR(100) NOT NULL UNIQUE,

  -- Rule reference
  rule_number VARCHAR(20),

  -- Definition
  definition TEXT NOT NULL,

  -- Reminder text (short version)
  reminder_text TEXT,

  -- Search vector
  search_vector TSVECTOR,

  -- Metadata
  imported_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_mtg_keywords_keyword ON mtg_keywords(LOWER(keyword));
CREATE INDEX idx_mtg_keywords_search_vector ON mtg_keywords USING GIN(search_vector);

-- Trigger for keyword search vector
CREATE TRIGGER mtg_keywords_search_vector_trigger
  BEFORE INSERT OR UPDATE ON mtg_keywords
  FOR EACH ROW EXECUTE FUNCTION (
    SELECT setweight(to_tsvector('english', COALESCE(NEW.keyword, '')), 'A') ||
           setweight(to_tsvector('english', COALESCE(NEW.definition, '')), 'B')
    INTO NEW.search_vector
  );

-- Glossary table
CREATE TABLE mtg_glossary (
  id SERIAL PRIMARY KEY,

  -- Term
  term VARCHAR(200) NOT NULL UNIQUE,

  -- Definition
  definition TEXT NOT NULL,

  -- Related rule
  rule_reference VARCHAR(20),

  -- Search vector
  search_vector TSVECTOR,

  -- Metadata
  imported_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_mtg_glossary_term ON mtg_glossary(LOWER(term));
CREATE INDEX idx_mtg_glossary_search_vector ON mtg_glossary USING GIN(search_vector);

-- Trigger for glossary search vector
CREATE TRIGGER mtg_glossary_search_vector_trigger
  BEFORE INSERT OR UPDATE ON mtg_glossary
  FOR EACH ROW EXECUTE FUNCTION (
    SELECT setweight(to_tsvector('english', COALESCE(NEW.term, '')), 'A') ||
           setweight(to_tsvector('english', COALESCE(NEW.definition, '')), 'B')
    INTO NEW.search_vector
  );

-- Trigger to auto-update updated_at
CREATE TRIGGER mtg_rules_updated_at_trigger
  BEFORE UPDATE ON mtg_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Implementation Tasks

### Task 1: Create Database Migration (15 min)

**Steps:**
```bash
# Create migration file
touch backend/src/migrations/020_create_rules_tables.sql

# Add SQL schema from above

# Run migration
cd backend
pnpm run migrate
```

**Verification:**
```bash
docker exec -it mtg-postgres psql -U mtg_user -d mtg_agent -c "\dt mtg_*"

# Should show: mtg_rules, mtg_keywords, mtg_glossary
```

**Success Criteria:**
- [ ] All 3 tables created
- [ ] Indexes and triggers working
- [ ] Full-text search vectors configured

---

### Task 2: Create Rules Parser Service (1.5-2 hours)

**Note:** Parser updated based on actual Comprehensive Rules file structure (reviewed 2026-01-01)

**Create:** `backend/src/services/rulesParserService.ts`

```typescript
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface ParsedRule {
  rule_number: string;
  section_number: string;
  section_title: string;
  content: string;
}

export interface ParsedKeyword {
  keyword: string;
  rule_number: string;
  definition: string;
  reminder_text?: string;
}

export interface ParsedGlossaryTerm {
  term: string;
  definition: string;
  rule_reference?: string;
}

export class RulesParserService {
  private static readonly RULES_URL = 'https://media.wizards.com/2025/downloads/MagicCompRules%2020251114.txt';
  private static readonly TEMP_DIR = path.join(__dirname, '../../temp');

  // Download Comprehensive Rules TXT
  static async downloadRules(): Promise<string> {
    console.log('Downloading MTG Comprehensive Rules...');

    // Ensure temp directory exists
    if (!fs.existsSync(this.TEMP_DIR)) {
      fs.mkdirSync(this.TEMP_DIR, { recursive: true });
    }

    const response = await axios.get(this.RULES_URL);
    const filepath = path.join(this.TEMP_DIR, 'comp_rules.txt');

    fs.writeFileSync(filepath, response.data, 'utf-8');
    console.log(`Downloaded rules to ${filepath}`);

    return filepath;
  }

  // Parse Comprehensive Rules TXT file
  static async parseRules(filepath: string): Promise<{
    rules: ParsedRule[];
    keywords: ParsedKeyword[];
    glossary: ParsedGlossaryTerm[];
  }> {
    console.log('Parsing Comprehensive Rules...');

    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split('\n');

    const rules: ParsedRule[] = [];
    const keywords: ParsedKeyword[] = [];
    const glossary: ParsedGlossaryTerm[] = [];

    let currentSection = '';
    let currentSectionNumber = '';
    let inGlossary = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line) continue;

      // Detect glossary section (exact match)
      if (line === 'Glossary') {
        inGlossary = true;
        continue;
      }

      // Detect section headers (e.g., "1. Game Concepts")
      // Must be short (< 100 chars) to avoid matching rules
      const sectionMatch = line.match(/^(\d+)\.\s+(.+)$/);
      if (sectionMatch && line.length < 100 && !inGlossary) {
        currentSectionNumber = sectionMatch[1];
        currentSection = sectionMatch[2];
        continue;
      }

      // Parse numbered rules (e.g., "100.1" or "100.1a")
      // Format: [number].[number][optional letter] [content]
      const ruleMatch = line.match(/^(\d+\.\d+[a-z]?)\.\s+(.+)$/);
      if (ruleMatch && !inGlossary) {
        const ruleNumber = ruleMatch[1];
        const ruleContent = ruleMatch[2];

        rules.push({
          rule_number: ruleNumber,
          section_number: currentSectionNumber,
          section_title: currentSection,
          content: ruleContent,
        });

        // Extract keywords from Section 702
        if (ruleNumber.startsWith('702.') && ruleNumber.match(/^702\.\d+$/)) {
          // Main keyword rule (e.g., "702.2. Deathtouch")
          const keywordName = ruleContent;
          keywords.push({
            keyword: keywordName,
            rule_number: ruleNumber,
            definition: `See rule ${ruleNumber}`,
          });
        }

        continue;
      }

      // Parse glossary entries
      // Format: Term (starts at beginning of line, no indent)
      // Followed by definition on next line(s)
      if (inGlossary) {
        // Check if this line is a term (no leading spaces, not a continuation)
        if (line[0] !== ' ' && !line.match(/^\d+\./) && line.length > 0) {
          // This is a term
          const term = line;
          let definition = '';

          // Collect definition lines (may span multiple lines)
          let j = i + 1;
          while (j < lines.length) {
            const nextLine = lines[j].trim();

            // Stop if we hit another term (line starts without space and isn't a number)
            if (nextLine && nextLine[0] !== ' ' && !nextLine.match(/^\d+\./)) {
              break;
            }

            // Add to definition if it's content
            if (nextLine) {
              definition += (definition ? ' ' : '') + nextLine;
            }
            j++;
          }

          if (definition) {
            // Extract rule reference if present
            const ruleRefMatch = definition.match(/See rule (\d+\.?\d*[a-z]?)/);
            const ruleReference = ruleRefMatch ? ruleRefMatch[1] : undefined;

            glossary.push({
              term,
              definition,
              rule_reference: ruleReference,
            });
          }

          i = j - 1; // Skip processed lines
        }
      }
    }

    console.log(`Parsed ${rules.length} rules, ${keywords.length} keywords, ${glossary.length} glossary terms`);

    return { rules, keywords, glossary };
  }

  // Clean up temp files
  static cleanupTempFiles(): void {
    if (fs.existsSync(this.TEMP_DIR)) {
      fs.rmSync(this.TEMP_DIR, { recursive: true, force: true });
      console.log('Cleaned up temp files');
    }
  }
}
```

**Success Criteria:**
- [ ] Service compiles without errors
- [ ] Can download rules TXT file
- [ ] Parser extracts rules correctly
- [ ] Identifies keywords and glossary

---

### Task 3: Create Rules Import Service (1 hour)

**Note:** This service integrates with the unified daily sync system from Phase 2.0. The `dailyDataSync.ts` cron job checks for MTG Rules updates (via effective date hash comparison) and calls `RulesImportService.importRules()` when updates are detected.

**Create:** `backend/src/services/rulesImportService.ts`

```typescript
import pool from '../config/database';
import { RulesParserService } from './rulesParserService';
import crypto from 'crypto';

export class RulesImportService {
  // Import all rules into database
  static async importRules(): Promise<{
    rulesImported: number;
    keywordsImported: number;
    glossaryImported: number;
    effectiveDate: string;
  }> {
    console.log('Starting MTG rules import...');

    try {
      // Download rules
      const filepath = await RulesParserService.downloadRules();

      // Parse rules
      const { rules, keywords, glossary } = await RulesParserService.parseRules(filepath);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Clear existing rules
        await client.query('DELETE FROM mtg_rules');
        await client.query('DELETE FROM mtg_keywords');
        await client.query('DELETE FROM mtg_glossary');

        // Import rules
        let rulesImported = 0;
        for (const rule of rules) {
          await client.query(
            `INSERT INTO mtg_rules (rule_number, section_number, section_title, content)
             VALUES ($1, $2, $3, $4)`,
            [rule.rule_number, rule.section_number, rule.section_title, rule.content]
          );
          rulesImported++;

          if (rulesImported % 100 === 0) {
            console.log(`Imported ${rulesImported}/${rules.length} rules...`);
          }
        }

        // Import keywords
        let keywordsImported = 0;
        for (const keyword of keywords) {
          await client.query(
            `INSERT INTO mtg_keywords (keyword, rule_number, definition)
             VALUES ($1, $2, $3)
             ON CONFLICT (keyword) DO UPDATE
             SET rule_number = EXCLUDED.rule_number,
                 definition = EXCLUDED.definition`,
            [keyword.keyword, keyword.rule_number, keyword.definition]
          );
          keywordsImported++;
        }

        // Import glossary
        let glossaryImported = 0;
        for (const term of glossary) {
          await client.query(
            `INSERT INTO mtg_glossary (term, definition, rule_reference)
             VALUES ($1, $2, $3)
             ON CONFLICT (term) DO UPDATE
             SET definition = EXCLUDED.definition`,
            [term.term, term.definition, term.rule_reference || null]
          );
          glossaryImported++;
        }

        await client.query('COMMIT');

        console.log(`Successfully imported ${rulesImported} rules, ${keywordsImported} keywords, ${glossaryImported} glossary terms`);

        // Cleanup
        RulesParserService.cleanupTempFiles();

        // Extract effective date for hash tracking (used by daily sync)
        const fs = require('fs');
        const rulesContent = fs.readFileSync(filepath, 'utf-8');
        const effectiveDateMatch = rulesContent.match(/effective as of ([^.]+)/i);
        const effectiveDate = effectiveDateMatch ? effectiveDateMatch[1].trim() : new Date().toISOString();

        return { rulesImported, keywordsImported, glossaryImported, effectiveDate };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Rules import failed:', error);
      throw error;
    }
  }

  // Check if rules need updating (called by daily sync job)
  static async checkForUpdates(): Promise<{
    hasUpdates: boolean;
    currentHash: string;
    effectiveDate?: string;
  }> {
    try {
      // Download rules file to check effective date
      const filepath = await RulesParserService.downloadRules();
      const fs = require('fs');
      const rulesContent = fs.readFileSync(filepath, 'utf-8');

      // Extract effective date from header
      const effectiveDateMatch = rulesContent.match(/effective as of ([^.]+)/i);
      const effectiveDate = effectiveDateMatch ? effectiveDateMatch[1].trim() : '';

      if (!effectiveDate) {
        console.warn('Could not extract effective date from rules file');
        return { hasUpdates: false, currentHash: '' };
      }

      // Hash the effective date
      const currentHash = crypto.createHash('md5').update(effectiveDate).digest('hex');

      // Get last known hash from database
      const result = await pool.query(
        `SELECT hash FROM data_sync_hashes WHERE data_type = 'mtg_rules' ORDER BY checked_at DESC LIMIT 1`
      );

      const lastKnownHash = result.rows[0]?.hash;

      // Cleanup temp file
      RulesParserService.cleanupTempFiles();

      return {
        hasUpdates: currentHash !== lastKnownHash,
        currentHash,
        effectiveDate,
      };
    } catch (error) {
      console.error('Error checking for rules updates:', error);
      return { hasUpdates: false, currentHash: '' };
    }
  }
}
```

**Integration with Daily Sync:**

Phase 2.0 created a stub `checkRulesUpdates()` function in `dailyDataSync.ts` that detects updates but doesn't import. This task updates that function to actually import rules when updates are detected.

**Update:** `backend/src/jobs/dailyDataSync.ts` - Replace the existing `checkRulesUpdates()` function:

```typescript
// In backend/src/jobs/dailyDataSync.ts (replace existing function)
import { RulesImportService } from '../services/rulesImportService';  // Add this import

async function checkRulesUpdates(): Promise<boolean> {
  const { hasUpdates, currentHash, effectiveDate } = await RulesImportService.checkForUpdates();

  if (hasUpdates) {
    console.log(`MTG Rules update detected (${effectiveDate})`);

    // Import new rules
    await RulesImportService.importRules();

    // Update hash tracking
    await pool.query(
      `INSERT INTO data_sync_hashes (data_type, hash, checked_at)
       VALUES ('mtg_rules', $1, NOW())`,
      [currentHash]
    );

    return true;
  }

  return false;
}
```

**Success Criteria:**
- [ ] Service compiles without errors
- [ ] Imports all rules successfully
- [ ] Handles duplicates correctly
- [ ] Transaction-safe (rollback on error)
- [ ] Returns effective date for hash tracking
- [ ] `checkForUpdates()` detects rule changes
- [ ] Integrates with daily sync job

---

### Task 4: Create Rules Model (30 min)

**Create:** `backend/src/models/RulesModel.ts`

```typescript
import pool from '../config/database';
import { QueryResult } from 'pg';

export interface MtgRule {
  id: number;
  rule_number: string;
  section_number: string;
  section_title: string;
  content: string;
  imported_at: Date;
  updated_at: Date;
}

export interface MtgKeyword {
  id: number;
  keyword: string;
  rule_number: string;
  definition: string;
  reminder_text?: string;
  imported_at: Date;
}

export interface MtgGlossaryTerm {
  id: number;
  term: string;
  definition: string;
  rule_reference?: string;
  imported_at: Date;
}

export class RulesModel {
  // Search rules by keyword or phrase
  static async search(query: string, limit = 10): Promise<MtgRule[]> {
    const result: QueryResult<MtgRule> = await pool.query(
      `SELECT *, ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
       FROM mtg_rules
       WHERE search_vector @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC, rule_number ASC
       LIMIT $2`,
      [query, limit]
    );

    return result.rows;
  }

  // Get rule by exact number
  static async getByNumber(ruleNumber: string): Promise<MtgRule | null> {
    const result: QueryResult<MtgRule> = await pool.query(
      'SELECT * FROM mtg_rules WHERE rule_number = $1',
      [ruleNumber]
    );

    return result.rows[0] || null;
  }

  // Get all rules in a section
  static async getBySection(sectionNumber: string): Promise<MtgRule[]> {
    const result: QueryResult<MtgRule> = await pool.query(
      `SELECT * FROM mtg_rules
       WHERE section_number = $1
       ORDER BY rule_number ASC`,
      [sectionNumber]
    );

    return result.rows;
  }

  // Search keywords
  static async searchKeywords(query: string, limit = 10): Promise<MtgKeyword[]> {
    const result: QueryResult<MtgKeyword> = await pool.query(
      `SELECT *, ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
       FROM mtg_keywords
       WHERE search_vector @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT $2`,
      [query, limit]
    );

    return result.rows;
  }

  // Get keyword by name
  static async getKeyword(keyword: string): Promise<MtgKeyword | null> {
    const result: QueryResult<MtgKeyword> = await pool.query(
      'SELECT * FROM mtg_keywords WHERE LOWER(keyword) = LOWER($1)',
      [keyword]
    );

    return result.rows[0] || null;
  }

  // Search glossary
  static async searchGlossary(query: string, limit = 10): Promise<MtgGlossaryTerm[]> {
    const result: QueryResult<MtgGlossaryTerm> = await pool.query(
      `SELECT *, ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
       FROM mtg_glossary
       WHERE search_vector @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT $2`,
      [query, limit]
    );

    return result.rows;
  }

  // Get total counts
  static async getCounts(): Promise<{ rules: number; keywords: number; glossary: number }> {
    const rulesCount = await pool.query('SELECT COUNT(*) FROM mtg_rules');
    const keywordsCount = await pool.query('SELECT COUNT(*) FROM mtg_keywords');
    const glossaryCount = await pool.query('SELECT COUNT(*) FROM mtg_glossary');

    return {
      rules: parseInt(rulesCount.rows[0].count),
      keywords: parseInt(keywordsCount.rows[0].count),
      glossary: parseInt(glossaryCount.rows[0].count),
    };
  }
}
```

**Success Criteria:**
- [ ] Model compiles without errors
- [ ] All search methods defined
- [ ] Full-text search working
- [ ] Lookup by number/name working

---

### Task 5: Create Rules API Routes (30 min)

**Create:** `backend/src/routes/rules.ts`

```typescript
import { Router, Request, Response } from 'express';
import { RulesModel } from '../models/RulesModel';
import { RulesImportService } from '../services/rulesImportService';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router: Router = Router();

// GET /api/rules/search - Search rules
router.get('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const { q, limit } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter required',
      });
    }

    const rules = await RulesModel.search(q, limit ? parseInt(limit as string) : 10);

    res.json({
      success: true,
      rules,
      count: rules.length,
    });
  } catch (error) {
    console.error('Search rules error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search rules',
    });
  }
});

// GET /api/rules/:number - Get rule by number
router.get('/:number', requireAuth, async (req: Request, res: Response) => {
  try {
    const rule = await RulesModel.getByNumber(req.params.number);

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found',
      });
    }

    res.json({
      success: true,
      rule,
    });
  } catch (error) {
    console.error('Get rule error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rule',
    });
  }
});

// GET /api/rules/section/:number - Get all rules in section
router.get('/section/:number', requireAuth, async (req: Request, res: Response) => {
  try {
    const rules = await RulesModel.getBySection(req.params.number);

    res.json({
      success: true,
      rules,
      count: rules.length,
    });
  } catch (error) {
    console.error('Get section rules error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get section rules',
    });
  }
});

// GET /api/rules/keywords/search - Search keywords
router.get('/keywords/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const { q, limit } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter required',
      });
    }

    const keywords = await RulesModel.searchKeywords(q, limit ? parseInt(limit as string) : 10);

    res.json({
      success: true,
      keywords,
      count: keywords.length,
    });
  } catch (error) {
    console.error('Search keywords error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search keywords',
    });
  }
});

// GET /api/rules/keywords/:name - Get keyword by name
router.get('/keywords/:name', requireAuth, async (req: Request, res: Response) => {
  try {
    const keyword = await RulesModel.getKeyword(req.params.name);

    if (!keyword) {
      return res.status(404).json({
        success: false,
        error: 'Keyword not found',
      });
    }

    res.json({
      success: true,
      keyword,
    });
  } catch (error) {
    console.error('Get keyword error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get keyword',
    });
  }
});

// GET /api/rules/glossary/search - Search glossary
router.get('/glossary/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const { q, limit } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter required',
      });
    }

    const terms = await RulesModel.searchGlossary(q, limit ? parseInt(limit as string) : 10);

    res.json({
      success: true,
      terms,
      count: terms.length,
    });
  } catch (error) {
    console.error('Search glossary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search glossary',
    });
  }
});

// GET /api/rules/stats - Get rules statistics
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const counts = await RulesModel.getCounts();

    res.json({
      success: true,
      stats: counts,
    });
  } catch (error) {
    console.error('Get rules stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stats',
    });
  }
});

// POST /api/rules/import - Import rules (admin only)
router.post('/import', requireAdmin, async (req: Request, res: Response) => {
  try {
    // Run import in background
    RulesImportService.importRules()
      .then((result) => {
        console.log('Rules import completed:', result);
      })
      .catch((error) => {
        console.error('Rules import failed:', error);
      });

    res.json({
      success: true,
      message: 'Rules import started in background',
    });
  } catch (error) {
    console.error('Trigger import error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger import',
    });
  }
});

export default router;
```

**Update:** `backend/src/index.ts`

```typescript
import rulesRouter from './routes/rules';
app.use('/api/rules', rulesRouter);
```

**Success Criteria:**
- [ ] All routes compile
- [ ] Search endpoints working
- [ ] Lookup endpoints working
- [ ] Admin import endpoint working

---

### Task 6: Initial Rules Import (15 min)

**Manual import to populate database:**

```bash
# Start backend
cd backend
pnpm run dev

# Trigger rules import (as admin)
curl -X POST http://localhost:3001/api/rules/import \
  -H "Cookie: connect.sid=<admin-session>" \
  -H "Content-Type: application/json"

# Check import status (wait 1-2 minutes)
curl http://localhost:3001/api/rules/stats \
  -H "Cookie: connect.sid=<session>"

# Should show ~900 rules, ~100 keywords, ~200 glossary terms
```

**Verification:**
```bash
# Search for "flying"
curl "http://localhost:3001/api/rules/search?q=flying&limit=5" \
  -H "Cookie: connect.sid=<session>"

# Get specific rule
curl http://localhost:3001/api/rules/702.9 \
  -H "Cookie: connect.sid=<session>"

# Search keywords
curl "http://localhost:3001/api/rules/keywords/search?q=first%20strike" \
  -H "Cookie: connect.sid=<session>"
```

**Success Criteria:**
- [ ] 900+ rules imported
- [ ] Keywords imported
- [ ] Glossary imported
- [ ] Search returns relevant results

---

## Verification

### Database Verification
```bash
# Check counts
docker exec -it mtg-postgres psql -U mtg_user -d mtg_agent -c "
  SELECT
    (SELECT COUNT(*) FROM mtg_rules) as rules_count,
    (SELECT COUNT(*) FROM mtg_keywords) as keywords_count,
    (SELECT COUNT(*) FROM mtg_glossary) as glossary_count;
"

# Sample rules
docker exec -it mtg-postgres psql -U mtg_user -d mtg_agent -c "
  SELECT rule_number, LEFT(content, 80)
  FROM mtg_rules
  LIMIT 5;
"

# Sample keywords
docker exec -it mtg-postgres psql -U mtg_user -d mtg_agent -c "
  SELECT keyword, LEFT(definition, 60)
  FROM mtg_keywords
  LIMIT 5;
"
```

### API Verification
```bash
# Full-text search
curl "http://localhost:3001/api/rules/search?q=combat+damage&limit=5" \
  -H "Cookie: connect.sid=<session>"

# Rule number lookup
curl http://localhost:3001/api/rules/100.1 \
  -H "Cookie: connect.sid=<session>"

# Section lookup
curl http://localhost:3001/api/rules/section/7 \
  -H "Cookie: connect.sid=<session>"

# Keyword search
curl "http://localhost:3001/api/rules/keywords/search?q=trample" \
  -H "Cookie: connect.sid=<session>"

# Keyword lookup
curl http://localhost:3001/api/rules/keywords/Flying \
  -H "Cookie: connect.sid=<session>"

# Glossary search
curl "http://localhost:3001/api/rules/glossary/search?q=activated+ability" \
  -H "Cookie: connect.sid=<session>"
```

---

## Success Criteria

- [ ] Database tables created (mtg_rules, mtg_keywords, mtg_glossary)
- [ ] Full-text search indexes working
- [ ] Rules parser extracts 900+ rules
- [ ] Keywords extracted from Section 702
- [ ] Glossary terms extracted
- [ ] Import service populates database
- [ ] Search API returns relevant results
- [ ] Rule number lookup works
- [ ] Keyword search works
- [ ] Admin import endpoint functional
- [ ] Search response time < 2s

---

## Common Issues & Troubleshooting

**Issue: Rules file format changed**
- Wizards may update the format
- Check line parsing logic
- Adjust regex patterns

**Issue: Parser misses rules**
- Verify rule number regex: `/^\d+\.\d+[a-z]?/`
- Check for multi-line rules
- Review section detection

**Issue: Search returns no results**
- Check if search_vector populated: `SELECT search_vector FROM mtg_rules LIMIT 1;`
- Verify triggers are firing
- Re-import rules if needed

**Issue: Import slow**
- Batch inserts instead of one-by-one
- Use COPY command for bulk insert (advanced)
- Disable triggers during import, rebuild after

---

## Next Steps

After Phase 2.3 is complete:
- **Phase 2.4:** Deck Builder UI (frontend deck construction interface)
- **Phase 2.11:** Rules Assistant Tools (Agent SDK integration for Claude to answer rules questions)

---

**Last Updated:** 2026-01-01
**Status:** Ready to implement
**Next:** Begin Task 1 (Database Migration)
