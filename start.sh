#!/bin/bash

# =========================================
# PharmaDocs AI - Startup Script
# Pharmaceutical Document Management System
# =========================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║     PharmaDocs AI - Startup Script       ║${NC}"
echo -e "${BLUE}${BOLD}║  Pharmaceutical Document Management      ║${NC}"
echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# ----------------------------
# 1. Kill processes on used ports
# ----------------------------
echo -e "${YELLOW}[1/6] Cleaning up used ports...${NC}"

kill_port() {
  local port=$1
  local pids=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo -e "  ${RED}Killing processes on port $port: $pids${NC}"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  else
    echo -e "  ${GREEN}Port $port is free${NC}"
  fi
}

kill_port 3000
kill_port 3001

# ----------------------------
# 2. Check PostgreSQL
# ----------------------------
echo -e "${YELLOW}[2/6] Checking PostgreSQL...${NC}"

if command -v pg_isready &> /dev/null; then
  if pg_isready -q 2>/dev/null; then
    echo -e "  ${GREEN}PostgreSQL is running${NC}"
  else
    echo -e "  ${YELLOW}Starting PostgreSQL...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
      brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
    else
      sudo systemctl start postgresql 2>/dev/null || true
    fi
    sleep 2
  fi
else
  echo -e "  ${YELLOW}pg_isready not found, assuming PostgreSQL is running${NC}"
fi

# ----------------------------
# 3. Create database if not exists
# ----------------------------
echo -e "${YELLOW}[3/6] Setting up database...${NC}"

source "$PROJECT_DIR/.env" 2>/dev/null || true

DB_NAME="${DB_NAME:-pharma_docs}"
DB_USER="${DB_USER:-postgres}"

if psql -U "$DB_USER" -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
  echo -e "  ${GREEN}Database '$DB_NAME' exists${NC}"
else
  echo -e "  ${YELLOW}Creating database '$DB_NAME'...${NC}"
  createdb -U "$DB_USER" "$DB_NAME" 2>/dev/null || psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true
fi

# ----------------------------
# 4. Install dependencies
# ----------------------------
echo -e "${YELLOW}[4/6] Installing dependencies...${NC}"

echo -e "  ${BLUE}Installing backend dependencies...${NC}"
cd "$PROJECT_DIR/backend"
npm install --silent 2>&1 | tail -1

echo -e "  ${BLUE}Installing frontend dependencies...${NC}"
cd "$PROJECT_DIR/frontend"
npm install --silent 2>&1 | tail -1

cd "$PROJECT_DIR"

# ----------------------------
# 5. Seed database
# ----------------------------
echo -e "${YELLOW}[5/6] Seeding database...${NC}"

cd "$PROJECT_DIR/backend"
node src/seeds/seed.js

cd "$PROJECT_DIR"

# ----------------------------
# 6. Start services with hot reload
# ----------------------------
echo -e "${YELLOW}[6/6] Starting services...${NC}"

# Start backend with nodemon (hot reload)
echo -e "  ${GREEN}Starting backend on port 3001 (with hot reload)...${NC}"
cd "$PROJECT_DIR/backend"
npx nodemon src/server.js &
BACKEND_PID=$!

# Start frontend (React dev server with hot reload built-in)
echo -e "  ${GREEN}Starting frontend on port 3000 (with hot reload)...${NC}"
cd "$PROJECT_DIR/frontend"
BROWSER=none PORT=3000 npx react-scripts start &
FRONTEND_PID=$!

cd "$PROJECT_DIR"

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║         All services started!            ║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════╣${NC}"
echo -e "${GREEN}${BOLD}║  Frontend:  http://localhost:3000        ║${NC}"
echo -e "${GREEN}${BOLD}║  Backend:   http://localhost:3001        ║${NC}"
echo -e "${GREEN}${BOLD}║                                          ║${NC}"
echo -e "${GREEN}${BOLD}║  Login:     admin@pharma.com             ║${NC}"
echo -e "${GREEN}${BOLD}║  Password:  password123                  ║${NC}"
echo -e "${GREEN}${BOLD}║                                          ║${NC}"
echo -e "${GREEN}${BOLD}║  Hot reload enabled for both services    ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Cleanup on exit
cleanup() {
  echo ""
  echo -e "${RED}Shutting down services...${NC}"
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  kill_port 3000
  kill_port 3001
  echo -e "${GREEN}All services stopped.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for both processes
wait
