#!/bin/bash

echo "🚀 NLP Banking Full Test Suite"
echo "=============================="
echo ""

# Configuration
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKEND_DIR="./backend"
TESTS_PASSED=0
TESTS_FAILED=0

echo "📦 Stage 1: Unit Tests"
echo "----------------------"
cd $BACKEND_DIR
export PYTHONPATH=.

# Run unit tests
echo "Running mock banking tests..."
python -m pytest tests/test_mock_banking.py -v --tb=short
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Mock banking tests passed"
    TESTS_PASSED=$((TESTS_PASSED + 13))
else
    echo -e "${RED}✗${NC} Mock banking tests failed"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo ""
echo "Running entity extractor tests..."
python -m pytest tests/test_entity_extractor.py -v --tb=short
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Entity extractor tests passed"
    TESTS_PASSED=$((TESTS_PASSED + 17))
else
    echo -e "${RED}✗${NC} Entity extractor tests failed"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

cd ..

echo ""
echo "📦 Stage 2: API Integration Tests"
echo "---------------------------------"

# Start API
echo "Starting API server..."
cd $BACKEND_DIR
export DATABASE_URL=mock
export REDIS_URL=mock
export LLM_PROVIDER=mock

python -m uvicorn src.api:app --port 8000 --host 0.0.0.0 > /tmp/api.log 2>&1 &
API_PID=$!

# Wait for API to start
sleep 5

# Check if API is running
curl -s http://localhost:8000/health > /dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} API started successfully"
    
    # Run API tests
    echo ""
    echo "Testing API endpoints..."
    
    # Test 1: Health check
    echo -n "  Health check: "
    HEALTH=$(curl -s http://localhost:8000/health | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
    if [ "$HEALTH" = "healthy" ]; then
        echo -e "${GREEN}✓${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    # Test 2: Session creation
    echo -n "  Session creation: "
    SESSION=$(curl -s -X POST http://localhost:8000/api/session | python3 -c "import sys, json; print(json.load(sys.stdin)['session_id'])" 2>/dev/null)
    if [ ! -z "$SESSION" ]; then
        echo -e "${GREEN}✓${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    # Test 3: Balance query
    echo -n "  Balance query: "
    INTENT=$(curl -s -X POST http://localhost:8000/api/process \
        -H "Content-Type: application/json" \
        -d '{"query": "Check my balance", "session_id": "'$SESSION'"}' \
        | python3 -c "import sys, json; print(json.load(sys.stdin)['intent'])" 2>/dev/null)
    if [ "$INTENT" = "balance" ]; then
        echo -e "${GREEN}✓${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    # Test 4: Transfer query
    echo -n "  Transfer query: "
    INTENT=$(curl -s -X POST http://localhost:8000/api/process \
        -H "Content-Type: application/json" \
        -d '{"query": "Send $500 to John", "session_id": "'$SESSION'"}' \
        | python3 -c "import sys, json; print(json.load(sys.stdin)['intent'])" 2>/dev/null)
    if [ "$INTENT" = "transfer" ]; then
        echo -e "${GREEN}✓${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    # Test 5: History query
    echo -n "  History query: "
    INTENT=$(curl -s -X POST http://localhost:8000/api/process \
        -H "Content-Type: application/json" \
        -d '{"query": "Show my transactions", "session_id": "'$SESSION'"}' \
        | python3 -c "import sys, json; print(json.load(sys.stdin)['intent'])" 2>/dev/null)
    if [ "$INTENT" = "history" ]; then
        echo -e "${GREEN}✓${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    # Test 6: Context resolution
    echo -n "  Context resolution: "
    # First query to establish context
    curl -s -X POST http://localhost:8000/api/process \
        -H "Content-Type: application/json" \
        -d '{"query": "Send $200 to David Brown", "session_id": "'$SESSION'"}' > /dev/null
    
    # Second query using pronoun
    ENTITIES=$(curl -s -X POST http://localhost:8000/api/process \
        -H "Content-Type: application/json" \
        -d '{"query": "Send another $100 to him", "session_id": "'$SESSION'"}' \
        | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['entities'].get('amount', 0))" 2>/dev/null)
    if [ "$ENTITIES" = "100.0" ]; then
        echo -e "${GREEN}✓${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    # Test 7: Get accounts
    echo -n "  Get accounts: "
    ACCOUNTS=$(curl -s http://localhost:8000/api/accounts | python3 -c "import sys, json; print(len(json.load(sys.stdin)['accounts']))" 2>/dev/null)
    if [ "$ACCOUNTS" -gt 0 ]; then
        echo -e "${GREEN}✓${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
else
    echo -e "${RED}✗${NC} API failed to start"
    echo "API logs:"
    cat /tmp/api.log
    TESTS_FAILED=$((TESTS_FAILED + 7))
fi

# Cleanup
kill $API_PID 2>/dev/null

cd ..

echo ""
echo "=================="
echo "📊 Test Results"
echo "=================="
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠️  Some tests failed${NC}"
    exit 1
fi