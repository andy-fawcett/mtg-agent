# MTG Agent Backend

Backend API server for the MTG (Magic: The Gathering) Agent application, powered by Claude AI.

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Session Store**: Redis
- **AI Model**: Anthropic Claude Sonnet 4.5
- **Package Manager**: pnpm (v10+)
- **Testing**: Jest + Supertest

## Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- pnpm 10+

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# API Configuration
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://username:password@localhost:5434/mtg_agent

# Redis
REDIS_URL=redis://localhost:6379

# Anthropic Claude API
ANTHROPIC_API_KEY=your_api_key_here

# Session Security
SESSION_SECRET=your_32_character_minimum_secret_key_here

# CORS
FRONTEND_URL=http://localhost:3001
```

### 3. Database Setup

Run migrations:

```bash
# Apply all migrations
psql $DATABASE_URL < migrations/001_initial_schema.sql
psql $DATABASE_URL < migrations/002_add_conversations.sql
psql $DATABASE_URL < migrations/003_user_daily_tokens.sql
psql $DATABASE_URL < migrations/004_admin_features.sql
```

### 4. Start Development Server

```bash
# Using the dev script (recommended - includes hot reload)
./dev.sh

# Or using pnpm
pnpm dev
```

## Available Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build TypeScript to JavaScript
- `pnpm start` - Start production server
- `pnpm test` - Run all tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Run tests with coverage report
- `pnpm lint` - Run TypeScript type checking

## API Endpoints

### Authentication (`/api/auth`)

- `POST /register` - Register new user
- `POST /login` - Login user (session-based)
- `POST /logout` - Logout user
- `GET /me` - Get current user info

### Chat (`/api/chat`)

- `POST /` - Send message and get AI response
- `GET /history` - Get user's chat history
- `GET /stats` - Get user statistics (tokens, requests)

### Conversations (`/api/conversations`)

- `GET /` - List all conversations
- `POST /` - Create new conversation
- `GET /:id` - Get conversation with messages
- `PATCH /:id` - Update conversation title
- `DELETE /:id` - Soft delete conversation
- `POST /:id/summarize-and-continue` - Summarize and create new conversation

### Admin (`/api/admin`)

- `GET /users` - List all users
- `GET /analytics/overview` - Get system analytics
- `GET /analytics/usage` - Get usage analytics
- `GET /alerts` - Get system alerts
- `GET /config` - Get system configuration
- `PATCH /config/:key` - Update configuration value
- `PATCH /users/:id/tier` - Update user tier
- `PATCH /users/:id/suspend` - Suspend user account

## Architecture

### Directory Structure

```
backend/
├── src/
│   ├── config/          # Configuration (DB, Redis, Anthropic, etc.)
│   ├── middleware/      # Express middleware (auth, rate limiting)
│   ├── models/          # Database models
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic (ChatService, AuthService)
│   ├── utils/           # Utility functions
│   ├── prompts/         # AI prompts and jailbreak detection
│   ├── validation/      # Request validation schemas
│   └── index.ts         # Application entry point
├── tests/
│   ├── integration/     # Integration tests
│   ├── mocks/           # Test mocks (Anthropic SDK)
│   └── setup.ts         # Test environment setup
├── migrations/          # Database migrations
└── docs/                # Documentation

```

### Key Features

1. **Session-Based Authentication**
   - Secure cookie-based sessions stored in Redis
   - No JWT tokens - sessions managed server-side
   - Session regeneration on login for security

2. **Multi-Tier System**
   - Free tier: Limited tokens per day
   - Premium tier: Higher limits
   - Admin tier: Full access + admin panel

3. **Conversation Management**
   - Multi-turn conversations with context
   - Auto-generated titles
   - Conversation summarization when limit reached
   - Token tracking per conversation

4. **Rate Limiting & Budget Control**
   - IP-based rate limiting (configurable)
   - Daily token limits per user
   - Daily budget limits (global)
   - Real-time cost tracking

5. **Security Features**
   - Jailbreak attempt detection
   - Input/output sanitization
   - SQL injection prevention (parameterized queries)
   - Session fixation protection

## Testing

### Running Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# Specific test suite
pnpm test auth.test.ts
```

### Test Structure

- **Auth Tests** (8 tests): Registration, login, session management
- **Chat Tests** (12 tests): Message handling, jailbreak detection, conversation context
- **Conversation Tests** (14 tests): CRUD operations, summarization

All tests use mocked Anthropic SDK to avoid API costs (~$0.20 total).

### Test Coverage

Current coverage: **70%+** across all modules

- Statements: 70%+
- Branches: 70%+
- Functions: 70%+
- Lines: 70%+

## Development Workflow

### Making Changes

1. Create feature branch from `main`
2. Make changes with TypeScript strict mode enabled
3. Run tests: `pnpm test`
4. Check types: `pnpm tsc --noEmit`
5. Commit changes
6. Create pull request

### Database Changes

1. Create new migration file in `migrations/`
2. Use sequential numbering (001, 002, etc.)
3. Include both UP and rollback instructions
4. Test migration on local database
5. Document changes in migration header

### Adding New Endpoints

1. Create route handler in `src/routes/`
2. Add business logic in `src/services/`
3. Add validation schema in `src/validation/`
4. Add integration tests in `tests/integration/`
5. Update README with new endpoint

## Configuration

### Dynamic Configuration

System configuration is stored in the database (`system_config` table) and can be updated via admin API:

- Rate limits (IP-based and per-user)
- Budget limits
- Token limits per tier
- Conversation limits
- Model selection
- Pricing (input/output tokens)

Changes take effect immediately without restart.

### Environment Variables

Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `ANTHROPIC_API_KEY` - Claude API key
- `SESSION_SECRET` - Min 32 characters for session encryption

Optional variables:
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production/test)
- `FRONTEND_URL` - CORS allowed origin

## Monitoring

### Logging

- Request/response logging in dev mode
- SQL query logging with execution time
- Error stack traces in development
- Admin action audit log

### Metrics Tracked

- Daily costs (total, requests, tokens)
- User daily token usage
- Success/failure rates
- Response times
- Rate limit hits

## Security

### Best Practices Implemented

1. **Input Validation**: Joi schemas for all requests
2. **SQL Injection**: Parameterized queries only
3. **XSS Prevention**: Output sanitization
4. **CSRF Protection**: Session-based auth with secure cookies
5. **Rate Limiting**: IP and user-based limits
6. **Jailbreak Detection**: Pattern-based detection for prompt injection
7. **Password Security**: bcrypt hashing with salt
8. **Session Security**: HTTP-only cookies, secure in production

### Known Limitations

- No email verification (Phase 2 feature)
- No 2FA (Phase 2 feature)
- Basic admin auth (admin role flag)

## Troubleshooting

### Common Issues

**Database connection fails**
- Check PostgreSQL is running: `pg_isready`
- Verify DATABASE_URL format
- Check network connectivity

**Redis connection fails**
- Check Redis is running: `redis-cli ping`
- Verify REDIS_URL
- Check firewall rules

**Tests failing**
- Clean test database: `pnpm test -- --clearCache`
- Check Redis is running (required for session tests)
- Verify environment variables in tests/setup.ts

**TypeScript errors**
- Run `pnpm tsc --noEmit` to see all errors
- Check node_modules: `pnpm install`
- Clear build cache: `rm -rf dist`

## Contributing

See main project [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## License

See main project [LICENSE](../LICENSE) file.
