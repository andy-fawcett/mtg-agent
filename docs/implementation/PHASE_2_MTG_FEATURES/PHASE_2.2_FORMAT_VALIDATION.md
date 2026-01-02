# Phase 2.2: Format Validation

**Status:** ⏸️ Not Started
**Estimated Time:** 4-6 hours
**Prerequisites:** Phase 2.0 (Card Database) ✅, Phase 2.1 (Deck Backend) ✅

---

## Overview

Implement comprehensive format validation for all MTG formats using Scryfall legality data. Validate decks automatically on every card add/update/remove operation, marking decks as legal or illegal without blocking saves. Support all major format rules including Commander color identity, partner validation, and format-specific deck construction rules.

---

## Objectives

- Validate deck legality for all formats using Scryfall data
- Mark decks as `is_legal` (boolean) - no intermediate warning levels
- Auto-validate on every card operation (add/update/remove)
- Never block saves - always allow deck updates
- Commander color identity validation using Scryfall's `color_identity` field
- Partner commander validation using Scryfall's `keywords` field
- Support all major format-specific rules (deck size, card limits, sideboard size)
- Calculate validation on-demand (no caching)

---

## Technical Decisions

### Data Source
- **Use Scryfall legalities** - `cards.legalities` JSONB field contains format legality
- **No custom banned list tables** - Scryfall data is authoritative and updates daily

### Validation Levels
- **Binary only:** `is_legal` boolean (true/false)
- **No warnings/errors distinction** - just legal or illegal
- **Never block saves** - validation is informational only

### Commander-Specific
- **Color identity:** Use Scryfall's `color_identity` field (handles all edge cases)
- **Partner validation:** Use Scryfall's `keywords` array ("Partner", "Partner with [Name]")
- **Ignore Companion** for now (complex, deferred to Phase 5)

### Format Rules
- **All formats supported:** Standard, Modern, Commander, Pioneer, Legacy, Vintage, Pauper, etc.
- **Format-specific rules:** Deck size, card limits, sideboard size, singleton rules

### Validation Timing
- **Auto-validate:** On every card add/update/remove
- **On-demand:** User can request validation
- **Calculate fresh:** No caching (simple, always up-to-date)

---

## Database Schema Updates

### Migration 019: Add Validation Fields to Decks

```sql
-- backend/src/migrations/019_add_deck_validation_fields.sql

ALTER TABLE decks
  ADD COLUMN is_legal BOOLEAN DEFAULT NULL,
  ADD COLUMN validation_errors JSONB DEFAULT '[]',
  ADD COLUMN last_validated_at TIMESTAMP;

-- Index for filtering legal/illegal decks
CREATE INDEX idx_decks_is_legal ON decks(is_legal) WHERE is_legal IS NOT NULL;

COMMENT ON COLUMN decks.is_legal IS 'Deck legality for its format (true=legal, false=illegal, null=not validated)';
COMMENT ON COLUMN decks.validation_errors IS 'Array of validation error objects: [{"type": "banned_card", "message": "...", "card_id": "..."}]';
COMMENT ON COLUMN decks.last_validated_at IS 'Timestamp of last validation check';
```

---

## Implementation Tasks

### Task 1: Create Database Migration (10 min)

**Steps:**
```bash
# Create migration file
touch backend/src/migrations/019_add_deck_validation_fields.sql

# Add SQL from above

# Run migration
cd backend
pnpm run migrate
```

**Verification:**
```bash
docker exec -it mtg-postgres psql -U mtg_user -d mtg_agent -c "\d decks"
# Should show: is_legal, validation_errors, last_validated_at columns
```

**Success Criteria:**
- [ ] New columns added to decks table
- [ ] Index created on is_legal
- [ ] Migration runs without errors

---

### Task 2: Update Deck Types (10 min)

**Update:** `backend/src/types/deck.types.ts`

```typescript
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
  is_legal: boolean | null;  // NEW: Deck legality
  validation_errors: ValidationError[];  // NEW: List of errors
  last_validated_at: Date | null;  // NEW: Last validation timestamp
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface ValidationError {
  type: string;  // 'banned_card', 'deck_size', 'card_limit', 'color_identity', 'commander_missing', etc.
  message: string;
  card_id?: string;  // Optional: reference to problematic card
  card_name?: string;
}
```

---

### Task 3: Create Format Rules Service (1 hour)

**Create:** `backend/src/services/formatRulesService.ts`

```typescript
import { DeckFormat } from '../types/deck.types';

export interface FormatRules {
  minDeckSize: number;
  maxDeckSize: number | null;  // null = no max
  maxCopies: number;  // 4 for most, 1 for singleton formats
  maxSideboardSize: number | null;  // null = no sideboard
  requiresCommander: boolean;
  allowsPartners: boolean;
  isSingleton: boolean;
}

export class FormatRulesService {
  // Get rules for a specific format
  static getRules(format: DeckFormat): FormatRules {
    const rules: Record<DeckFormat, FormatRules> = {
      standard: {
        minDeckSize: 60,
        maxDeckSize: null,
        maxCopies: 4,
        maxSideboardSize: 15,
        requiresCommander: false,
        allowsPartners: false,
        isSingleton: false,
      },
      modern: {
        minDeckSize: 60,
        maxDeckSize: null,
        maxCopies: 4,
        maxSideboardSize: 15,
        requiresCommander: false,
        allowsPartners: false,
        isSingleton: false,
      },
      pioneer: {
        minDeckSize: 60,
        maxDeckSize: null,
        maxCopies: 4,
        maxSideboardSize: 15,
        requiresCommander: false,
        allowsPartners: false,
        isSingleton: false,
      },
      legacy: {
        minDeckSize: 60,
        maxDeckSize: null,
        maxCopies: 4,
        maxSideboardSize: 15,
        requiresCommander: false,
        allowsPartners: false,
        isSingleton: false,
      },
      vintage: {
        minDeckSize: 60,
        maxDeckSize: null,
        maxCopies: 4,
        maxSideboardSize: 15,
        requiresCommander: false,
        allowsPartners: false,
        isSingleton: false,
      },
      commander: {
        minDeckSize: 100,
        maxDeckSize: 100,
        maxCopies: 1,
        maxSideboardSize: null,
        requiresCommander: true,
        allowsPartners: true,
        isSingleton: true,
      },
      brawl: {
        minDeckSize: 60,
        maxDeckSize: 60,
        maxCopies: 1,
        maxSideboardSize: null,
        requiresCommander: true,
        allowsPartners: false,
        isSingleton: true,
      },
      pauper: {
        minDeckSize: 60,
        maxDeckSize: null,
        maxCopies: 4,
        maxSideboardSize: 15,
        requiresCommander: false,
        allowsPartners: false,
        isSingleton: false,
      },
      historic: {
        minDeckSize: 60,
        maxDeckSize: null,
        maxCopies: 4,
        maxSideboardSize: 15,
        requiresCommander: false,
        allowsPartners: false,
        isSingleton: false,
      },
      explorer: {
        minDeckSize: 60,
        maxDeckSize: null,
        maxCopies: 4,
        maxSideboardSize: 15,
        requiresCommander: false,
        allowsPartners: false,
        isSingleton: false,
      },
      alchemy: {
        minDeckSize: 60,
        maxDeckSize: null,
        maxCopies: 4,
        maxSideboardSize: 15,
        requiresCommander: false,
        allowsPartners: false,
        isSingleton: false,
      },
      timeless: {
        minDeckSize: 60,
        maxDeckSize: null,
        maxCopies: 4,
        maxSideboardSize: 15,
        requiresCommander: false,
        allowsPartners: false,
        isSingleton: false,
      },
      oathbreaker: {
        minDeckSize: 60,
        maxDeckSize: 60,
        maxCopies: 1,
        maxSideboardSize: null,
        requiresCommander: true,  // Oathbreaker + Signature Spell
        allowsPartners: false,
        isSingleton: true,
      },
      duel_commander: {
        minDeckSize: 100,
        maxDeckSize: 100,
        maxCopies: 1,
        maxSideboardSize: null,
        requiresCommander: true,
        allowsPartners: true,
        isSingleton: true,
      },
      penny_dreadful: {
        minDeckSize: 60,
        maxDeckSize: null,
        maxCopies: 4,
        maxSideboardSize: 15,
        requiresCommander: false,
        allowsPartners: false,
        isSingleton: false,
      },
      premodern: {
        minDeckSize: 60,
        maxDeckSize: null,
        maxCopies: 4,
        maxSideboardSize: 15,
        requiresCommander: false,
        allowsPartners: false,
        isSingleton: false,
      },
      oldschool: {
        minDeckSize: 60,
        maxDeckSize: null,
        maxCopies: 4,
        maxSideboardSize: null,
        requiresCommander: false,
        allowsPartners: false,
        isSingleton: false,
      },
      casual: {
        minDeckSize: 60,
        maxDeckSize: null,
        maxCopies: 4,
        maxSideboardSize: null,
        requiresCommander: false,
        allowsPartners: false,
        isSingleton: false,
      },
    };

    return rules[format];
  }

  // Check if a card name is a basic land (exempt from card limits)
  static isBasicLand(cardName: string): boolean {
    const basicLands = [
      'Plains',
      'Island',
      'Swamp',
      'Mountain',
      'Forest',
      'Wastes',
      'Snow-Covered Plains',
      'Snow-Covered Island',
      'Snow-Covered Swamp',
      'Snow-Covered Mountain',
      'Snow-Covered Forest',
    ];

    return basicLands.includes(cardName);
  }
}
```

---

### Task 4: Rewrite Deck Validation Service (2-3 hours)

**Note:** Phase 2.1 created a basic validation stub. This task replaces it with comprehensive format validation using Scryfall legalities data.

**Update:** `backend/src/services/deckValidationService.ts` (replace existing stub)

```typescript
import { DeckWithCards, ValidationError, DeckFormat } from '../types/deck.types';
import { FormatRulesService } from './formatRulesService';
import pool from '../config/database';

export class DeckValidationService {
  // Main validation function
  static async validate(deck: DeckWithCards): Promise<{ isLegal: boolean; errors: ValidationError[] }> {
    const errors: ValidationError[] = [];

    // Get format rules
    const rules = FormatRulesService.getRules(deck.format);

    // 1. Check deck size
    const mainDeckSize = deck.cards.main.reduce((sum, card) => sum + card.quantity, 0);

    if (mainDeckSize < rules.minDeckSize) {
      errors.push({
        type: 'deck_size_minimum',
        message: `Deck has ${mainDeckSize} cards, minimum is ${rules.minDeckSize} for ${deck.format}`,
      });
    }

    if (rules.maxDeckSize && mainDeckSize > rules.maxDeckSize) {
      errors.push({
        type: 'deck_size_maximum',
        message: `Deck has ${mainDeckSize} cards, maximum is ${rules.maxDeckSize} for ${deck.format}`,
      });
    }

    // 2. Check card limits (4-of rule or singleton)
    const cardCounts: Record<string, { name: string; count: number; cardId: string }> = {};

    for (const card of [...deck.cards.main, ...deck.cards.sideboard]) {
      if (!cardCounts[card.name]) {
        cardCounts[card.name] = { name: card.name, count: 0, cardId: card.card_id };
      }
      cardCounts[card.name].count += card.quantity;
    }

    for (const [cardName, data] of Object.entries(cardCounts)) {
      if (!FormatRulesService.isBasicLand(cardName) && data.count > rules.maxCopies) {
        errors.push({
          type: 'card_limit_exceeded',
          message: `${cardName} has ${data.count} copies, maximum is ${rules.maxCopies} for ${deck.format}`,
          card_id: data.cardId,
          card_name: cardName,
        });
      }
    }

    // 3. Check sideboard size
    if (rules.maxSideboardSize !== null) {
      const sideboardSize = deck.cards.sideboard.reduce((sum, card) => sum + card.quantity, 0);
      if (sideboardSize > rules.maxSideboardSize) {
        errors.push({
          type: 'sideboard_size',
          message: `Sideboard has ${sideboardSize} cards, maximum is ${rules.maxSideboardSize}`,
        });
      }
    }

    // 4. Check banned/restricted cards (using Scryfall legalities)
    const formatKey = this.getFormatKey(deck.format);
    const bannedCards = await this.checkBannedCards(deck, formatKey);
    errors.push(...bannedCards);

    // 5. Commander-specific validation
    if (rules.requiresCommander) {
      const commanderErrors = await this.validateCommander(deck);
      errors.push(...commanderErrors);
    }

    // 6. Pauper-specific: only commons allowed
    if (deck.format === 'pauper') {
      const pauperErrors = await this.validatePauper(deck);
      errors.push(...pauperErrors);
    }

    // Deck is legal if no errors
    const isLegal = errors.length === 0;

    return { isLegal, errors };
  }

  // Get Scryfall format key (e.g., 'commander' -> 'commander')
  private static getFormatKey(format: DeckFormat): string {
    // Most formats match directly, but some need mapping
    const formatMap: Record<string, string> = {
      duel_commander: 'duel',
      penny_dreadful: 'penny',
    };

    return formatMap[format] || format;
  }

  // Check for banned/restricted cards using Scryfall legalities
  private static async checkBannedCards(deck: DeckWithCards, formatKey: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const allCards = [...deck.cards.main, ...deck.cards.sideboard, ...deck.cards.commander];

    for (const deckCard of allCards) {
      // Get card legalities from database
      const result = await pool.query(
        `SELECT id, name, legalities FROM cards WHERE id = $1`,
        [deckCard.card_id]
      );

      if (result.rows.length === 0) continue;

      const card = result.rows[0];
      const legality = card.legalities[formatKey];

      if (legality === 'banned') {
        errors.push({
          type: 'banned_card',
          message: `${card.name} is banned in ${deck.format}`,
          card_id: card.id,
          card_name: card.name,
        });
      }

      if (legality === 'restricted' && deckCard.quantity > 1) {
        errors.push({
          type: 'restricted_card',
          message: `${card.name} is restricted to 1 copy in ${deck.format}`,
          card_id: card.id,
          card_name: card.name,
        });
      }

      if (legality === 'not_legal') {
        errors.push({
          type: 'not_legal',
          message: `${card.name} is not legal in ${deck.format}`,
          card_id: card.id,
          card_name: card.name,
        });
      }
    }

    return errors;
  }

  // Validate Commander deck
  private static async validateCommander(deck: DeckWithCards): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Check for commander
    if (deck.cards.commander.length === 0 && !deck.commander_id) {
      errors.push({
        type: 'commander_missing',
        message: 'Commander deck must have a commander',
      });
      return errors;  // Can't validate further without commander
    }

    // Get commander cards
    const commanderIds = [
      ...(deck.commander_id ? [deck.commander_id] : []),
      ...(deck.partner_commander_id ? [deck.partner_commander_id] : []),
      ...deck.cards.commander.map(c => c.card_id),
    ];

    if (commanderIds.length === 0) {
      errors.push({
        type: 'commander_missing',
        message: 'Commander deck must have a commander',
      });
      return errors;
    }

    // Check commander count (max 2 for partners)
    if (commanderIds.length > 2) {
      errors.push({
        type: 'commander_count',
        message: 'Commander deck can have at most 2 commanders (partners)',
      });
    }

    // Get commander card data
    const commanderResult = await pool.query(
      `SELECT id, name, type_line, color_identity, scryfall_data FROM cards WHERE id = ANY($1)`,
      [commanderIds]
    );

    const commanders = commanderResult.rows;

    // Validate commanders can be commanders
    for (const commander of commanders) {
      const typeLine = commander.type_line.toLowerCase();
      const keywords = commander.scryfall_data?.keywords || [];

      const canBeCommander =
        typeLine.includes('legendary') &&
        typeLine.includes('creature') ||
        keywords.includes('Partner') ||
        keywords.includes('Choose a Background') ||
        typeLine.includes('planeswalker') && keywords.includes('can be your commander');

      if (!canBeCommander) {
        errors.push({
          type: 'invalid_commander',
          message: `${commander.name} cannot be a commander`,
          card_id: commander.id,
          card_name: commander.name,
        });
      }
    }

    // If 2 commanders, validate partners
    if (commanders.length === 2) {
      const partnerErrors = await this.validatePartners(commanders);
      errors.push(...partnerErrors);
    }

    // Get commander color identity (union of all commanders)
    const commanderColorIdentity = new Set<string>();
    for (const commander of commanders) {
      const colors = commander.color_identity || [];
      colors.forEach((color: string) => commanderColorIdentity.add(color));
    }

    // Validate all cards match color identity
    const allCards = [...deck.cards.main, ...deck.cards.sideboard];
    for (const deckCard of allCards) {
      const cardResult = await pool.query(
        `SELECT id, name, color_identity FROM cards WHERE id = $1`,
        [deckCard.card_id]
      );

      if (cardResult.rows.length === 0) continue;

      const card = cardResult.rows[0];
      const cardColors = card.color_identity || [];

      // Check if card's color identity is subset of commander's
      const hasInvalidColor = cardColors.some((color: string) => !commanderColorIdentity.has(color));

      if (hasInvalidColor) {
        errors.push({
          type: 'color_identity_violation',
          message: `${card.name} (${cardColors.join('')}) is outside commander's color identity (${Array.from(commanderColorIdentity).join('')})`,
          card_id: card.id,
          card_name: card.name,
        });
      }
    }

    return errors;
  }

  // Validate partner commanders
  private static async validatePartners(commanders: any[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    const keywords1 = commanders[0].scryfall_data?.keywords || [];
    const keywords2 = commanders[1].scryfall_data?.keywords || [];

    // Check for "Partner with [specific name]"
    const partnerWith1 = keywords1.find((k: string) => k.startsWith('Partner with'));
    const partnerWith2 = keywords2.find((k: string) => k.startsWith('Partner with'));

    if (partnerWith1 || partnerWith2) {
      // Specific partner pairing
      if (partnerWith1 !== `Partner with ${commanders[1].name}` ||
          partnerWith2 !== `Partner with ${commanders[0].name}`) {
        errors.push({
          type: 'invalid_partner',
          message: `${commanders[0].name} and ${commanders[1].name} are not valid partners`,
        });
      }
    } else if (keywords1.includes('Partner') && keywords2.includes('Partner')) {
      // Generic partners - valid
    } else if (keywords1.includes('Friends forever') && keywords2.includes('Friends forever')) {
      // Friends forever - valid
    } else if (keywords1.includes('Choose a Background') && commanders[1].type_line.includes('Background')) {
      // Background pairing - valid
    } else if (keywords2.includes('Choose a Background') && commanders[0].type_line.includes('Background')) {
      // Background pairing - valid
    } else {
      // No valid partner ability
      errors.push({
        type: 'invalid_partner',
        message: `${commanders[0].name} and ${commanders[1].name} cannot be partners`,
      });
    }

    return errors;
  }

  // Validate Pauper deck (only commons)
  private static async validatePauper(deck: DeckWithCards): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const allCards = [...deck.cards.main, ...deck.cards.sideboard];

    for (const deckCard of allCards) {
      const cardResult = await pool.query(
        `SELECT id, name, rarity FROM cards WHERE id = $1`,
        [deckCard.card_id]
      );

      if (cardResult.rows.length === 0) continue;

      const card = cardResult.rows[0];

      if (card.rarity.toLowerCase() !== 'common') {
        errors.push({
          type: 'pauper_rarity',
          message: `${card.name} is not a common (rarity: ${card.rarity})`,
          card_id: card.id,
          card_name: card.name,
        });
      }
    }

    return errors;
  }

  // Update deck validation status in database
  static async updateDeckValidation(deckId: string, isLegal: boolean, errors: ValidationError[]): Promise<void> {
    await pool.query(
      `UPDATE decks
       SET is_legal = $1,
           validation_errors = $2,
           last_validated_at = NOW()
       WHERE id = $3`,
      [isLegal, JSON.stringify(errors), deckId]
    );
  }
}
```

---

### Task 5: Update DeckModel with Auto-Validation (1 hour)

**Update:** `backend/src/models/DeckModel.ts`

Add validation trigger after card operations:

```typescript
import { DeckValidationService } from '../services/deckValidationService';

// After addCard method
static async addCard(...): Promise<DeckCard> {
  // ... existing code ...

  // Auto-validate deck
  await this.validateAndUpdate(deckId, userId);

  return result.rows[0];
}

// After removeCard method
static async removeCard(...): Promise<boolean> {
  // ... existing code ...

  // Auto-validate deck
  await this.validateAndUpdate(deckId, userId);

  return true;
}

// After updateCard method
static async updateCard(...): Promise<DeckCard | null> {
  // ... existing code ...

  // Auto-validate deck
  await this.validateAndUpdate(deckId, userId);

  return result.rows[0] || null;
}

// After bulk operations
static async bulkAddCards(...): Promise<number> {
  // ... existing code ...

  // Auto-validate deck
  await this.validateAndUpdate(deckId, userId);

  return added;
}

static async bulkRemoveCards(...): Promise<number> {
  // ... existing code ...

  // Auto-validate deck
  await this.validateAndUpdate(deckId, userId);

  return removed;
}

static async bulkUpdateCards(...): Promise<number> {
  // ... existing code ...

  // Auto-validate deck
  await this.validateAndUpdate(deckId, userId);

  return updated;
}

// New helper method
private static async validateAndUpdate(deckId: string, userId: string): Promise<void> {
  const deck = await this.getWithCards(deckId, userId);
  if (!deck) return;

  const { isLegal, errors } = await DeckValidationService.validate(deck);
  await DeckValidationService.updateDeckValidation(deckId, isLegal, errors);
}
```

---

### Task 6: Add Validation Endpoint (30 min)

**Update:** `backend/src/routes/decks.ts`

```typescript
// POST /api/decks/:id/validate - Manually trigger validation
router.post('/:id/validate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const deck = await DeckModel.getWithCards(req.params.id, userId);

    if (!deck) {
      return res.status(404).json({
        success: false,
        error: 'Deck not found',
      });
    }

    const { isLegal, errors } = await DeckValidationService.validate(deck);
    await DeckValidationService.updateDeckValidation(deck.id, isLegal, errors);

    res.json({
      success: true,
      isLegal,
      errors,
    });
  } catch (error) {
    console.error('Validate deck error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate deck',
    });
  }
});
```

---

## Verification

### API Testing

```bash
# Create a legal deck
curl -X POST http://localhost:3001/api/decks \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Standard Deck",
    "format": "standard"
  }'

# Add 60 legal cards
# ... add cards via POST /api/decks/:id/cards or bulk endpoint

# Check validation (should auto-validate)
curl http://localhost:3001/api/decks/<deck-id> \
  -H "Cookie: connect.sid=<session>"

# Should show: "is_legal": true, "validation_errors": []

# Add banned card
curl -X POST http://localhost:3001/api/decks/<deck-id>/cards \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{
    "cardId": "<banned-card-id>",
    "quantity": 1,
    "boardType": "main"
  }'

# Check validation again
curl http://localhost:3001/api/decks/<deck-id> \
  -H "Cookie: connect.sid=<session>"

# Should show: "is_legal": false, "validation_errors": [{"type": "banned_card", ...}]

# Test Commander color identity
curl -X POST http://localhost:3001/api/decks \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Atraxa EDH",
    "format": "commander",
    "commanderId": "<atraxa-card-id>"
  }'

# Add red card (outside Atraxa's WUBG identity)
curl -X POST http://localhost:3001/api/decks/<deck-id>/cards \
  -H "Cookie: connect.sid=<session>" \
  -H "Content-Type: application/json" \
  -d '{
    "cardId": "<lightning-bolt-id>",
    "quantity": 1
  }'

# Should show color identity violation error
```

---

## Success Criteria

- [ ] Database migration adds validation fields
- [ ] Format rules service defines all format rules
- [ ] Validation service checks all rule types:
  - [ ] Deck size (min/max)
  - [ ] Card limits (4-of, singleton)
  - [ ] Sideboard size
  - [ ] Banned/restricted cards
  - [ ] Commander requirements
  - [ ] Color identity
  - [ ] Partner validation
  - [ ] Pauper rarity check
- [ ] Auto-validation triggers on card operations
- [ ] Saves never blocked (always succeed)
- [ ] `is_legal` boolean updated correctly
- [ ] `validation_errors` array populated
- [ ] Manual validation endpoint works
- [ ] All formats supported
- [ ] Tests passing

---

## Common Issues & Troubleshooting

**Issue: Validation too slow**
- Use bulk operations for adding multiple cards
- Validation only runs once after bulk operation

**Issue: Color identity incorrect**
- Verify Scryfall's `color_identity` field is accurate
- Check for double-faced cards (both faces matter)

**Issue: Partner validation failing**
- Check Scryfall's `keywords` array for "Partner" keyword
- Verify "Partner with [Name]" exact matching

**Issue: Saves failing**
- Validation should NEVER block saves
- Check that validation happens AFTER save completes
- Review error logs for database issues

---

## Next Steps

After Phase 2.2 is complete:
- **Phase 2.3:** Deck Analysis API (mana curve, synergies, optimization suggestions)
- **Phase 2.4:** Rules Lookup Backend (comprehensive rules database)

---

**Last Updated:** 2026-01-01
**Status:** Ready to implement
**Next:** Begin Task 1 (Database Migration)
