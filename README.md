# MTG Agent - Secure AI-Powered MTG Assistant

A production-ready web application providing an AI-powered Magic: The Gathering chat experience using Claude Agent SDK.

## 🎯 Project Status

**Current Phase:** Phase 1 (MVP) - Documentation Complete ✅
**Implementation:** Ready to begin Phase 1.0 (Foundation)
**Timeline:** ~2 weeks to MVP, 8 weeks to public launch

## 🔴 CRITICAL: Security Requirements

> **⚠️ SUPPLY CHAIN SECURITY:** This project uses **pnpm v10+** (NOT npm) for enhanced security. pnpm disables postinstall scripts by default and supports package release age checks to prevent supply chain attacks.
>
> **📖 READ BEFORE STARTING:** [NPM Security Guide](docs/reference/NPM_SECURITY.md)

**Additional Critical Requirements:**
- API keys NEVER exposed to client (backend proxy only)
- Multi-layer security (auth, rate limiting, jailbreak prevention)
- Real-time cost monitoring and budget enforcement

## 🚀 Quick Start for Developers

### Start Development Environment

```bash
# Start all services (Docker, Backend, Frontend)
./start-dev.sh

# Stop all services
./stop-dev.sh
```

**What starts:**
- Docker containers (PostgreSQL on :5434, Redis on :6379)
- Backend API server (http://localhost:3000)
- Frontend app (http://localhost:3001)

**See:** [Development Scripts Documentation](docs/reference/DEV_SCRIPTS.md)

### For Claude Code Users:
```bash
# Start a development session (context-aware)
/start

# Check project status
/status
```

### Manual Setup:
1. **Read Critical Documentation**
   - 🔴 [NPM Security (MUST READ)](docs/reference/NPM_SECURITY.md)
   - [Security Architecture](docs/reference/SECURITY_ARCHITECTURE.md)
   - [Documentation Hub](docs/README.md) - Complete navigation

2. **Begin Implementation**
   - [Development Roadmap](docs/implementation/ROADMAP.md) - 5-phase plan
   - [Phase 1.0: Foundation](docs/implementation/PHASE_1_MVP/PHASE_1.0_FOUNDATION.md) - Start here
   - [Project Status](STATUS.md) - Track progress

## 📋 Overview

A secure, scalable MTG chat assistant with:
- **AI-Powered Chat:** Claude 4.5 Sonnet for MTG expertise
- **Multi-Tier Access:** Anonymous (3 msgs/day), Free (50/day), Premium (500/day)
- **Security-First:** Jailbreak prevention, rate limiting, cost controls
- **Production-Ready:** Docker, TypeScript strict mode, 70%+ test coverage

## 📚 Documentation

**[Documentation Hub](docs/README.md)** - Complete navigation and links to all docs

**Critical Reading Path:**
1. 🔴 [NPM Security](docs/reference/NPM_SECURITY.md) - **MUST READ FIRST**
2. [Security Architecture](docs/reference/SECURITY_ARCHITECTURE.md) - Threat model
3. [Development Roadmap](docs/implementation/ROADMAP.md) - 5-phase plan
4. [Phase 1.0: Foundation](docs/implementation/PHASE_1_MVP/PHASE_1.0_FOUNDATION.md) - First steps

## Architecture Overview

```
┌─────────────────────┐
│   User Browser      │
│  (Next.js Frontend) │
└──────────┬──────────┘
           │ HTTPS (No API Keys)
           ↓
┌─────────────────────┐
│   Backend Proxy     │
│  (Express + TypeScript)
│  - Authentication   │
│  - Rate Limiting    │
│  - Validation       │
│  - Cost Tracking    │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Claude Agent SDK   │
│  - System Prompts   │
│  - Jailbreak Guard  │
│  - Skills & Tools   │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   Anthropic API     │
│  (Claude 4.5 Sonnet)│
└─────────────────────┘

Supporting Services:
- PostgreSQL (user data, chat logs, cost tracking)
- Redis (rate limiting, sessions, caching)
```

## 🛠️ Technology Stack

**Backend:** Node.js 20 + Express + TypeScript (strict) + PostgreSQL 15 + Redis 7
**Frontend:** Next.js 14 + TypeScript + TailwindCSS
**AI:** Claude 4.5 Sonnet (Anthropic SDK)
**DevOps:** Docker Compose, pnpm v10+
**Security:** bcrypt, session-based auth, Zod validation, helmet, rate-limiter-flexible

**Key Principles:**
- 🔒 Security by design (defense in depth)
- 📦 Supply chain protection (pnpm v10+)
- ⚡ TypeScript strict mode
- 🧪 70%+ test coverage target
- 💰 Cost controls (rate limiting + budget caps)

## 🗺️ Development Roadmap

**[Complete Roadmap](docs/implementation/ROADMAP.md)** - Detailed 5-phase plan with timelines

| Phase | Duration | Status | Description |
|-------|----------|--------|-------------|
| **Phase 1: MVP** | 2 weeks | 📝 Ready | Core functionality (auth, chat, rate limiting) |
| **Phase 2: Security** | 1 week | ⏸️ Pending | Security hardening **before public access** |
| **Phase 3: MTG Features** | 2 weeks | ⏸️ Pending | Card lookup, deck analysis, rules |
| **Phase 4: Production** | 2 weeks | ⏸️ Pending | OAuth, payments, monitoring |
| **Phase 5: Advanced** | Ongoing | ⏸️ Pending | Premium features, real-time, tournaments |

**Current Focus:** [Phase 1.0 - Foundation](docs/implementation/PHASE_1_MVP/PHASE_1.0_FOUNDATION.md)

## 🚦 Getting Started

### Prerequisites
- Node.js 20+, pnpm 10+, Docker, Git
- Anthropic API key from https://console.anthropic.com/

### Using Claude Code (Recommended)
```bash
/start   # Context-aware development session
/status  # Check progress
```

### Manual Development
```bash
# Clone and setup
git clone <repository-url>
cd mtg-agent

# Read critical docs
cat docs/reference/NPM_SECURITY.md
cat docs/implementation/PHASE_1_MVP/PHASE_1.0_FOUNDATION.md

# Begin implementation
# Follow phase docs step-by-step
```

## 📁 Project Structure

```
mtg-agent/
├── STATUS.md              # Track current progress
├── docs/                  # Complete documentation
│   ├── reference/         # Architecture & security
│   └── implementation/    # Phase-by-phase guides
├── backend/               # Express API (to be created)
├── frontend/              # Next.js app (to be created)
└── .claude/               # Claude Code commands & skills
```

## 🤝 Contributing

This project follows strict quality standards:
- TypeScript strict mode (no `any` types)
- 70%+ test coverage
- Security-first approach
- Code review required

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for details.

## 📄 License

MIT

---

**Last Updated:** 2025-01-04
**Status:** Phase 1 Documentation Complete, Ready for Implementation
**Track Progress:** [STATUS.md](STATUS.md)
