# Development Scripts

**Created:** 2025-11-11
**Status:** Active
**Applies To:** All development phases

## Overview

This document describes the development scripts used to manage the MTG Agent development environment.

---

## Quick Start

### Start All Services

```bash
./start-dev.sh
```

**What it does:**
1. Starts Docker containers (PostgreSQL, Redis)
2. Waits for containers to be healthy
3. Starts backend server (http://localhost:3000)
4. Starts frontend server (http://localhost:3001)
5. Displays service URLs and log locations

### Stop All Services

```bash
./stop-dev.sh
```

**What it does:**
1. Stops backend server
2. Stops frontend server
3. Stops Docker containers

---

## Scripts

### `start-dev.sh`

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
MTG Agent - Starting Development Environment
======================================
ℹ Step 1/4: Starting Docker containers...
ℹ Waiting for containers to be healthy...
✓ Docker containers running
ℹ Step 2/4: Starting backend server...
ℹ Waiting for backend to start...
✓ Backend server running (PID: 12345)
ℹ Step 3/4: Starting frontend server...
ℹ Waiting for frontend to start...
✓ Frontend server running (PID: 12346)
======================================
All Services Running!
======================================

Backend:  http://localhost:3000
Frontend: http://localhost:3001

Logs:
  Backend:  tail -f backend.log
  Frontend: tail -f frontend.log

Stop servers:
  ./stop-dev.sh
  or: kill 12345 12346 && docker compose down

✓ Ready for development!
```

---

### `stop-dev.sh`

**Purpose:** Gracefully stop all development services

**Process:**
1. Stops backend server (using PID file)
2. Stops frontend server (using PID file)
3. Falls back to pkill if PID files not found
4. Stops Docker Compose services
5. Cleans up PID files

**Exit Codes:**
- `0` - Success, all services stopped

**Example Output:**
```
======================================
MTG Agent - Stopping Development Environment
======================================
ℹ Stopping backend (PID: 12345)...
✓ Backend stopped
ℹ Stopping frontend (PID: 12346)...
✓ Frontend stopped
ℹ Stopping Docker containers...
✓ Docker containers stopped

✓ All services stopped
```

---

## Troubleshooting

### Script won't run: "Permission denied"

```bash
# Make scripts executable
chmod +x start-dev.sh stop-dev.sh
```

### Services fail to start

**Check logs:**
```bash
# Backend logs
tail -50 backend.log

# Frontend logs
tail -50 frontend.log

# Docker logs
docker compose logs
```

**Common issues:**
- Ports already in use (3000, 3001, 5434, 6379)
- Docker not running
- Missing dependencies (run `pnpm install` in backend/frontend)

### Ports already in use

```bash
# Find what's using the ports
lsof -i :3000  # Backend
lsof -i :3001  # Frontend
lsof -i :5434  # PostgreSQL
lsof -i :6379  # Redis

# Kill the processes
kill -9 <PID>
```

### Docker containers won't start

```bash
# Stop and remove all containers
docker compose down -v

# Start fresh
./start-dev.sh
```

---

## Maintenance

### When to Update Scripts

**IMPORTANT:** These scripts must be updated whenever:

1. **New services are added**
   - Example: Adding a message queue, cache server, etc.
   - Update both start and stop scripts

2. **Ports change**
   - Update health check URLs
   - Update documentation

3. **Database migrations are required**
   - Add migration step to start-dev.sh
   - Check if migrations should run automatically

4. **New environment variables are required**
   - Add validation to start-dev.sh
   - Document in this file

5. **Dependencies change**
   - Update dependency installation steps
   - Update package manager commands

### Update Process

**Step 1: Modify the script**
```bash
# Edit the script
nano start-dev.sh
# or
nano stop-dev.sh
```

**Step 2: Test the changes**
```bash
# Stop everything
./stop-dev.sh

# Test the updated script
./start-dev.sh

# Verify all services work
curl http://localhost:3000/health
curl http://localhost:3001
```

**Step 3: Update this documentation**
- Add new services to the "What it does" section
- Update example output if changed
- Add new troubleshooting steps if needed
- Update the "When to Update Scripts" section

**Step 4: Commit changes**
```bash
git add start-dev.sh stop-dev.sh docs/reference/DEV_SCRIPTS.md
git commit -m "docs: update dev scripts for [feature]"
```

---

## Future Enhancements

### Planned Features

- [ ] `restart-dev.sh` - Restart specific services
- [ ] `status-dev.sh` - Check status of all services
- [ ] `logs-dev.sh` - Tail logs from all services in one view
- [ ] Windows support (`.bat` or PowerShell versions)
- [ ] Health check validation before "Ready" message
- [ ] Database migration auto-run on startup
- [ ] Service-specific restart (e.g., `./restart-dev.sh backend`)

### Phase-Specific Updates Needed

**Phase 1.7 (Chat Sessions):**
- No script changes needed

**Phase 1.8 (Admin Dashboard):**
- No script changes needed (same frontend/backend)

**Phase 1.9 (Testing):**
- Consider adding test database setup
- May need separate `start-test.sh` script

**Phase 2+ (Future):**
- Add new services as they're introduced
- Update health checks for new endpoints

---

## Alternative: Manual Startup

If scripts fail or you prefer manual control:

```bash
# Terminal 1: Docker
docker compose up

# Terminal 2: Backend
cd backend && pnpm run dev

# Terminal 3: Frontend
cd frontend && pnpm run dev
```

---

## References

- Main documentation: [README.md](../../README.md)
- Architecture: [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md)
- Setup guide: Phase 1.0 documentation

---

**Last Updated:** 2025-11-11
**Maintainer:** Keep in sync with project architecture
**Next Review:** After each phase that adds new services
