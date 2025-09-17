#!/usr/bin/env python3
"""Simple MCP client to test the banking server"""

import asyncio
import json
import subprocess
import sys

async def send_mcp_request(request):
    """Send a request to the MCP server and get response"""
    proc = await asyncio.create_subprocess_exec(
        sys.executable,
        '/Users/adrianmcphee/mydev/backbase/ebpnlp/backend/run_mcp_server.py',
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )

    # Send request
    request_str = json.dumps(request) + '\n'
    proc.stdin.write(request_str.encode())
    await proc.stdin.drain()

    # Get response
    response = await proc.stdout.readline()

    # Clean up
    proc.terminate()
    await proc.wait()

    return json.loads(response)

async def main():
    print("Testing MCP Banking Server...")

    # Initialize request
    init_request = {
        "jsonrpc": "2.0",
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            }
        },
        "id": 1
    }

    print("\n1. Sending initialize request...")
    response = await send_mcp_request(init_request)
    print(f"Response: {json.dumps(response, indent=2)}")

    # List tools request
    list_tools_request = {
        "jsonrpc": "2.0",
        "method": "tools/list",
        "params": {},
        "id": 2
    }

    print("\n2. Listing available tools...")
    response = await send_mcp_request(list_tools_request)
    print(f"Available tools: {json.dumps(response, indent=2)}")

    # Call a tool
    check_balance_request = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": "check_account_balance",
            "arguments": {
                "account_type": "checking"
            }
        },
        "id": 3
    }

    print("\n3. Checking account balance...")
    response = await send_mcp_request(check_balance_request)
    print(f"Balance response: {json.dumps(response, indent=2)}")

if __name__ == "__main__":
    asyncio.run(main())