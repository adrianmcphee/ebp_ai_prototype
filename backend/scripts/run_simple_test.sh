#!/bin/bash

echo "🚀 Simple E2E Test Runner"
echo "========================="
echo ""

# Start backend API
echo "Starting backend API..."
cd backend
export PYTHONPATH=.
export LLM_PROVIDER=mock
export REDIS_URL=mock
export DATABASE_URL=mock

# Start API in background
python -m uvicorn src.api:app --port 8000 --host 0.0.0.0 > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

echo "Backend PID: $BACKEND_PID"

# Wait for API to start
echo "Waiting for API to start..."
sleep 5

# Test if API is running
curl -s http://localhost:8000/health > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ API is running"
    
    # Run a simple test
    echo ""
    echo "Testing API endpoints..."
    
    # Test health endpoint
    echo -n "  Health check: "
    HEALTH=$(curl -s http://localhost:8000/health | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
    echo "$HEALTH"
    
    # Test session creation
    echo -n "  Session creation: "
    SESSION=$(curl -s -X POST http://localhost:8000/api/session | python3 -c "import sys, json; print(json.load(sys.stdin)['session_id'])" 2>/dev/null)
    if [ ! -z "$SESSION" ]; then
        echo "✅ Created session: ${SESSION:0:8}..."
    else
        echo "❌ Failed"
    fi
    
    # Test query processing
    echo -n "  Query processing: "
    RESULT=$(curl -s -X POST http://localhost:8000/api/process \
        -H "Content-Type: application/json" \
        -d '{"query": "Check my balance", "session_id": "'$SESSION'"}' \
        | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('intent', 'error'))" 2>/dev/null)
    echo "$RESULT"
    
else
    echo "❌ API failed to start"
    echo "Backend logs:"
    cat /tmp/backend.log
fi

# Cleanup
echo ""
echo "Cleaning up..."
kill $BACKEND_PID 2>/dev/null

echo "✅ Test complete"