#!/bin/bash

# MTG Agent Development Environment Stop Script
# This script stops all running services

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}======================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

print_header "MTG Agent - Stopping Development Environment"

# Stop backend
if [ -f "backend.pid" ]; then
    BACKEND_PID=$(cat backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        print_info "Stopping backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
        print_success "Backend stopped"
    fi
    rm backend.pid
else
    print_info "Stopping any running backend processes..."
    pkill -f "tsx watch src/index.ts" 2>/dev/null || true
fi

# Stop frontend
if [ -f "frontend.pid" ]; then
    FRONTEND_PID=$(cat frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        print_info "Stopping frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        print_success "Frontend stopped"
    fi
    rm frontend.pid
else
    print_info "Stopping any running frontend processes..."
    pkill -f "next dev" 2>/dev/null || true
fi

# Stop Docker containers
print_info "Stopping Docker containers..."
docker compose down
print_success "Docker containers stopped"

echo ""
print_success "All services stopped"
echo ""
