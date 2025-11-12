#!/bin/bash

# MTG Agent Development Environment Startup Script
# This script starts all required services for development

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}======================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if we're in the project root
if [ ! -f "docker-compose.yml" ]; then
    print_error "Must run from project root directory"
    exit 1
fi

print_header "MTG Agent - Starting Development Environment"

# Step 1: Start Docker containers
print_info "Step 1/4: Starting Docker containers..."
docker compose up -d

# Wait for containers to be healthy
print_info "Waiting for containers to be healthy..."
for i in {1..30}; do
    if docker compose ps | grep -q "healthy"; then
        print_success "Docker containers running"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        print_error "Docker containers failed to become healthy"
        docker compose ps
        exit 1
    fi
done

# Step 2: Start Backend
print_info "Step 2/4: Starting backend server..."
cd backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_info "Installing backend dependencies..."
    pnpm install
fi

# Start backend in background
pnpm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../backend.pid

cd ..

# Wait for backend to start
print_info "Waiting for backend to start..."
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        print_success "Backend server running (PID: $BACKEND_PID)"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        print_error "Backend failed to start"
        tail -20 backend.log
        exit 1
    fi
done

# Step 3: Start Frontend
print_info "Step 3/4: Starting frontend server..."
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_info "Installing frontend dependencies..."
    pnpm install
fi

# Start frontend in background
pnpm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../frontend.pid

cd ..

# Wait for frontend to start
print_info "Waiting for frontend to start..."
for i in {1..60}; do
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
        print_success "Frontend server running (PID: $FRONTEND_PID)"
        break
    fi
    sleep 1
    if [ $i -eq 60 ]; then
        print_error "Frontend failed to start"
        tail -20 frontend.log
        exit 1
    fi
done

# Step 4: Summary
print_header "All Services Running!"

echo ""
echo -e "${GREEN}Backend:${NC}  http://localhost:3000"
echo -e "${GREEN}Frontend:${NC} http://localhost:3001"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo "  Backend:  tail -f backend.log"
echo "  Frontend: tail -f frontend.log"
echo ""
echo -e "${YELLOW}Stop servers:${NC}"
echo "  ./stop-dev.sh"
echo "  or: kill $BACKEND_PID $FRONTEND_PID && docker compose down"
echo ""
echo -e "${GREEN}✓ Ready for development!${NC}"
echo ""
