# Development Scripts

**Created:** 2025-11-11
**Last Updated:** 2025-12-15
**Status:** Active
**Applies To:** All development phases

## Overview

This document describes the `dev.sh` script used to manage the MTG Agent development environment in native WSL.

---

## Quick Start

### Start All Services

```bash
./dev.sh start
```

**What it does:**
1. Starts Docker containers (PostgreSQL, Redis)
2. Waits for containers to be healthy
3. Starts backend server (http://localhost:3000)
4. Starts frontend server (http://localhost:3001)
5. Displays service URLs and log locations

### Stop All Services

```bash
./dev.sh stop
```

**What it does:**
1. Stops backend server (kills all tsx processes)
2. Stops frontend server (kills all next-server processes)
3. Stops Docker containers

### Other Commands

```bash
# Check status of all services
./dev.sh status

# Restart backend only (fast, for code changes)
./dev.sh restart-backend

# Restart frontend only
./dev.sh restart-frontend

# Restart everything
./dev.sh restart

# View all logs
./dev.sh logs

# View backend logs only
./dev.sh logs-backend

# View frontend logs only
./dev.sh logs-frontend

# Show help
./dev.sh help
```

---

## Hot-Reload Support (NEW!)

**✅ Hot-reload works in native WSL!**

Since moving the project from Windows (`/mnt/c/`) to native WSL (`/home/andyv/`), tsx watch now properly detects file changes and automatically reloads the backend.

**When hot-reload works (no restart needed):**
- ✅ Code changes in existing backend files
- ✅ Code changes in frontend files
- ✅ Editing service files, middleware, models
- ✅ Updating route handler logic

**When you need to restart:**
- 🔄 Creating new route files
- 🔄 Modifying middleware registration in `index.ts`
- 🔄 Database migrations
- 🔄 Changing environment variables (`.env` file)

**Example:**
```bash
# Edit backend/src/services/chatService.ts
# Save the file
# ✅ Backend automatically reloads - no restart needed!

# Create backend/src/routes/newroute.ts
# 🔄 Restart needed:
./dev.sh restart-backend
```

---

## Script Details

### `./dev.sh start`

**Purpose:** Start all development services in the correct order

**Requirements:**
- Docker and Docker Compose installed
- pnpm installed
- Run from project root directory

**Process:**
1. Validates current directory
2. Starts Docker Compose services
3. Waits for database and Redis to be healthy
4. Installs dependencies if needed (backend)
5. Starts backend server in background
6. Installs dependencies if needed (frontend)
7. Starts frontend server in background
8. Validates all services are running
9. Displays service status and helpful commands

**Output Files:**
- `backend.log` - Backend server logs
- `frontend.log` - Frontend server logs
- `backend.pid` - Backend process ID
- `frontend.pid` - Frontend process ID

**Exit Codes:**
- `0` - Success, all services started
- `1` - Error occurred during startup

**Example Output:**
```
======================================
Starting MTG Agent Development Environment
======================================
ℹ Starting Docker containers...
ℹ Waiting for containers to be healthy...
✓ Docker containers running
ℹ Starting backend server...
ℹ Waiting for backend to start...
✓ Backend server running (PID: 12345)
ℹ Starting frontend server...
ℹ Waiting for frontend to start...
✓ Frontend server running (PID: 12346)

✓ All services started!

======================================
Service Status
======================================

Docker:   ✓ Running
Backend:  ✓ Running (http://localhost:3000)
Frontend: ✓ Running (http://localhost:3001)

Logs:
  Backend:  tail -f backend.log
  Frontend: tail -f frontend.log
  Or run:   ./dev.sh logs
```

---

### `./dev.sh stop`

**Purpose:** Gracefully stop all development services

**Process:**
1. Kills all tsx watch processes (backend)
2. Kills all next-server processes (frontend)
3. Kills parent pnpm processes using PID files
4. Stops Docker Compose services
5. Cleans up PID files

**Why it's thorough:**
- Uses multiple pkill patterns to catch zombie processes
- Targets specific process types (tsx, next-server, etc.)
- Prevents multiple server instances from accumulating
- Works reliably in WSL environment

**Exit Codes:**
- `0` - Success, all services stopped

---

### `./dev.sh restart-backend`

**Purpose:** Quickly restart only the backend server

**Use when:**
- Creating new route files
- Modifying middleware registration
- tsx watch fails to auto-reload (rare in native WSL)

**Process:**
1. Kills all backend processes
2. Starts backend with fresh tsx watch
3. Waits for health endpoint to respond

**Speed:** ~3-5 seconds (much faster than full restart)

---

### `./dev.sh status`

**Purpose:** Check running status of all services

**Output:**
```
======================================
Service Status
======================================

Docker:   ✓ Running
Backend:  ✓ Running (http://localhost:3000)
Frontend: ✓ Running (http://localhost:3001)
```

---

## Troubleshooting

### Script won't run: "Permission denied"

```bash
# Make script executable
chmod +x dev.sh
```

### Services fail to start

**Check logs:**
```bash
# Backend logs
./dev.sh logs-backend

# Frontend logs
./dev.sh logs-frontend

# Docker logs
docker compose logs
```

**Common issues:**
- Ports already in use (3000, 3001, 5434, 6379)
- Docker not running
- Missing dependencies (run `pnpm install` in backend/frontend)

### Ports already in use

```bash
# Use dev.sh to cleanly stop everything
./dev.sh stop

# If that doesn't work, find what's using the ports
lsof -i :3000  # Backend
lsof -i :3001  # Frontend
lsof -i :5434  # PostgreSQL
lsof -i :6379  # Redis

# Kill the processes
kill -9 <PID>
```

### Multiple server instances running

```bash
# Stop everything and clean up
./dev.sh stop

# Verify nothing is running
./dev.sh status

# Start fresh
./dev.sh start
```

### Docker containers won't start

```bash
# Stop and remove all containers
docker compose down -v

# Start fresh
./dev.sh start
```

### Hot-reload not working

**This should NOT happen in native WSL!** If it does:

1. Verify you're in native WSL (not `/mnt/c/`):
   ```bash
   pwd
   # Should show: /home/andyv/mtg-agent
   # NOT: /mnt/c/Users/...
   ```

2. Restart backend manually:
   ```bash
   ./dev.sh restart-backend
   ```

3. Check backend logs for tsx errors:
   ```bash
   ./dev.sh logs-backend
   ```

---

## Maintenance

### When to Update Scripts

**IMPORTANT:** The `dev.sh` script must be updated whenever:

1. **New services are added**
   - Example: Adding a message queue, cache server, etc.
   - Update start/stop/status logic

2. **Ports change**
   - Update health check URLs
   - Update documentation

3. **New process types added**
   - Add pkill patterns to stop functions
   - Update status checks

4. **New environment variables are required**
   - Add validation to startup
   - Document in this file

### Update Process

**Step 1: Modify the script**
```bash
# Edit the script
nano dev.sh
```

**Step 2: Test the changes**
```bash
# Stop everything
./dev.sh stop

# Test the updated script
./dev.sh start

# Verify all services work
./dev.sh status
curl http://localhost:3000/health
curl http://localhost:3001
```

**Step 3: Update this documentation**
- Add new services to the "What it does" section
- Update example output if changed
- Add new troubleshooting steps if needed

**Step 4: Commit changes**
```bash
git add dev.sh docs/reference/DEV_SCRIPTS.md
git commit -m "docs: update dev.sh for [feature]"
```

---

## Architecture Notes

### Why One Script (`dev.sh`) Instead of Multiple?

**Benefits:**
1. Single source of truth for dev environment management
2. Easier to maintain (one file vs many)
3. Subcommands provide clear intent (`start`, `stop`, `restart-backend`)
4. Consistent interface (like git, docker)

### Why Aggressive Process Killing?

The script uses `pkill -9` (force kill) instead of graceful SIGTERM because:

1. **WSL quirk:** Zombie processes accumulate easily
2. **Dev environment:** Safe to force kill (no production data)
3. **Multiple patterns:** Catches all variants (tsx, node, pnpm)
4. **Reliability:** Ensures clean slate on restart

### PID File Management

- `backend.pid` and `frontend.pid` track parent pnpm processes
- Used as first attempt to kill processes
- Falls back to pkill patterns if PID files missing
- Cleaned up on stop to prevent stale PIDs

---

## Alternative: Manual Startup

If the script fails or you prefer manual control:

```bash
# Terminal 1: Docker
docker compose up

# Terminal 2: Backend (with hot-reload)
cd backend && pnpm run dev

# Terminal 3: Frontend (with hot-reload)
cd frontend && pnpm run dev
```

**Note:** Manual startup doesn't track PIDs, so you'll need to manually kill processes.

---

## Future Enhancements

### Completed Features
- ✅ `restart-backend` - Restart backend only
- ✅ `restart-frontend` - Restart frontend only
- ✅ `status` - Check status of all services
- ✅ `logs` - Tail logs from all services
- ✅ Service-specific logs (`logs-backend`, `logs-frontend`)

### Planned Features
- [ ] Health check validation before "Ready" message
- [ ] Database migration auto-run on startup
- [ ] Test database setup command
- [ ] Docker-only mode (skip backend/frontend)
- [ ] Watch mode (continuously tail logs after start)

---

## References

- Main documentation: [README.md](../../README.md)
- Architecture: [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md)
- Setup guide: [Phase 1.0 documentation](../implementation/PHASE_1_MVP/PHASE_1.0_FOUNDATION.md)

---

**Last Updated:** 2025-12-15
**Maintainer:** Keep in sync with project architecture
**Next Review:** After each phase that adds new services
