"""MCP Server for Backbase EBP Banking Operations
Exposes banking intents as MCP tools for AI assistants
"""

import asyncio
import json
import logging
from typing import Optional

from mcp.server.models import InitializeResult
from mcp.server.server import NotificationOptions, Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    EmbeddedResource,
    ImageContent,
    TextContent,
    Tool,
)

from .config import settings
from .context_aware_responses import ContextAwareResponseGenerator
from .entity_extractor import EntityExtractor
from .intent_classifier import IntentClassifier
from .llm_client import create_llm_client
from .mock_banking import MockBankingService
from .pipeline import IntentPipeline
from .state_manager import ConversationStateManager

logger = logging.getLogger(__name__)


class EBPMCPServer:
    """MCP Server for Enterprise Banking Platform"""

    def __init__(self):
        self.server = Server("ebp-banking")
        self.pipeline: Optional[IntentPipeline] = None
        self.active_sessions: dict[str, str] = {}  # tool_call_id -> session_id

        # Register MCP handlers
        self._register_handlers()

    def _register_handlers(self):
        """Register MCP protocol handlers"""

        @self.server.list_tools()
        async def handle_list_tools() -> list[Tool]:
            """List available banking tools"""
            return [
                Tool(
                    name="check_account_balance",
                    description="Check account balance for a specific account",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "account_id": {
                                "type": "string",
                                "description": "Account identifier (account number or nickname)",
                            },
                            "account_type": {
                                "type": "string",
                                "description": "Type of account (checking, savings, credit)",
                                "enum": ["checking", "savings", "credit", "investment"],
                            },
                        },
                        "required": ["account_id"],
                    },
                ),
                Tool(
                    name="transfer_funds_internal",
                    description="Transfer money between customer's own accounts",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "amount": {
                                "type": "number",
                                "description": "Amount to transfer",
                                "minimum": 0.01,
                            },
                            "from_account": {
                                "type": "string",
                                "description": "Source account identifier",
                            },
                            "to_account": {
                                "type": "string",
                                "description": "Destination account identifier",
                            },
                            "memo": {
                                "type": "string",
                                "description": "Optional transfer memo/description",
                            },
                        },
                        "required": ["amount", "from_account", "to_account"],
                    },
                ),
                Tool(
                    name="send_p2p_payment",
                    description="Send person-to-person payment (Zelle, etc)",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "amount": {
                                "type": "number",
                                "description": "Payment amount",
                                "minimum": 0.01,
                            },
                            "recipient": {
                                "type": "string",
                                "description": "Recipient email, phone, or name",
                            },
                            "from_account": {
                                "type": "string",
                                "description": "Source account for payment",
                            },
                            "memo": {
                                "type": "string",
                                "description": "Payment memo/reason",
                            },
                        },
                        "required": ["amount", "recipient"],
                    },
                ),
                Tool(
                    name="pay_bill",
                    description="Pay a bill to a company or service provider",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "payee": {
                                "type": "string",
                                "description": "Bill payee name or company",
                            },
                            "amount": {
                                "type": "number",
                                "description": "Bill amount to pay",
                                "minimum": 0.01,
                            },
                            "from_account": {
                                "type": "string",
                                "description": "Account to pay from",
                            },
                            "account_number": {
                                "type": "string",
                                "description": "Account number with the payee",
                            },
                            "due_date": {
                                "type": "string",
                                "description": "Bill due date (YYYY-MM-DD)",
                            },
                        },
                        "required": ["payee", "amount"],
                    },
                ),
                Tool(
                    name="freeze_card",
                    description="Temporarily freeze/block a debit or credit card",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "card_identifier": {
                                "type": "string",
                                "description": "Last 4 digits or card nickname",
                            },
                            "card_type": {
                                "type": "string",
                                "description": "Type of card",
                                "enum": ["debit", "credit"],
                            },
                            "reason": {
                                "type": "string",
                                "description": "Reason for freezing (lost, stolen, suspicious)",
                            },
                        },
                        "required": ["card_identifier"],
                    },
                ),
                Tool(
                    name="get_transaction_history",
                    description="Get recent transaction history for an account",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "account_id": {
                                "type": "string",
                                "description": "Account identifier",
                            },
                            "days": {
                                "type": "integer",
                                "description": "Number of days to look back",
                                "minimum": 1,
                                "maximum": 90,
                                "default": 30,
                            },
                            "transaction_type": {
                                "type": "string",
                                "description": "Filter by transaction type",
                                "enum": ["all", "debits", "credits", "transfers"],
                            },
                        },
                        "required": ["account_id"],
                    },
                ),
                Tool(
                    name="dispute_transaction",
                    description="Dispute a fraudulent or incorrect transaction",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "transaction_id": {
                                "type": "string",
                                "description": "Transaction identifier to dispute",
                            },
                            "dispute_reason": {
                                "type": "string",
                                "description": "Reason for dispute",
                                "enum": [
                                    "fraud",
                                    "unauthorized",
                                    "incorrect_amount",
                                    "duplicate",
                                    "cancelled_recurring",
                                ],
                            },
                            "description": {
                                "type": "string",
                                "description": "Detailed description of the issue",
                            },
                        },
                        "required": ["transaction_id", "dispute_reason"],
                    },
                ),
                Tool(
                    name="request_human_agent",
                    description="Request to speak with a human customer service agent",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "reason": {
                                "type": "string",
                                "description": "Reason for requesting human agent",
                            },
                            "priority": {
                                "type": "string",
                                "description": "Priority level",
                                "enum": ["low", "medium", "high", "urgent"],
                            },
                            "preferred_contact": {
                                "type": "string",
                                "description": "Preferred contact method",
                                "enum": ["phone", "chat", "email", "callback"],
                            },
                        },
                        "required": ["reason"],
                    },
                ),
            ]

        @self.server.call_tool()
        async def handle_call_tool(
            name: str, arguments: dict
        ) -> list[TextContent | ImageContent | EmbeddedResource]:
            """Handle tool execution requests"""
            try:
                logger.info(f"MCP tool called: {name} with args: {arguments}")

                # Generate or get session ID for this tool call
                session_id = self._get_session_id()

                # Convert tool call to natural language query
                query = self._tool_to_query(name, arguments)

                # Process through banking pipeline
                result = await self.pipeline.process(
                    query=query,
                    session_id=session_id,
                    user_profile={"source": "mcp", "tool_name": name},
                )

                # Convert pipeline result to MCP response
                return self._format_mcp_response(result, name)

            except Exception as e:
                logger.error(f"Error executing tool {name}: {e!s}")
                return [TextContent(type="text", text=f"Error executing {name}: {e!s}")]

    def _get_session_id(self) -> str:
        """Generate a session ID for tool execution"""
        import uuid

        return f"mcp_session_{uuid.uuid4().hex[:8]}"

    def _tool_to_query(self, tool_name: str, arguments: dict) -> str:
        """Convert MCP tool call to natural language query for pipeline"""
        query_templates = {
            "check_account_balance": "What's the balance in my {account_type} account {account_id}?",
            "transfer_funds_internal": "Transfer ${amount} from {from_account} to {to_account}",
            "send_p2p_payment": "Send ${amount} to {recipient} from {from_account}",
            "pay_bill": "Pay ${amount} to {payee} from {from_account}",
            "freeze_card": "Freeze my {card_type} card ending in {card_identifier}",
            "get_transaction_history": "Show me transactions for {account_id} for the last {days} days",
            "dispute_transaction": "I want to dispute transaction {transaction_id} for {dispute_reason}",
            "request_human_agent": "I need to speak with an agent about {reason}",
        }

        template = query_templates.get(tool_name, f"Execute {tool_name}")

        try:
            # Fill in template with arguments
            query = template.format(**arguments)

            # Add memo if provided
            if arguments.get("memo"):
                query += f" with memo: {arguments['memo']}"

            return query
        except KeyError:
            # If template formatting fails, create basic query
            return f"{tool_name.replace('_', ' ')} with parameters: {json.dumps(arguments)}"

    def _format_mcp_response(
        self, pipeline_result: dict, tool_name: str
    ) -> list[TextContent]:
        """Format pipeline response for MCP client"""
        response_parts = []

        # Main result
        if pipeline_result.get("execution"):
            execution = pipeline_result["execution"]
            if execution.get("success"):
                response_parts.append(
                    f"✅ {tool_name.replace('_', ' ').title()} completed successfully."
                )
                if execution.get("result"):
                    response_parts.append(str(execution["result"]))
            else:
                response_parts.append(
                    f"❌ {tool_name.replace('_', ' ').title()} failed."
                )
                if execution.get("error"):
                    response_parts.append(f"Error: {execution['error']}")

        # Warnings
        if pipeline_result.get("warnings"):
            for warning in pipeline_result["warnings"]:
                response_parts.append(f"⚠️ {warning}")

        # Missing information
        if pipeline_result.get("missing_fields"):
            missing = ", ".join(pipeline_result["missing_fields"])
            response_parts.append(f"ℹ️ Additional information needed: {missing}")

        # Confirmation required
        if pipeline_result.get("requires_confirmation"):
            response_parts.append("⏳ This operation requires confirmation.")
            if pipeline_result.get("pending_clarification"):
                response_parts.append("Please provide additional details when ready.")

        # Authentication required
        if pipeline_result.get("requires_approval"):
            response_parts.append(
                "🔐 Additional authentication required for this operation."
            )

        # Default response if nothing specific
        if not response_parts:
            response_parts.append(f"Processed {tool_name} request.")
            if pipeline_result.get("intent"):
                response_parts.append(f"Intent: {pipeline_result['intent']}")
                response_parts.append(
                    f"Confidence: {pipeline_result.get('confidence', 0):.2f}"
                )

        return [TextContent(type="text", text="\n".join(response_parts))]

    async def initialize_pipeline(self):
        """Initialize the banking pipeline for tool execution"""
        try:
            # Initialize LLM client
            llm_client = create_llm_client(
                settings.llm_provider, settings.llm_api_key, settings.llm_model
            )

            # Initialize components
            classifier = IntentClassifier(llm_client)
            extractor = EntityExtractor(llm_client)
            response_generator = ContextAwareResponseGenerator(llm_client)
            state_manager = ConversationStateManager()
            banking_service = MockBankingService()

            # Create enhanced pipeline
            self.pipeline = IntentPipeline(
                classifier=classifier,
                extractor=extractor,
                response_generator=response_generator,
                state_manager=state_manager,
                banking_service=banking_service,
            )

            logger.info("EBP MCP Server pipeline initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize pipeline: {e!s}")
            raise

    async def run(self):
        """Run the MCP server"""
        await self.initialize_pipeline()

        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                InitializeResult(
                    serverName="ebp-banking",
                    serverVersion="1.0.0",
                    capabilities=self.server.get_capabilities(
                        notification_options=NotificationOptions(),
                        experimental_capabilities={},
                    ),
                ),
            )


async def main():
    """Main entry point for MCP server"""
    logging.basicConfig(level=logging.INFO)
    server = EBPMCPServer()
    await server.run()


if __name__ == "__main__":
    asyncio.run(main())
