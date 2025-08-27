#!/bin/bash

echo "🚀 Starting EBP Banking Application..."
echo "====================================="

# Function to cleanup processes
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    pkill -f "uvicorn" 2>/dev/null || true
    pkill -f "npm run dev" 2>/dev/null || true
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Set environment variables
export DATABASE_URL=mock
export REDIS_URL=mock  
export LLM_PROVIDER=mock

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "uvicorn" 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true
sleep 2

# Start backend API
echo "📡 Starting Backend API on http://localhost:8000..."
cd backend
python -m uvicorn src.api:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 5

# Check backend health
if curl -s http://localhost:8000/health > /dev/null; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend failed to start"
    exit 1
fi

# Start frontend
echo "🖥️  Starting Frontend..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Wait for frontend to start
sleep 8

echo ""
echo "✅ EBP Banking Application is running!"
echo "====================================="
echo "🖥️  Frontend: http://localhost:3001"
echo "📡 Backend API: http://localhost:8000"
echo "📖 API Documentation: http://localhost:8000/docs"
echo ""
echo "🔗 Try these commands in the web interface:"
echo "   • What's my balance?"
echo "   • Transfer \$100 to John"
echo "   • Show my recent transactions"
echo ""
echo "🤖 For Claude Desktop integration:"
echo "   Copy backend/claude_desktop_config.json to your Claude Desktop config"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user to stop
wait 