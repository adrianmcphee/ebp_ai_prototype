#!/usr/bin/env python3
"""Bridge to call MCP server tools from Claude Code"""

import asyncio
import json
import sys
from typing import Any, Dict

async def call_mcp_tool(tool_name: str, arguments: Dict[str, Any]) -> str:
    """Call an MCP tool and return the result"""

    # Import the MCP server components
    sys.path.insert(0, '/Users/adrianmcphee/mydev/backbase/ebpnlp/backend')
    from src.mcp_server import EBPMCPServer

    # Initialize the server
    server = EBPMCPServer()
    await server.initialize_pipeline()

    # Call the appropriate tool method based on the tool name
    tool_methods = {
        'check_account_balance': server.handle_check_balance,
        'transfer_funds_internal': server.handle_transfer,
        'send_p2p_payment': server.handle_p2p,
        'pay_bill': server.handle_bill_payment,
        'freeze_card': server.handle_freeze_card,
        'get_transaction_history': server.handle_transactions,
        'dispute_transaction': server.handle_dispute,
        'request_human_agent': server.handle_agent_request,
    }

    if tool_name not in tool_methods:
        return json.dumps({"error": f"Unknown tool: {tool_name}"})

    # Call the tool
    result = await tool_methods[tool_name](arguments)

    # Convert TextContent to string
    if hasattr(result, '__iter__'):
        text_parts = []
        for item in result:
            if hasattr(item, 'text'):
                text_parts.append(item.text)
        return '\n'.join(text_parts)

    return str(result)

async def main():
    """Main function to handle command line arguments"""
    if len(sys.argv) < 2:
        print("Usage: mcp_bridge.py <tool_name> [arguments_json]")
        sys.exit(1)

    tool_name = sys.argv[1]
    arguments = {}

    if len(sys.argv) > 2:
        try:
            arguments = json.loads(sys.argv[2])
        except json.JSONDecodeError:
            print(f"Error: Invalid JSON arguments: {sys.argv[2]}")
            sys.exit(1)

    result = await call_mcp_tool(tool_name, arguments)
    print(result)

if __name__ == "__main__":
    asyncio.run(main())