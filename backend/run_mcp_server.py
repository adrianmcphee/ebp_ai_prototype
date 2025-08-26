#!/usr/bin/env python3
"""
Entry point for running the EBP Banking MCP Server
"""

import asyncio
import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.mcp_server import main

if __name__ == "__main__":
    asyncio.run(main())