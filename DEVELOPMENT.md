# MTG Agent - Development Guide

Quick reference for developers working on MTG Agent.

## 🚀 Getting Started

### Start Everything

```bash
./dev.sh start
```

This starts:
- PostgreSQL (localhost:5434)
- Redis (localhost:6379)
- Backend API (localhost:3000)
- Frontend (localhost:3001)

### Stop Everything

```bash
./dev.sh stop
```

### Quick Restart (Fast Development)

```bash
# Restart just backend (~5 seconds)
./dev.sh restart-backend

# Restart just frontend (~10 seconds)
./dev.sh restart-frontend

# Restart both
./dev.sh restart
```

For more details, see [DEV_GUIDE.md](DEV_GUIDE.md).

### Access the Application

- **Frontend:** http://localhost:3001
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health

---

## 📂 Project Structure

```
mtg-agent/
├── backend/              # Express.js API server
│   ├── src/
│   │   ├── index.ts     # Main server entry
│   │   ├── routes/      # API routes
│   │   ├── models/      # Database models
│   │   ├── services/    # Business logic
│   │   └── middleware/  # Auth, rate limiting, etc.
│   └── migrations/      # Database migrations
│
├── frontend/            # Next.js application
│   ├── app/             # Pages (App Router)
│   ├── components/      # React components
│   ├── contexts/        # React contexts
│   └── lib/             # Utilities (API client)
│
├── docs/                # Documentation
│   ├── implementation/  # Phase documentation
│   └── reference/       # Architecture docs
│
├── docker-compose.yml   # Docker services
├── dev.sh               # Development environment manager
└── DEV_GUIDE.md         # Detailed dev.sh usage guide
```

---

## 🛠️ Common Tasks

### Run Database Migrations

```bash
cd backend
psql postgresql://postgres:postgres@localhost:5434/mtg_agent -f migrations/001_initial_schema.sql
```

### View Logs

```bash
# Backend logs
tail -f backend.log

# Frontend logs
tail -f frontend.log

# Docker logs
docker compose logs -f
```

### Check Database

```bash
# Connect to PostgreSQL
docker exec -it mtg-agent-postgres psql -U postgres -d mtg_agent

# Example queries
SELECT COUNT(*) FROM users;
SELECT * FROM chat_logs ORDER BY created_at DESC LIMIT 10;
\q  # Exit
```

### Check Redis

```bash
# Connect to Redis
docker exec -it mtg-agent-redis redis-cli

# Example commands
KEYS *
GET sess:*
exit
```

### Install New Dependencies

```bash
# Backend
cd backend
pnpm install <package-name>

# Frontend
cd frontend
pnpm install <package-name>
```

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Register new user
- [ ] Login with existing user
- [ ] Send message as authenticated user
- [ ] Send message as anonymous user
- [ ] Check rate limiting (3 messages for anonymous)
- [ ] Logout and login again
- [ ] Check session persistence (refresh page)

### API Testing

```bash
# Health check
curl http://localhost:3000/health

# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPassword123!"}'

# Send chat message (anonymous)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is a mana curve?"}'
```

---

## 🐛 Troubleshooting

### Ports Already in Use

```bash
# Find what's using the port
lsof -i :3000  # Backend
lsof -i :3001  # Frontend

# Kill the process
kill -9 <PID>
```

### Docker Issues

```bash
# Restart Docker containers
docker compose down
docker compose up -d

# View logs
docker compose logs
```

### Backend Won't Start

```bash
# Check logs
cat backend.log

# Reinstall dependencies
cd backend
rm -rf node_modules
pnpm install
```

### Frontend Won't Start

```bash
# Check logs
cat frontend.log

# Reinstall dependencies
cd frontend
rm -rf node_modules .next
pnpm install
```

---

## 📚 Documentation

- **[Development Scripts](docs/reference/DEV_SCRIPTS.md)** - Detailed script documentation
- **[STATUS.md](STATUS.md)** - Current project status
- **[Security Architecture](docs/reference/SECURITY_ARCHITECTURE.md)** - Security design
- **[NPM Security](docs/reference/NPM_SECURITY.md)** - Supply chain security

---

## 🔄 Development Workflow

1. **Start services:** `./dev.sh start`
2. **Make changes** to code
3. **Quick restart if needed:** `./dev.sh restart-backend` or `./dev.sh restart-frontend`
4. **Test changes** in browser (http://localhost:3001)
5. **Check logs** if issues occur: `./dev.sh logs`
6. **Commit changes** when ready
7. **Stop services:** `./dev.sh stop` (when done)

---

## 💡 Tips

- Keep separate terminal windows for backend and frontend logs
- Use browser DevTools Network tab to debug API calls
- Check `backend.log` and `frontend.log` for errors
- Docker containers persist data - use `docker compose down -v` to reset

---

**Last Updated:** 2025-11-11
