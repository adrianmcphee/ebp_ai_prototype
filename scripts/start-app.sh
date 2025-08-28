#!/bin/bash

# Parse command line arguments
BACKEND_PORT=${1:-8000}
FRONTEND_PORT=${2:-3001}

echo "🚀 Starting EBP Banking Application..."
echo "====================================="
echo "Backend Port: $BACKEND_PORT"
echo "Frontend Port: $FRONTEND_PORT"
echo ""

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

# Kill any existing processes on the specified ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
pkill -f "uvicorn" 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true
sleep 2

# Start backend API
echo "📡 Starting Backend API on http://localhost:$BACKEND_PORT..."
cd backend
python -m uvicorn src.api:app --reload --host 127.0.0.1 --port $BACKEND_PORT &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
for i in {1..30}; do
    if curl -s http://localhost:$BACKEND_PORT/health > /dev/null; then
        echo "✅ Backend is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Backend failed to start after 30 seconds"
        exit 1
    fi
    sleep 1
done

# Start frontend
echo "🖥️  Starting Frontend on http://localhost:$FRONTEND_PORT..."
cd ../frontend
npm run dev -- --port $FRONTEND_PORT --host 127.0.0.1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Wait for frontend to start
echo "⏳ Waiting for frontend to start..."
for i in {1..30}; do
    if curl -s http://localhost:$FRONTEND_PORT > /dev/null; then
        echo "✅ Frontend is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Frontend failed to start after 30 seconds"
        exit 1
    fi
    sleep 1
done

echo ""
echo "✅ EBP Banking Application is running!"
echo "====================================="
echo "🖥️  Frontend: http://localhost:$FRONTEND_PORT"
echo "📡 Backend API: http://localhost:$BACKEND_PORT"
echo "📖 API Documentation: http://localhost:$BACKEND_PORT/docs"
echo ""
echo "🔗 Try these commands in the web interface:"
echo "   • What's my balance?"
echo "   • Transfer \$100 to John"
echo "   • Show my recent transactions"
echo ""
echo "🤖 For Claude Desktop integration:"
echo "   Copy backend/claude_desktop_config.json to your Claude Desktop config"
echo ""
echo "Usage: $0 [backend_port] [frontend_port]"
echo "  Default ports: backend=8000, frontend=3001"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user to stop
wait 