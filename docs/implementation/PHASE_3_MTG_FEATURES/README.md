# Phase 3: MTG Features

**Status:** ⏸️ Not Started
**Duration Estimate:** 1-2 weeks (30-40 hours)
**Prerequisites:** Phase 1 (MVP) + Phase 2 (Security) complete
**Target Completion:** 2025-12-06

## Overview

Add MTG-specific capabilities using Claude Agent SDK tools and skills. Transform from generic chat to specialized MTG assistant with card search, rules lookup, deck analysis, and price tracking.

## Objectives

- **Scryfall Integration:** Search 25,000+ MTG cards with details, images, and prices
- **Rules Lookup:** Query comprehensive MTG rules by keyword or number
- **Deck Analysis:** Analyze deck composition for mana curve, synergies, and weaknesses
- **Price Tracking:** Real-time card prices from multiple sources
- **Agent SDK Architecture:** Clean tools and skills following best practices

## Why This Phase

After security is solid (Phase 2), we can focus on features that differentiate our MTG assistant from generic Claude chat. These features provide actual utility that MTG players will pay for.

## Success Criteria

- [ ] Card search finds 99.9%+ of MTG cards
- [ ] Card details include image, Oracle text, prices, legality
- [ ] Rules lookup returns relevant results in < 2s
- [ ] Deck analysis provides actionable insights
- [ ] Price data updates automatically
- [ ] All features work via Agent SDK
- [ ] Response times < 3s (p95)
- [ ] Error handling graceful
- [ ] Rate limiting includes external API calls

## Sub-Phases (High-Level)

1. **Scryfall Card Search Tool:** Query Scryfall API for card data
2. **Rules Lookup Tool:** Search MTG comprehensive rules
3. **Deck Analysis Skill:** Analyze deck lists for improvements
4. **Price Tracking:** Integrate TCGPlayer/CardMarket pricing
5. **Caching Layer:** Cache frequently accessed data
6. **Agent SDK Integration:** Wire up tools to Claude
7. **Testing:** Verify all MTG features work correctly
8. **Documentation:** Document all tools and skills

## Key Deliverables

- Scryfall card search tool
- MTG rules lookup tool
- Deck analysis skill
- Price tracking integration
- Agent SDK skills documentation
- Test suite for MTG features
- User-facing feature documentation

## Related Documentation

- [Agent SDK Security](../../AGENT_SDK_SECURITY.md)
- [Previous Phase: Security](../PHASE_2_SECURITY/README.md)
- [Next Phase: Production](../PHASE_4_PRODUCTION/README.md)

---

**Last Updated:** 2025-11-01
**Next Phase:** [Phase 4: Production Ready](../PHASE_4_PRODUCTION/README.md)
