#!/bin/bash

# E2E Test Runner Script
# This script sets up and runs the complete E2E test suite

set -e

echo "🚀 NLP Banking E2E Test Suite"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="./backend"
FRONTEND_DIR="./frontend"
E2E_DIR="./e2e"

# Function to check if a service is running
check_service() {
    local port=$1
    local service=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${GREEN}✓${NC} $service is running on port $port"
        return 0
    else
        echo -e "${YELLOW}!${NC} $service is not running on port $port"
        return 1
    fi
}

# Function to start a service
start_service() {
    local cmd=$1
    local service=$2
    local port=$3
    local log_file=$4
    
    echo "Starting $service..."
    nohup $cmd > $log_file 2>&1 &
    local pid=$!
    
    # Wait for service to start
    local count=0
    while ! check_service $port "$service" > /dev/null 2>&1; do
        sleep 1
        count=$((count + 1))
        if [ $count -gt 30 ]; then
            echo -e "${RED}✗${NC} Failed to start $service"
            cat $log_file
            exit 1
        fi
    done
    
    echo $pid
}

# Step 1: Check dependencies
echo "1️⃣  Checking dependencies..."
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗${NC} Python 3 is not installed"
    exit 1
fi
echo -e "${GREEN}✓${NC} Python $(python3 --version)"

# Check Node
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗${NC} Node.js is not installed"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node $(node --version)"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}!${NC} Docker is not installed (using local services)"
else
    echo -e "${GREEN}✓${NC} Docker $(docker --version | cut -d' ' -f3)"
fi

echo ""

# Step 2: Start infrastructure services
echo "2️⃣  Starting infrastructure services..."
echo ""

# Start Redis
if ! check_service 6379 "Redis"; then
    if command -v docker &> /dev/null; then
        echo "Starting Redis with Docker..."
        docker run -d --name redis-test -p 6379:6379 redis:alpine > /dev/null 2>&1
        sleep 2
    else
        echo -e "${YELLOW}!${NC} Please start Redis manually on port 6379"
    fi
fi

# Start PostgreSQL
if ! check_service 5432 "PostgreSQL"; then
    if command -v docker &> /dev/null; then
        echo "Starting PostgreSQL with Docker..."
        docker run -d --name postgres-test \
            -e POSTGRES_USER=user \
            -e POSTGRES_PASSWORD=pass \
            -e POSTGRES_DB=nlp_banking_test \
            -p 5432:5432 \
            postgres:14-alpine > /dev/null 2>&1
        sleep 5
        
        # Run migrations
        echo "Running database migrations..."
        PGPASSWORD=pass psql -h localhost -U user -d nlp_banking_test \
            -f $BACKEND_DIR/migrations/001_initial.sql > /dev/null 2>&1
    else
        echo -e "${YELLOW}!${NC} Please start PostgreSQL manually on port 5432"
    fi
fi

echo ""

# Step 3: Install dependencies
echo "3️⃣  Installing dependencies..."
echo ""

# Backend dependencies
cd $BACKEND_DIR
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r ../requirements.txt
echo -e "${GREEN}✓${NC} Backend dependencies installed"

# Frontend dependencies
cd ../$FRONTEND_DIR
if [ ! -d "node_modules" ]; then
    npm install --silent
fi
echo -e "${GREEN}✓${NC} Frontend dependencies installed"

# E2E dependencies
cd ../$E2E_DIR
if [ ! -d "node_modules" ]; then
    npm install --silent
    npx playwright install --silent
fi
echo -e "${GREEN}✓${NC} E2E dependencies installed"

cd ..
echo ""

# Step 4: Seed test database
echo "4️⃣  Seeding test database..."
echo ""
cd $BACKEND_DIR
python tests/fixtures/seed_database.py
cd ..
echo ""

# Step 5: Start application services
echo "5️⃣  Starting application services..."
echo ""

# Start backend
if ! check_service 8000 "Backend API"; then
    BACKEND_PID=$(start_service \
        "cd $BACKEND_DIR && python -m uvicorn src.api:app --port 8000" \
        "Backend API" \
        8000 \
        "/tmp/backend.log")
fi

# Start frontend
if ! check_service 3000 "Frontend"; then
    FRONTEND_PID=$(start_service \
        "cd $FRONTEND_DIR && npm start" \
        "Frontend" \
        3000 \
        "/tmp/frontend.log")
fi

echo ""

# Step 6: Run E2E tests
echo "6️⃣  Running E2E tests..."
echo ""

cd $E2E_DIR

# Run tests based on argument
if [ "$1" == "debug" ]; then
    npm run test:debug
elif [ "$1" == "headed" ]; then
    npm run test:headed
elif [ "$1" == "performance" ]; then
    npm run test:performance
elif [ "$1" == "accessibility" ]; then
    npm run test:accessibility
elif [ "$1" == "visual" ]; then
    npm run test:visual
elif [ "$1" == "ci" ]; then
    npm run test:ci
else
    npm test
fi

TEST_RESULT=$?

cd ..
echo ""

# Step 7: Generate report
if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "View detailed report:"
    echo "  cd e2e && npm run report"
else
    echo -e "${RED}❌ Some tests failed${NC}"
    echo ""
    echo "View detailed report:"
    echo "  cd e2e && npm run report"
fi

echo ""

# Step 8: Cleanup (optional)
if [ "$2" == "--cleanup" ]; then
    echo "7️⃣  Cleaning up..."
    
    # Stop services
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Stop Docker containers
    if command -v docker &> /dev/null; then
        docker stop redis-test postgres-test 2>/dev/null || true
        docker rm redis-test postgres-test 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✓${NC} Cleanup complete"
fi

echo ""
echo "🏁 E2E test run complete!"

exit $TEST_RESULT