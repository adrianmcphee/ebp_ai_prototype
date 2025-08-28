#!/bin/bash

# Simple E2E Test Runner using existing scripts
# This avoids duplication and uses the same startup mechanism as development

set -e

echo "🚀 EBP Banking E2E Tests"
echo "========================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_PORT=8000
FRONTEND_PORT=3001
E2E_MODE=${1:-""}

# Check if we're in the right directory
if [ ! -f "Makefile" ]; then
    echo -e "${RED}✗${NC} Please run this script from the project root directory"
    exit 1
fi

# Function to cleanup
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Cleaning up...${NC}"
    lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
    lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
    pkill -f "uvicorn" 2>/dev/null || true
    pkill -f "npm run dev" 2>/dev/null || true
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Step 1: Setup E2E environment
echo "1️⃣  Setting up E2E environment..."
echo ""

cd e2e
if [ ! -d "node_modules" ]; then
    echo "Installing E2E dependencies..."
    npm install
fi

echo "Installing Playwright browsers..."
npx playwright install

cd ..
echo -e "${GREEN}✓${NC} E2E environment ready"
echo ""

# Step 2: Clean up existing services
echo "2️⃣  Preparing test environment..."
echo ""

# Kill any existing processes
lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
pkill -f "uvicorn" 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true
sleep 2

echo -e "${GREEN}✓${NC} Environment prepared"
echo ""

# Step 3: Start application using the standard script
echo "3️⃣  Starting application for testing..."
echo ""
echo -e "${BLUE}Using scripts/start-app.sh with ports: Backend=$BACKEND_PORT, Frontend=$FRONTEND_PORT${NC}"
echo ""

# Start the application in background
./scripts/start-app.sh $BACKEND_PORT $FRONTEND_PORT &
APP_PID=$!

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Verify services are running
if ! curl -s http://localhost:$BACKEND_PORT/health > /dev/null; then
    echo -e "${RED}❌ Backend not responding${NC}"
    cleanup
    exit 1
fi

if ! curl -s http://localhost:$FRONTEND_PORT > /dev/null; then
    echo -e "${RED}❌ Frontend not responding${NC}"
    cleanup
    exit 1
fi

echo -e "${GREEN}✅ Application is ready for testing${NC}"
echo ""

# Step 4: Run E2E tests
echo "4️⃣  Running E2E tests..."
echo ""

cd e2e

# Run tests based on mode
case "$E2E_MODE" in
    "debug")
        npm run test:debug
        ;;
    "headed")
        npm run test:headed
        ;;
    "chrome")
        npm run test:chrome
        ;;
    "firefox")
        npm run test:firefox
        ;;
    "webkit")
        npm run test:webkit
        ;;
    "mobile")
        npm run test:mobile
        ;;
    "performance")
        npm run test:performance
        ;;
    "accessibility")
        npm run test:accessibility
        ;;
    "visual")
        npm run test:visual
        ;;
    "ci")
        npm run test:ci
        ;;
    *)
        echo "Running all tests..."
        npm test
        ;;
esac

TEST_RESULT=$?

cd ..
echo ""

# Step 5: Show results
if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ All E2E tests passed!${NC}"
    echo ""
    echo "View detailed report:"
    echo "  cd e2e && npm run report"
else
    echo -e "${RED}❌ Some E2E tests failed${NC}"
    echo ""
    echo "View detailed report:"
    echo "  cd e2e && npm run report"
    echo ""
    echo "Debug tips:"
    echo "  - Run with debug mode: $0 debug"
    echo "  - Run with headed browsers: $0 headed"
    echo "  - Check logs above for details"
fi

echo ""
echo "🏁 E2E test run complete!"

# Cleanup
cleanup

exit $TEST_RESULT 