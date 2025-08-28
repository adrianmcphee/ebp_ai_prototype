#!/bin/bash

echo "🤖 Starting EBP Banking MCP Server for Claude Desktop..."
echo "======================================================="

# Set environment variables
export DATABASE_URL=mock
export REDIS_URL=mock  
export LLM_PROVIDER=mock

echo "📡 Starting MCP Server..."
echo "   Environment: Mock banking services"
echo "   Ready for Claude Desktop integration"
echo ""

# Start the MCP server
cd backend
python run_mcp_server.py

echo ""
echo "🛑 MCP Server stopped." 