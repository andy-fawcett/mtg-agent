# Phase 2: MTG Features

**Status:** ⏸️ Not Started
**Duration Estimate:** 56-69 hours (~2-3 weeks)
**Prerequisites:** Phase 1 (MVP) complete ✅
**Target Completion:** TBD

---

## Overview

Transform the generic chat assistant into a specialized **MTG Assistant** with comprehensive card database, deck building tools, format validation, deck analytics, and rules lookup. Integrate with Claude Agent SDK to enable conversational deck building and MTG rules assistance.

---

## Objectives

- **Complete Card Database:** Import all 25k+ MTG cards from Scryfall bulk data with prices, images, and rulings
- **Deck Building System:** Full CRUD for decks with support for all formats (Standard, Modern, Commander, etc.)
- **Format Validation:** Legality checking with banned/restricted lists for all major formats
- **Deck Analytics:** Mana curve, color distribution, price tracking, synergy detection
- **Rules Assistant:** Comprehensive MTG rules lookup with keyword explanations and card rulings
- **AI Integration:** Claude understands MTG, helps build decks, analyzes strategies, and explains rules
- **Chat + Deck Integration:** Analyze and modify decks conversationally via chat interface

---

## Why This Phase

After completing the MVP (Phase 1), Phase 2 builds the features that differentiate our MTG assistant from generic Claude chat. These capabilities provide real utility that MTG players will value, validating the product concept before comprehensive security hardening (Phase 3).

**Key Differentiators:**
- Local card database (fast, no rate limits)
- Deck building with AI assistance
- Format validation for all formats
- Real-time deck analytics
- MTG rules expertise

---

## Success Criteria

### Data & Search
- [ ] All 25k+ MTG cards imported from Scryfall bulk data
- [ ] Card search finds 99.9%+ of cards by name, text, or attributes
- [ ] Card details include image URLs, Oracle text, prices, legality, rulings
- [ ] Search response time < 500ms (p95)
- [ ] Daily auto-sync updates card data

### Deck Building
- [ ] Users can create/edit/delete decks
- [ ] Support for main deck, sideboard, maybeboard, commander
- [ ] All major formats supported (Standard, Modern, Commander, Pioneer, Legacy, Vintage, Pauper, etc.)
- [ ] Deck import/export works (Arena, MTGO, text formats)
- [ ] Version history tracks deck changes

### Format Validation
- [ ] Deck legality checking for all formats
- [ ] Banned/restricted lists accurate and up-to-date
- [ ] Commander color identity validation
- [ ] Card limit rules enforced (4-of, singleton)

### Deck Analytics
- [ ] Mana curve visualization
- [ ] Color distribution charts
- [ ] Card type breakdown
- [ ] Total deck price calculation
- [ ] Average CMC calculation
- [ ] Basic synergy detection

### Rules Assistance
- [ ] Comprehensive Rules imported and searchable
- [ ] Keyword ability lookup works
- [ ] Card rulings accessible
- [ ] Search returns relevant results in < 2s

### AI Integration
- [ ] Claude Agent SDK integrated
- [ ] Card search tool works conversationally
- [ ] Deck analysis tool provides insights
- [ ] Deck modification tools work via chat
- [ ] Rules lookup tool explains concepts naturally
- [ ] Chat interface can load and analyze user's decks

### Performance
- [ ] API response times < 1s for card search
- [ ] API response times < 2s for deck analysis
- [ ] Frontend renders decks without lag
- [ ] Charts/visualizations load smoothly

### Testing
- [ ] Integration tests for all API endpoints
- [ ] Agent SDK tools tested
- [ ] Frontend components tested
- [ ] Test coverage >70%

---

## Phase 2 Structure

### **Section A: MTG Data & Backend**

#### [Phase 2.0: Card Database & Bulk Import](PHASE_2.0_CARD_DATABASE.md) (8-10 hrs)
- Import Scryfall bulk data (cards, rulings, prices)
- PostgreSQL schema mirroring Scryfall structure
- Daily auto-sync job for updates
- Search API with custom syntax
- Full-text search indexes

#### [Phase 2.1: Deck Backend & API](PHASE_2.1_DECK_BACKEND.md) (6-8 hrs)
- Database schema for decks (decks, deck_cards, deck_versions)
- CRUD APIs for deck management
- Support for main deck, sideboard, maybeboard, commander
- Deck import/export (Arena, MTGO, text formats)
- Version history tracking

#### [Phase 2.2: Format Validation](PHASE_2.2_FORMAT_VALIDATION.md) (4-6 hrs)
- All major format definitions
- Banned/restricted lists from Scryfall data
- Deck legality validation API
- Commander-specific rules (color identity, partner commanders)
- Card limit enforcement (4-of, singleton)

#### [Phase 2.3: Rules Lookup Backend](PHASE_2.3_RULES_LOOKUP.md) (3-4 hrs)
- Download and parse MTG Comprehensive Rules TXT
- PostgreSQL schema (rules, keywords, glossary)
- Full-text search for rules
- Rules search API (by keyword, rule number, topic)
- Card rulings integration from Scryfall data

---

### **Section B: Frontend/UX**

#### [Phase 2.4: Deck Builder UI](PHASE_2.4_DECK_BUILDER_UI.md) (8-10 hrs)
- Deck builder page (`/deck-builder`)
- Card search panel
- Deck editor (main, sideboard, maybeboard, commander)
- Add/remove cards with quantities
- Group cards by type (Creatures, Spells, Lands)
- Save/load decks
- Import/export deck lists

#### [Phase 2.5: Deck Analytics UI](PHASE_2.5_DECK_ANALYTICS_UI.md) (4-6 hrs)
- Mana curve chart (bar graph)
- Color distribution (pie chart)
- Card type breakdown (donut chart)
- Key stats display (total cards, avg CMC, land count, total price)
- Format legality badges

#### [Phase 2.6: Deck Management UI](PHASE_2.6_DECK_MANAGEMENT_UI.md) (3-4 hrs)
- Deck library page (`/decks`)
- List all user decks (grid or list view)
- Deck cards (name, format, colors, price, last updated)
- Create/delete/duplicate decks
- Filter/sort decks (by format, color, price, date)

#### [Phase 2.7: Deck + Chat Integration](PHASE_2.7_DECK_CHAT_INTEGRATION.md) (5-6 hrs)
- Deck context in chat (Claude can access user's decks)
- Deck selector dropdown in chat interface
- Quick deck actions from chat ("Add Lightning Bolt to my deck")
- Visual responses (show mana curve, card images in chat)
- Deck modification via conversational commands

---

### **Section C: Claude Skills (Agent SDK)**

#### [Phase 2.8: Agent SDK Setup](PHASE_2.8_AGENT_SDK_SETUP.md) (4-6 hrs)
- Install and configure Claude Agent SDK
- Tool/skill framework setup
- Integration with Express backend
- Tool execution middleware
- Error handling for tools

#### [Phase 2.9: Card Tools](PHASE_2.9_CARD_TOOLS.md) (3-4 hrs)
**Tools:**
- `search_cards` - Search for MTG cards by name, color, type, etc.
- `get_card_details` - Get full card info (image, rulings, prices)

**Claude capabilities:**
- "Find me red creatures with flying"
- "Show me Lightning Bolt"
- "What's the price of Ragavan?"

#### [Phase 2.10: Deck Building Tools](PHASE_2.10_DECK_TOOLS.md) (5-6 hrs)
**Tools:**
- `get_deck` - Load deck for analysis
- `analyze_deck` - Get mana curve, stats, price, insights (LLM-powered analysis)
- `add_card_to_deck` - Add card to active deck
- `remove_card_from_deck` - Remove card from deck
- `suggest_cards_for_deck` - Suggest cards based on deck strategy
- `check_deck_legality` - Validate deck for format

**Claude capabilities:**
- "Analyze my Commander deck"
- "What should I cut from this deck?"
- "Suggest lands for my mana base"
- "Is this deck legal in Modern?"

#### [Phase 2.11: Rules Assistant Tools](PHASE_2.11_RULES_TOOLS.md) (3-4 hrs)
**Tools:**
- `search_mtg_rules` - Search comprehensive rules (keywords, rule numbers, topics)

**Claude capabilities:**
- "How does First Strike work?"
- "What happens when Lightning Bolt targets a creature with Protection from Red?"
- "Explain the stack"
- "Show me the rules for Commander damage"

#### [Phase 2.12: Testing & Documentation](PHASE_2.12_TESTING.md) (4-6 hrs)
- Integration tests for all Agent SDK tools
- Frontend component tests
- Tool accuracy verification
- API documentation updates
- User guide for deck building features

---

## Key Deliverables

**Backend:**
- Complete MTG card database (25k+ cards)
- Deck management API (CRUD, audit logging, bulk operations)
- Format validation API (all major formats)
- Deck stats calculation (mana curve, colors, price - on-demand)
- Rules lookup API (comprehensive rules, keywords, rulings)

**Frontend:**
- Deck builder interface
- Deck analytics visualizations
- Deck library/management page
- Chat + deck integration

**AI Integration:**
- Agent SDK tools for cards, decks, rules
- Conversational deck building
- Natural language MTG rules assistance

**Testing:**
- Comprehensive test suite for all features
- Tool integration tests
- Frontend component tests

**Documentation:**
- API documentation
- User guide for deck building
- Tool/skill documentation

---

## What Phase 2 Delivers

At the end of Phase 2, users can:

✅ **Search 25k+ MTG cards** with advanced filters
✅ **Build and save decks** with full format support
✅ **Validate decks** for any format (Standard, Modern, Commander, etc.)
✅ **Analyze decks** with mana curve, color pie, price tracking
✅ **Ask Claude for help** building and optimizing decks
✅ **Look up MTG rules** conversationally
✅ **Modify decks via chat** ("Add Lightning Bolt to my deck")
✅ **Get card suggestions** based on deck strategy
✅ **Track deck prices** with automatic updates
✅ **Import/export decks** from Arena, MTGO, text lists

**User Experience:**
> "I want to build a red aggro deck for Modern"
> Claude suggests cards, builds deck, validates legality, shows mana curve, calculates price

> "How does First Strike work with combat damage?"
> Claude explains the rule with examples

> "Analyze my Commander deck and suggest improvements"
> Claude reviews deck, suggests cuts/additions, explains synergies

---

## Technical Architecture

### Data Sources
- **Scryfall Bulk Data** (daily updates):
  - All Cards (~100MB compressed)
  - Rulings (~20MB)
  - Prices (included in card data)
- **MTG Comprehensive Rules** (quarterly updates):
  - Official TXT file from Wizards
  - ~300KB, 900+ rules

### Storage
- **PostgreSQL** for all data (cards, decks, rules)
- **Redis** for caching frequently accessed data
- **Full-text search** using PostgreSQL's built-in capabilities

### Search Strategy
- **Local-first:** All searches hit PostgreSQL (fast, no rate limits)
- **No Scryfall API calls** for card data (using bulk downloads)
- **Custom search syntax:** Simple, documented, SQL-friendly

### Agent SDK Integration
- **Tools:** Backend API endpoints wrapped as Agent SDK tools
- **Skills:** Complex workflows (deck optimization, card suggestions)
- **Context:** Claude can access user's decks, card data, rules

---

## Security Considerations

- [ ] Validate all deck input (prevent injection attacks)
- [ ] Rate limit deck creation (prevent spam)
- [ ] Authorize deck access (users can only access their own decks)
- [ ] Sanitize card search queries
- [ ] Validate deck import data (prevent malicious imports)
- [ ] Rate limit Agent SDK tool calls
- [ ] Validate tool inputs with Zod schemas

---

## Related Documentation

- [Phase 1: MVP](../PHASE_1_MVP/README.md) (prerequisite)
- [Phase 3: Security Hardening](../PHASE_3_SECURITY/README.md) (next phase)
- [Agent SDK Security](../../reference/AGENT_SDK_SECURITY.md)
- [Backend Architecture](../../reference/BACKEND_ARCHITECTURE.md)

---

## Deferred to Future Phases

The following features are **not included** in Phase 2:

- ⏸️ **Public Deck Sharing** (Phase 5)
- ⏸️ **Deck Ratings/Comments** (Phase 5)
- ⏸️ **Community Deck Library** (Phase 5)
- ⏸️ **Collection Management** (Phase 5)
- ⏸️ **Trading/Want Lists** (Phase 5)
- ⏸️ **Advanced Meta Analysis** (Phase 5)
- ⏸️ **Tournament Tracking** (Phase 5)
- ⏸️ **Draft Simulator** (Phase 5)

---

**Last Updated:** 2026-01-01
**Status:** Ready to begin Phase 2.0
**Next:** [Phase 2.0: Card Database & Bulk Import](PHASE_2.0_CARD_DATABASE.md)