#!/bin/bash

# MTG Agent Development Environment Manager
# Unified script to start/stop/restart services

set -e

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

# Function to check if backend is running
is_backend_running() {
    ps aux | grep -E "tsx watch src/index.ts" | grep -v grep > /dev/null 2>&1
}

# Function to check if frontend is running
is_frontend_running() {
    ps aux | grep -E "next dev -p 3001" | grep -v grep > /dev/null 2>&1
}

# Function to check if Docker is running
is_docker_running() {
    docker compose ps 2>/dev/null | grep -q "postgres.*healthy" && docker compose ps 2>/dev/null | grep -q "redis.*healthy"
}

# Function to kill backend
kill_backend() {
    print_info "Stopping backend (all processes)..."

    # First, kill the parent pnpm process if it exists
    if [ -f backend.pid ]; then
        BACKEND_PID=$(cat backend.pid)
        if ps -p $BACKEND_PID > /dev/null 2>&1; then
            print_info "Killing backend parent process (PID: $BACKEND_PID)..."
            kill -9 $BACKEND_PID 2>/dev/null || true
        fi
        rm -f backend.pid
    fi

    # Kill tsx watch processes
    pkill -9 -f "tsx watch" 2>/dev/null || true

    # Kill node processes running index.ts
    pkill -9 -f "node.*index.ts" 2>/dev/null || true

    # Kill any backend node processes
    pkill -9 -f "node.*backend" 2>/dev/null || true

    # Kill any pnpm processes running backend dev
    pkill -9 -f "pnpm.*dev.*backend" 2>/dev/null || true

    sleep 2
    print_success "Backend stopped"
}

# Function to kill frontend
kill_frontend() {
    print_info "Stopping frontend (all processes)..."

    # First, kill the parent pnpm process if it exists
    if [ -f frontend.pid ]; then
        FRONTEND_PID=$(cat frontend.pid)
        if ps -p $FRONTEND_PID > /dev/null 2>&1; then
            print_info "Killing frontend parent process (PID: $FRONTEND_PID)..."
            kill -9 $FRONTEND_PID 2>/dev/null || true
        fi
        rm -f frontend.pid
    fi

    # Kill ALL next-server processes (these are the actual servers)
    print_info "Killing all next-server processes..."
    pkill -9 -f "next-server" 2>/dev/null || true

    # Kill next dev processes
    pkill -9 -f "next dev" 2>/dev/null || true

    # Kill postcss processes from frontend
    pkill -9 -f "frontend.*postcss" 2>/dev/null || true

    # Kill any pnpm processes running frontend dev
    pkill -9 -f "pnpm.*dev" 2>/dev/null || true

    sleep 2
    print_success "Frontend stopped"
}

# Function to start Docker
start_docker() {
    if ! is_docker_running; then
        print_info "Starting Docker containers..."
        docker compose up -d

        print_info "Waiting for containers to be healthy..."
        for i in {1..30}; do
            if is_docker_running; then
                print_success "Docker containers running"
                return
            fi
            sleep 1
        done

        print_error "Docker containers failed to become healthy"
        docker compose ps
        exit 1
    else
        print_success "Docker containers already running"
    fi
}

# Function to start backend
start_backend() {
    if is_backend_running; then
        print_success "Backend already running"
        return
    fi

    cd backend

    if [ ! -d "node_modules" ]; then
        print_info "Installing backend dependencies..."
        pnpm install
    fi

    print_info "Starting backend server..."
    pnpm run dev > ../backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > ../backend.pid

    cd ..

    print_info "Waiting for backend to start..."
    for i in {1..30}; do
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            print_success "Backend server running (PID: $BACKEND_PID)"
            return
        fi
        sleep 1
    done

    print_error "Backend failed to start"
    tail -20 backend.log
    exit 1
}

# Function to start frontend
start_frontend() {
    if is_frontend_running; then
        print_success "Frontend already running"
        return
    fi

    cd frontend

    if [ ! -d "node_modules" ]; then
        print_info "Installing frontend dependencies..."
        pnpm install
    fi

    print_info "Starting frontend server..."
    pnpm run dev > ../frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > ../frontend.pid

    cd ..

    print_info "Waiting for frontend to start..."
    for i in {1..60}; do
        if curl -s http://localhost:3001 > /dev/null 2>&1; then
            print_success "Frontend server running (PID: $FRONTEND_PID)"
            return
        fi
        sleep 1
    done

    print_error "Frontend failed to start"
    tail -20 frontend.log
    exit 1
}

# Function to show status
show_status() {
    print_header "Service Status"

    echo ""
    if is_docker_running; then
        echo -e "${GREEN}Docker:${NC}   ✓ Running"
    else
        echo -e "${RED}Docker:${NC}   ✗ Not running"
    fi

    if is_backend_running; then
        echo -e "${GREEN}Backend:${NC}  ✓ Running (http://localhost:3000)"
    else
        echo -e "${RED}Backend:${NC}  ✗ Not running"
    fi

    if is_frontend_running; then
        echo -e "${GREEN}Frontend:${NC} ✓ Running (http://localhost:3001)"
    else
        echo -e "${RED}Frontend:${NC} ✗ Not running"
    fi
    echo ""
}

# Function to show help
show_help() {
    echo "MTG Agent Development Environment Manager"
    echo ""
    echo "Usage: ./dev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start           Start all services (Docker, backend, frontend)"
    echo "  stop            Stop all services"
    echo "  restart         Restart all services"
    echo "  restart-backend Restart only backend (fast)"
    echo "  restart-frontend Restart only frontend (fast)"
    echo "  status          Show status of all services"
    echo "  logs            Tail all logs"
    echo "  logs-backend    Tail backend logs"
    echo "  logs-frontend   Tail frontend logs"
    echo "  help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./dev.sh start              # Start everything"
    echo "  ./dev.sh restart-backend    # Quick backend restart (for code changes)"
    echo "  ./dev.sh status             # Check what's running"
    echo ""
}

# Main command handling
COMMAND=${1:-start}

case $COMMAND in
    start)
        print_header "Starting MTG Agent Development Environment"
        start_docker
        start_backend
        start_frontend
        echo ""
        print_success "All services started!"
        show_status
        echo -e "${YELLOW}Logs:${NC}"
        echo "  Backend:  tail -f backend.log"
        echo "  Frontend: tail -f frontend.log"
        echo "  Or run:   ./dev.sh logs"
        echo ""
        ;;

    stop)
        print_header "Stopping MTG Agent Development Environment"
        kill_backend
        kill_frontend
        print_info "Stopping Docker containers..."
        docker compose down
        print_success "Docker containers stopped"
        echo ""
        print_success "All services stopped"
        echo ""
        ;;

    restart)
        print_header "Restarting MTG Agent Development Environment"
        kill_backend
        kill_frontend
        sleep 1
        start_docker
        start_backend
        start_frontend
        echo ""
        print_success "All services restarted!"
        show_status
        ;;

    restart-backend)
        print_header "Restarting Backend (Fast)"
        kill_backend
        start_backend
        print_success "Backend restarted!"
        ;;

    restart-frontend)
        print_header "Restarting Frontend (Fast)"
        kill_frontend
        start_frontend
        print_success "Frontend restarted!"
        ;;

    status)
        show_status
        ;;

    logs)
        echo "Tailing all logs (Ctrl+C to exit)..."
        echo ""
        tail -f backend.log frontend.log
        ;;

    logs-backend)
        echo "Tailing backend logs (Ctrl+C to exit)..."
        echo ""
        tail -f backend.log
        ;;

    logs-frontend)
        echo "Tailing frontend logs (Ctrl+C to exit)..."
        echo ""
        tail -f frontend.log
        ;;

    help)
        show_help
        ;;

    *)
        print_error "Unknown command: $COMMAND"
        echo ""
        show_help
        exit 1
        ;;
esac
