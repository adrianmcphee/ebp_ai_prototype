#!/bin/bash

# Simple E2E Test Runner
# Tests the real system with mocked banking services (no Docker required)

set -e

echo "🚀 EBP Banking E2E Tests (No Docker)"
echo "====================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "Makefile" ]; then
    echo -e "${RED}✗${NC} Please run this script from the project root directory"
    exit 1
fi

# Step 1: Install E2E dependencies
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

# Step 2: Kill any existing services on required ports
echo "2️⃣  Cleaning up existing services..."
echo ""

# Kill processes on ports 8000 and 3001
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

echo -e "${GREEN}✓${NC} Ports cleared"
echo ""

# Step 3: Run tests (Playwright will start services automatically)
echo "3️⃣  Running E2E tests..."
echo ""
echo -e "${BLUE}Playwright will automatically start:${NC}"
echo "  - Backend API on http://127.0.0.1:8000 (with mock services)"
echo "  - Frontend on http://127.0.0.1:3001"
echo ""

cd e2e

# Run tests based on argument
case "$1" in
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

# Step 4: Show results
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
    echo "  - Run with debug mode: make test-e2e-debug"
    echo "  - Run with headed browsers: make test-e2e-headed"
    echo "  - Check backend logs in terminal"
fi

echo ""
echo "🏁 E2E test run complete!"

exit $TEST_RESULT 