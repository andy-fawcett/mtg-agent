# MTG Agent - Development Guide

## Quick Start

### First Time Setup
```bash
./dev.sh start
```

This will:
- Start Docker containers (PostgreSQL, Redis)
- Start backend server (port 3000)
- Start frontend server (port 3001)

**Total startup time:** ~30-40 seconds

---

## Daily Development Workflow

### Most Common Commands

**When you make code changes to backend:**
```bash
./dev.sh restart-backend
```
⚡ **Fast!** (~5 seconds) - Only restarts backend server

**When you make code changes to frontend:**
```bash
./dev.sh restart-frontend
```
⚡ **Fast!** (~10-15 seconds) - Only restarts frontend server

**Check if everything is running:**
```bash
./dev.sh status
```

**View logs:**
```bash
./dev.sh logs              # All logs
./dev.sh logs-backend      # Backend only
./dev.sh logs-frontend     # Frontend only
```

---

## All Available Commands

| Command | Description | Speed | Use When |
|---------|-------------|-------|----------|
| `./dev.sh start` | Start all services | ~30-40s | First startup of the day |
| `./dev.sh stop` | Stop all services | ~3s | End of day |
| `./dev.sh restart` | Restart everything | ~30-40s | Major issues / full refresh |
| `./dev.sh restart-backend` | Restart backend only | ~5s | **Backend code changes** |
| `./dev.sh restart-frontend` | Restart frontend only | ~10-15s | **Frontend code changes** |
| `./dev.sh status` | Show service status | Instant | Check what's running |
| `./dev.sh logs` | Tail all logs | Continuous | Debug issues |
| `./dev.sh logs-backend` | Tail backend logs | Continuous | Backend debugging |
| `./dev.sh logs-frontend` | Tail frontend logs | Continuous | Frontend debugging |

---

## Why This Script Exists

### The Problem
During development, multiple server instances can accumulate:
- Running `pnpm run dev` manually creates new processes
- Old processes keep running on old code
- Changes don't appear to work (you're hitting the old server)
- Hard to debug which process is serving requests

### The Solution
The `dev.sh` script:
- ✅ Detects if services are already running
- ✅ Only starts what's needed (fast!)
- ✅ Provides quick restart commands for individual services
- ✅ Shows clear status of all services
- ✅ Manages logs in one place

---

## Common Scenarios

### Scenario 1: Starting Work for the Day
```bash
./dev.sh start
```
Wait ~30 seconds, then navigate to http://localhost:3001

### Scenario 2: You Changed Backend Code
```bash
./dev.sh restart-backend
```
Wait ~5 seconds, refresh browser

### Scenario 3: You Changed Frontend Component
```bash
./dev.sh restart-frontend
```
Wait ~10 seconds, hard refresh browser (Ctrl+Shift+R)

### Scenario 4: Something is Broken / Weird Behavior
```bash
# Check what's running
./dev.sh status

# If multiple processes or confusion:
./dev.sh stop
./dev.sh start
```

### Scenario 5: End of Day
```bash
./dev.sh stop
```

---

## Understanding the Services

### Docker (PostgreSQL + Redis)
- **What:** Database and session store
- **Ports:** PostgreSQL (5434), Redis (6379)
- **Startup time:** ~10 seconds
- **Usually restart:** Never (runs in background)

### Backend (Express API)
- **What:** API server with Claude integration
- **Port:** 3000
- **Startup time:** ~5 seconds
- **Restart when:** Backend code changes

### Frontend (Next.js)
- **What:** React web application
- **Port:** 3001
- **Startup time:** ~10-15 seconds (compilation)
- **Restart when:** Frontend code changes OR weird caching

---

## Troubleshooting

### "Port already in use" Error
```bash
./dev.sh stop
./dev.sh start
```

### Changes Not Appearing
```bash
# For backend changes:
./dev.sh restart-backend

# For frontend changes:
./dev.sh restart-frontend

# If still not working:
./dev.sh restart
```

### Can't Connect to Database
```bash
# Check Docker is running:
./dev.sh status

# If Docker shows not running:
docker compose up -d
```

### Multiple Processes Running (Duplicate Servers)
```bash
# This cleans up everything:
./dev.sh stop
./dev.sh start
```

---

## Performance Tips

### DON'T Do This (Slow):
```bash
# ❌ This restarts everything unnecessarily
./dev.sh restart          # 30+ seconds
```

### DO This Instead (Fast):
```bash
# ✅ This only restarts what changed
./dev.sh restart-backend  # 5 seconds
./dev.sh restart-frontend # 10 seconds
```

### When to Use Full Restart:
- After pulling new code from git
- After database schema changes
- When experiencing weird issues
- After changing environment variables

---

## Log Files

Logs are automatically written to:
- `backend.log` - All backend output
- `frontend.log` - All frontend output

View them with:
```bash
./dev.sh logs              # Both together
./dev.sh logs-backend      # Backend only
./dev.sh logs-frontend     # Frontend only

# Or manually:
tail -f backend.log
tail -f frontend.log
```

---

## Migration from Old Scripts

**Old way:**
```bash
./start-dev.sh    # Start everything
./stop-dev.sh     # Stop everything
```

**New way (more options):**
```bash
./dev.sh start              # Start everything
./dev.sh stop               # Stop everything
./dev.sh restart-backend    # Quick backend restart
./dev.sh restart-frontend   # Quick frontend restart
./dev.sh status             # Check status
```

The old scripts (`start-dev.sh`, `stop-dev.sh`) still work but `dev.sh` is recommended for faster development.

---

## Best Practices

1. **Start of day:** `./dev.sh start`
2. **Code changes:** Use `restart-backend` or `restart-frontend` (fast!)
3. **Check status:** `./dev.sh status` if confused
4. **Debug:** `./dev.sh logs` to see what's happening
5. **End of day:** `./dev.sh stop`

This workflow keeps development fast and avoids the "multiple processes" problem!
