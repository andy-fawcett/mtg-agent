# MTG Agent Documentation

Documentation for the Magic: The Gathering chat assistant powered by Claude Agent SDK.

## Documentation Structure

This documentation is organized into two main sections:

### 📚 Reference Documentation (`/reference`)

High-level conceptual documentation covering security architecture, design decisions, and the "why" behind technical choices. These docs provide the strategic foundation and are useful for understanding the overall system design.

**Start here if you want to:**
- Understand the security threat model
- Learn about architecture decisions
- Review deployment strategies
- Get a quick overview of the project

### 🛠️ Implementation Documentation (`/implementation`)

Phase-by-phase implementation guides with specific tasks, code examples, and verification steps. These docs provide the tactical "how-to" and are used during actual development.

**Start here if you want to:**
- Build the application step-by-step
- Follow detailed coding tasks
- Execute the implementation plan
- Track development progress

---

## Quick Navigation

### For Claude Code Users

```bash
/start   # Context-aware development session
/status  # Check project progress
```

### For New Contributors

1. 🔴 [NPM Security](reference/NPM_SECURITY.md) - **MUST READ FIRST**
2. [Security Architecture](reference/SECURITY_ARCHITECTURE.md) - Threat model
3. [Development Best Practices](reference/DEVELOPMENT_BEST_PRACTICES.md) - Coding standards
4. [Implementation Roadmap](implementation/ROADMAP.md) - 5-phase plan
5. Begin with [Phase 1.0: Foundation](implementation/PHASE_1_MVP/PHASE_1.0_FOUNDATION.md)

### For Security Review

1. [NPM Security](reference/NPM_SECURITY.md) 🔴 **CRITICAL** - Supply chain protection with pnpm v10+
2. [Security Architecture](reference/SECURITY_ARCHITECTURE.md) - Threat model and attack vectors
3. [API Security](reference/API_SECURITY.md) - API key management
4. [Rate Limiting](reference/RATE_LIMITING.md) - Cost controls and abuse prevention
5. [Authentication](reference/AUTHENTICATION.md) - User authentication strategies
6. [Agent SDK Security](reference/AGENT_SDK_SECURITY.md) - Jailbreak prevention
7. [Security Checklist](reference/SECURITY_CHECKLIST.md) - Pre-deployment security audit

### For Implementation

1. [Roadmap](implementation/ROADMAP.md) - Complete 5-phase plan
2. [Phase 1: MVP](implementation/PHASE_1_MVP/README.md) - Local development version
3. [Phase 2: Security](implementation/PHASE_2_SECURITY/README.md) - Security hardening
4. [Phase 3: MTG Features](implementation/PHASE_3_MTG_FEATURES/README.md) - Domain-specific features
5. [Phase 4: Production](implementation/PHASE_4_PRODUCTION/README.md) - Public deployment
6. [Phase 5: Advanced](implementation/PHASE_5_ADVANCED/README.md) - Enhanced capabilities

---

## Reference Documentation

### Security

| Document | Description | When to Read |
|----------|-------------|--------------|
| [NPM Security](reference/NPM_SECURITY.md) 🔴 **CRITICAL** | Supply chain protection, pnpm v10+ guide | **Before Phase 1.0 implementation** |
| [Security Architecture](reference/SECURITY_ARCHITECTURE.md) | Threat model, attack vectors, security layers | Before starting development |
| [API Security](reference/API_SECURITY.md) | API key management, backend proxy pattern | When setting up Claude API integration |
| [Rate Limiting](reference/RATE_LIMITING.md) | Multi-tier rate limiting strategy | When implementing cost controls |
| [Authentication](reference/AUTHENTICATION.md) | Auth strategies (JWT, OAuth, session-based) | When designing user management |
| [Agent SDK Security](reference/AGENT_SDK_SECURITY.md) | System prompts, jailbreak prevention | When integrating Claude Agent SDK |
| [Security Checklist](reference/SECURITY_CHECKLIST.md) | Pre-deployment security audit | Before going to production |

### Development & Best Practices

| Document | Description | When to Read |
|----------|-------------|--------------|
| [Development Best Practices](reference/DEVELOPMENT_BEST_PRACTICES.md) | Coding standards, workflow, expectations | **Before writing any code** |
| [Security Quick Reference](reference/SECURITY_QUICK_REFERENCE.md) | 1-page security cheat sheet (printable) | Keep handy while coding |
| [Backend Architecture](reference/BACKEND_ARCHITECTURE.md) | System design, component diagrams | When planning infrastructure |
| [Deployment](reference/DEPLOYMENT.md) | Production deployment strategies | When preparing for public launch |

---

## Implementation Documentation

### Development Roadmap

**[ROADMAP.md](implementation/ROADMAP.md)** - Complete 5-phase development plan with timeline, resource requirements, and success metrics.

**Timeline:**
- Phase 1: MVP (Weeks 1-2) - Local development only
- Phase 2: Security Hardening (Week 3) - **CRITICAL before public access**
- Phase 3: MTG Features (Weeks 4-5) - Domain-specific enhancements
- Phase 4: Production Ready (Weeks 6-7) - Public beta launch
- Phase 5: Advanced Features (Week 8+) - Premium capabilities

### Phase Documentation

| Phase | Status | Description | Tasks |
|-------|--------|-------------|-------|
| **[Phase 1: MVP](implementation/PHASE_1_MVP/README.md)** | 📝 Ready to implement | Core functionality for internal testing | 7 sub-phases, 35+ tasks |
| **[Phase 2: Security](implementation/PHASE_2_SECURITY/README.md)** | 📋 Planned | Security hardening before public access | Goals defined |
| **[Phase 3: MTG Features](implementation/PHASE_3_MTG_FEATURES/README.md)** | 📋 Planned | MTG-specific enhancements | Goals defined |
| **[Phase 4: Production](implementation/PHASE_4_PRODUCTION/README.md)** | 📋 Planned | Production deployment | Goals defined |
| **[Phase 5: Advanced](implementation/PHASE_5_ADVANCED/README.md)** | 📋 Planned | Advanced features | Goals defined |

### Phase 1 MVP - Detailed Tasks

Phase 1 is fully documented with step-by-step implementation tasks:

| Sub-Phase | Document | Time Estimate | Key Deliverables |
|-----------|----------|---------------|------------------|
| **1.0 Foundation** | [PHASE_1.0_FOUNDATION.md](implementation/PHASE_1_MVP/PHASE_1.0_FOUNDATION.md) | 4-5 hours | Project structure, TypeScript, Docker, Express |
| **1.1 Database** | [PHASE_1.1_DATABASE.md](implementation/PHASE_1_MVP/PHASE_1.1_DATABASE.md) | 4-5 hours | PostgreSQL, migrations, models |
| **1.2 Auth** | [PHASE_1.2_AUTH.md](implementation/PHASE_1_MVP/PHASE_1.2_AUTH.md) | 5-6 hours | JWT, bcrypt, registration, login |
| **1.3 Rate Limiting** | [PHASE_1.3_RATE_LIMITING.md](implementation/PHASE_1_MVP/PHASE_1.3_RATE_LIMITING.md) | 3-4 hours | Redis rate limiting, budget controls |
| **1.4 Claude SDK** | [PHASE_1.4_CLAUDE_SDK.md](implementation/PHASE_1_MVP/PHASE_1.4_CLAUDE_SDK.md) | 3-4 hours | Anthropic SDK, system prompts |
| **1.5 API** | [PHASE_1.5_API.md](implementation/PHASE_1_MVP/PHASE_1.5_API.md) | 4-5 hours | Zod validation, chat endpoint |
| **1.6 Frontend** | [PHASE_1.6_FRONTEND.md](implementation/PHASE_1_MVP/PHASE_1.6_FRONTEND.md) | 6-8 hours | Next.js, auth pages, chat interface |
| **1.7 Testing** | [PHASE_1.7_TESTING.md](implementation/PHASE_1_MVP/PHASE_1.7_TESTING.md) | 6-8 hours | Integration, security, load, E2E tests |

**Total Estimated Time:** 35-45 hours

---

## How to Use This Documentation

### During Planning

1. Read reference docs to understand architecture and security
2. Review the ROADMAP for overall timeline
3. Read Phase README files for goals and objectives

### During Implementation

1. Open the specific phase task document (e.g., PHASE_1.0_FOUNDATION.md)
2. Follow tasks sequentially
3. Run verification commands after each task
4. Check off success criteria
5. Move to next sub-phase

### During Code Review

1. Reference the specific task documentation
2. Verify success criteria are met
3. Check security checklist items
4. Review verification test results

### Before Deployment

1. Complete security checklist
2. Verify all phase success criteria
3. Review deployment documentation
4. Run full test suite

---

## Documentation Standards

All implementation docs follow these standards:

- **Time Estimates**: Each task includes realistic time estimates
- **Code Examples**: Complete, runnable code samples
- **Verification Steps**: Specific commands to verify completion
- **Success Criteria**: Checkboxes for validation
- **Rollback Procedures**: How to undo changes if needed
- **Common Issues**: Known problems and solutions

See [documentation-best-practices skill](.claude/skills/documentation-best-practices/SKILL.md) for full standards.

---

## Contributing

When adding new documentation:

1. **Reference docs** go in `/reference` - Conceptual, strategic, "why"
2. **Implementation docs** go in `/implementation` - Tactical, specific, "how"
3. Follow the documentation-best-practices skill templates
4. Update this README with navigation links

---

## Additional Resources

### General Documentation

- [FAQ](FAQ.md) - Frequently asked questions and troubleshooting
- [CONTRIBUTING](CONTRIBUTING.md) - Contribution guidelines and standards
- [Project Status](../STATUS.md) - Current progress tracking

### Claude Code Integration

This project includes Claude Code commands and skills for streamlined development:

- `/start` - Context-aware development session (automatically loads relevant docs)
- `/status` - Quick progress check
- Skill: `mtg-agent-dev` - Development context and patterns

See [.claude/commands/](.claude/commands/) for implementation details.

---

## Project Status

**Current Phase:** Phase 1 (MVP) - Documentation Complete, Implementation Ready

**Documentation Status:**
- ✅ Reference documentation (11 files)
- ✅ Implementation roadmap
- ✅ Phase 1 detailed docs (7 sub-phases)
- ✅ Development best practices
- ✅ FAQ, Contributing, Security quick reference
- ✅ Claude Code integration
- ⏸️ Phase 2-5 (goals defined)

**Implementation Status:**
- ⏸️ Not started
- 📝 Ready to begin Phase 1.0

---

## Support

For questions about:
- **Getting Started**: Run `/start` or see [Development Best Practices](reference/DEVELOPMENT_BEST_PRACTICES.md)
- **Troubleshooting**: Check [FAQ](FAQ.md) first
- **Security**: Review [Security Quick Reference](reference/SECURITY_QUICK_REFERENCE.md)
- **Contributing**: See [CONTRIBUTING](CONTRIBUTING.md)
- **Current Progress**: Check [STATUS.md](../STATUS.md)

---

**Last Updated:** 2025-01-04
**Documentation Version:** 1.1
**Status:** Complete and ready for implementation
