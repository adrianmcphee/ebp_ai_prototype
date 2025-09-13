"""Banking Operations Catalog

Maps intents to concrete banking operations with business logic, validation rules,
and execution workflows. This bridges the gap between intent classification and
actual banking actions.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, Callable
import asyncio
from datetime import datetime, timedelta

from .mock_banking import MockBankingService
from .intent_catalog import AuthLevel, RiskLevel


class OperationType(Enum):
    """Types of banking operations"""
    READ_ONLY = "read_only"      # View information
    TRANSACTIONAL = "transactional"  # Move money
    ADMINISTRATIVE = "administrative"  # Account management  
    NAVIGATIONAL = "navigational"     # UI guidance


class OperationStatus(Enum):
    """Execution status of operations"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    REQUIRES_APPROVAL = "requires_approval"


@dataclass
class OperationResult:
    """Result of a banking operation execution"""
    status: OperationStatus
    data: Dict[str, Any]
    message: str
    reference_id: Optional[str] = None
    next_steps: Optional[List[str]] = None
    ui_hints: Optional[Dict[str, Any]] = None


@dataclass 
class BankingOperation:
    """Definition of a banking operation"""
    operation_id: str
    name: str
    type: OperationType
    description: str
    required_entities: List[str]
    optional_entities: List[str]
    business_rules: List[str]
    risk_level: RiskLevel
    auth_level: AuthLevel
    execution_handler: Callable
    validation_rules: Optional[List[Callable]] = None
    ui_flow: Optional[str] = None
    confirmation_required: bool = False


class BankingOperationsCatalog:
    """Catalog of all available banking operations"""

    def __init__(self, banking_service: MockBankingService):
        self.banking = banking_service
        self.operations = self._initialize_operations()

    def _initialize_operations(self) -> Dict[str, BankingOperation]:
        """Initialize all banking operations"""
        operations = {}

        # ACCOUNT OPERATIONS
        operations["check_balance"] = BankingOperation(
            operation_id="check_balance",
            name="Check Account Balance", 
            type=OperationType.READ_ONLY,
            description="Retrieve current account balance",
            required_entities=["account_type"],
            optional_entities=["account_id"],
            business_rules=["account_must_exist", "user_must_own_account"],
            risk_level=RiskLevel.LOW,
            auth_level=AuthLevel.BASIC,
            execution_handler=self._execute_balance_check,
            ui_flow="balance_display"
        )

        operations["get_transaction_history"] = BankingOperation(
            operation_id="get_transaction_history",
            name="Get Transaction History",
            type=OperationType.READ_ONLY,
            description="Retrieve account transaction history",
            required_entities=["account_type"],
            optional_entities=["date_range", "transaction_type", "limit"],
            business_rules=["account_must_exist", "date_range_valid"],
            risk_level=RiskLevel.LOW,
            auth_level=AuthLevel.BASIC,
            execution_handler=self._execute_transaction_history
        )

        operations["download_statement"] = BankingOperation(
            operation_id="download_statement", 
            name="Download Account Statement",
            type=OperationType.READ_ONLY,
            description="Generate and download account statement",
            required_entities=["account_type", "statement_period"],
            optional_entities=["format"],
            business_rules=["account_must_exist", "statement_period_valid"],
            risk_level=RiskLevel.LOW,
            auth_level=AuthLevel.FULL,
            execution_handler=self._execute_statement_download
        )

        # TRANSFER OPERATIONS  
        operations["internal_transfer"] = BankingOperation(
            operation_id="internal_transfer",
            name="Internal Account Transfer",
            type=OperationType.TRANSACTIONAL,
            description="Transfer funds between own accounts",
            required_entities=["from_account", "to_account", "amount"],
            optional_entities=["memo", "scheduled_date"],
            business_rules=["sufficient_balance", "accounts_exist", "amount_positive"],
            risk_level=RiskLevel.MEDIUM,
            auth_level=AuthLevel.FULL,
            execution_handler=self._execute_internal_transfer,
            confirmation_required=True
        )

        operations["external_transfer"] = BankingOperation(
            operation_id="external_transfer",
            name="External Transfer", 
            type=OperationType.TRANSACTIONAL,
            description="Send money to external bank account",
            required_entities=["recipient", "amount"],
            optional_entities=["from_account", "memo", "recipient_account"],
            business_rules=["sufficient_balance", "recipient_verified", "amount_within_limits"],
            risk_level=RiskLevel.HIGH,
            auth_level=AuthLevel.CHALLENGE,
            execution_handler=self._execute_external_transfer,
            confirmation_required=True
        )

        operations["p2p_payment"] = BankingOperation(
            operation_id="p2p_payment",
            name="P2P Payment",
            type=OperationType.TRANSACTIONAL,
            description="Send money to a friend or contact via P2P payment",
            required_entities=["recipient", "amount"],
            optional_entities=["from_account", "memo"],
            business_rules=["sufficient_balance", "p2p_recipient_enrolled", "p2p_daily_limit"],
            risk_level=RiskLevel.MEDIUM,
            auth_level=AuthLevel.FULL,
            execution_handler=self._execute_p2p_payment,
            confirmation_required=True,
            ui_flow="p2p_payment"
        )

        # BILL PAYMENT OPERATIONS
        operations["pay_bill"] = BankingOperation(
            operation_id="pay_bill",
            name="Pay Bill",
            type=OperationType.TRANSACTIONAL,
            description="Make a bill payment to a payee",
            required_entities=["payee", "amount"],
            optional_entities=["from_account", "due_date", "account_number"],
            business_rules=["sufficient_balance", "payee_valid", "amount_positive"],
            risk_level=RiskLevel.MEDIUM,
            auth_level=AuthLevel.FULL,
            execution_handler=self._execute_bill_payment,
            confirmation_required=True
        )

        operations["schedule_payment"] = BankingOperation(
            operation_id="schedule_payment",
            name="Schedule Recurring Payment",
            type=OperationType.ADMINISTRATIVE,
            description="Set up automated recurring payment",
            required_entities=["payee", "amount", "frequency"],
            optional_entities=["start_date", "end_date", "from_account"],
            business_rules=["payee_valid", "frequency_valid", "future_date"],
            risk_level=RiskLevel.MEDIUM,
            auth_level=AuthLevel.FULL,
            execution_handler=self._execute_schedule_payment,
            confirmation_required=True
        )

        # CARD OPERATIONS
        operations["block_card"] = BankingOperation(
            operation_id="block_card",
            name="Block/Freeze Card",
            type=OperationType.ADMINISTRATIVE,
            description="Temporarily or permanently block a card",
            required_entities=["card_identifier"],
            optional_entities=["block_type", "reason"],
            business_rules=["card_exists", "card_active"],
            risk_level=RiskLevel.HIGH,
            auth_level=AuthLevel.CHALLENGE,
            execution_handler=self._execute_block_card,
            confirmation_required=True
        )

        operations["replace_card"] = BankingOperation(
            operation_id="replace_card",
            name="Replace Lost/Stolen Card",
            type=OperationType.ADMINISTRATIVE,
            description="Request replacement for lost or stolen card",
            required_entities=["card_identifier", "reason"],
            optional_entities=["delivery_address", "rush_delivery"],
            business_rules=["card_exists", "reason_valid"],
            risk_level=RiskLevel.HIGH,
            auth_level=AuthLevel.CHALLENGE,
            execution_handler=self._execute_replace_card
        )

        # DISPUTE OPERATIONS
        operations["dispute_transaction"] = BankingOperation(
            operation_id="dispute_transaction",
            name="Dispute Transaction",
            type=OperationType.ADMINISTRATIVE,
            description="Initiate dispute for unauthorized transaction",
            required_entities=["transaction_id"],
            optional_entities=["dispute_reason", "supporting_documents"],
            business_rules=["transaction_exists", "dispute_timeframe_valid"],
            risk_level=RiskLevel.MEDIUM,
            auth_level=AuthLevel.FULL,
            execution_handler=self._execute_dispute_transaction
        )

        # NAVIGATION OPERATIONS
        operations["navigate_to_section"] = BankingOperation(
            operation_id="navigate_to_section",
            name="Navigate to UI Section",
            type=OperationType.NAVIGATIONAL,
            description="Guide user to specific part of banking interface",
            required_entities=["destination"],
            optional_entities=["context", "help_type"],
            business_rules=["destination_valid"],
            risk_level=RiskLevel.LOW,
            auth_level=AuthLevel.BASIC,
            execution_handler=self._execute_navigation
        )

        return operations

    async def execute_operation(
        self, 
        operation_id: str, 
        entities: Dict[str, Any],
        user_context: Optional[Dict[str, Any]] = None
    ) -> OperationResult:
        """Execute a banking operation"""
        
        operation = self.operations.get(operation_id)
        if not operation:
            return OperationResult(
                status=OperationStatus.FAILED,
                data={},
                message=f"Unknown operation: {operation_id}"
            )

        # Validate required entities
        missing_entities = []
        for entity in operation.required_entities:
            if entity not in entities or not entities[entity]:
                missing_entities.append(entity)

        if missing_entities:
            return OperationResult(
                status=OperationStatus.PENDING,
                data={"missing_entities": missing_entities},
                message=f"Missing required information: {', '.join(missing_entities)}"
            )

        # Execute the operation
        try:
            result = await operation.execution_handler(entities, user_context)
            return result
        except Exception as e:
            return OperationResult(
                status=OperationStatus.FAILED,
                data={"error": str(e)},
                message=f"Operation failed: {str(e)}"
            )

    def get_operation_for_intent(self, intent_id: str) -> Optional[BankingOperation]:
        """Map intent to operation"""
        intent_to_operation = {
            # Account operations
            "accounts.balance.check": "check_balance",
            "accounts.balance.history": "get_transaction_history", 
            "accounts.statement.download": "download_statement",
            "accounts.statement.view": "download_statement",
            "inquiries.transaction.search": "get_transaction_history",

            # Transfer operations
            "payments.transfer.internal": "internal_transfer",
            "payments.transfer.external": "external_transfer",
            "transfers.internal": "internal_transfer",
            "transfers.external": "external_transfer",
            "international.wire.send": "external_transfer",

            # Payment operations
            "payments.bill.pay": "pay_bill",
            "payments.bill.schedule": "schedule_payment",
            "payments.recurring.setup": "schedule_payment",
            "payments.p2p.send": "p2p_payment",

            # Card operations
            "cards.block.temporary": "block_card",
            "cards.replace.lost": "replace_card",

            # Dispute operations
            "disputes.transaction.initiate": "dispute_transaction",

            # Navigation
            "system.navigation": "navigate_to_section",
        }

        operation_id = intent_to_operation.get(intent_id)
        return self.operations.get(operation_id) if operation_id else None

    # EXECUTION HANDLERS

    async def _execute_balance_check(
        self, entities: Dict[str, Any], user_context: Optional[Dict[str, Any]] = None
    ) -> OperationResult:
        """Execute balance check operation"""
        account_type = entities.get("account_type", "checking")
        
        # Get account details first to get the account_id
        account = await self.banking.get_account_by_type(account_type)
        if not account:
            return OperationResult(
                status=OperationStatus.FAILED,
                data={},
                message=f"No {account_type} account found"
            )
        
        # Get balance using account_id
        balance = await self.banking.get_balance(account["id"])
        
        return OperationResult(
            status=OperationStatus.COMPLETED,
            data={
                "balance": balance,
                "account": account,
                "currency": "USD"
            },
            message=f"Your {account_type} account balance is ${balance:,.2f}",
            ui_hints={
                "display_mode": "balance_card",
                "highlight": "balance_amount",
                "suggested_actions": ["transfer", "pay_bill", "view_history"]
            }
        )

    async def _execute_transaction_history(
        self, entities: Dict[str, Any], user_context: Optional[Dict[str, Any]] = None
    ) -> OperationResult:
        """Execute transaction history retrieval"""
        account_type = entities.get("account_type", "checking")
        limit = entities.get("limit", 10)
        
        transactions = await self.banking.get_transaction_history(account_type, limit)
        
        return OperationResult(
            status=OperationStatus.COMPLETED,
            data={
                "transactions": transactions,
                "account_type": account_type,
                "count": len(transactions)
            },
            message=f"Here are your recent {account_type} transactions",
            ui_hints={
                "display_mode": "transaction_list",
                "grouping": "by_date"
            }
        )

    async def _execute_internal_transfer(
        self, entities: Dict[str, Any], user_context: Optional[Dict[str, Any]] = None
    ) -> OperationResult:
        """Execute internal transfer"""
        from_account = entities.get("from_account")
        to_account = entities.get("to_account") 
        amount = entities.get("amount")

        result = await self.banking.transfer_funds(from_account, to_account, amount)
        
        if result.get("success"):
            return OperationResult(
                status=OperationStatus.COMPLETED,
                data=result,
                message=f"Successfully transferred ${amount:,.2f} from {from_account} to {to_account}",
                reference_id=result.get("transaction_id"),
                ui_hints={"display_mode": "confirmation", "show_receipt": True}
            )
        else:
            return OperationResult(
                status=OperationStatus.FAILED,
                data=result,
                message=result.get("error", "Transfer failed")
            )

    async def _execute_external_transfer(
        self, entities: Dict[str, Any], user_context: Optional[Dict[str, Any]] = None
    ) -> OperationResult:
        """Execute external transfer/international wire transfer"""
        recipient_name = entities.get("recipient")
        recipient_id = entities.get("recipient_id", recipient_name)  # Fallback to name if ID not available
        amount = entities.get("amount")
        from_account = entities.get("from_account", "CHK001")  # Default to primary checking account

        # Determine transfer type based on recipient country
        transfer_type = "external"  # Default
        if user_context and user_context.get("intent") == "international.wire.send":
            transfer_type = "international"
        
        # Use recipient_id for the banking operation
        result = await self.banking.send_payment(recipient_id, amount, from_account, transfer_type)
        
        if result.get("success"):
            transfer_label = "international wire transfer" if transfer_type == "international" else "transfer"
            return OperationResult(
                status=OperationStatus.COMPLETED,
                data=result,
                message=f"Successfully sent ${amount:,.2f} {transfer_label} to {recipient_name}",
                reference_id=result.get("payment_id"),
                ui_hints={"display_mode": "confirmation", "show_receipt": True}
            )
        else:
            return OperationResult(
                status=OperationStatus.FAILED,
                data=result,
                message=result.get("error", "Payment failed")
            )

    async def _execute_p2p_payment(
        self, entities: Dict[str, Any], user_context: Optional[Dict[str, Any]] = None
    ) -> OperationResult:
        """Execute P2P payment to friend/contact"""
        recipient_name = entities.get("recipient")
        recipient_id = entities.get("recipient_id", recipient_name)  # Fallback to name if ID not available
        amount = entities.get("amount")
        from_account = entities.get("from_account", "CHK001")  # Default to primary checking account
        memo = entities.get("memo", "")

        # Use recipient_id for the banking operation
        result = await self.banking.send_payment(recipient_id, amount, from_account, "p2p")
        
        if result.get("success"):
            return OperationResult(
                status=OperationStatus.COMPLETED,
                data=result,
                message=f"Successfully sent ${amount:,.2f} to {recipient_name}" + (f" for {memo}" if memo else ""),
                reference_id=result.get("payment_id"),
                ui_hints={
                    "display_mode": "p2p_confirmation", 
                    "show_receipt": True,
                    "payment_type": "p2p",
                    "recipient_type": "contact"
                },
                next_steps=[
                    f"Payment sent to {recipient_name}",
                    "Receipt saved to transaction history",
                    "Recipient will be notified"
                ]
            )
        else:
            return OperationResult(
                status=OperationStatus.FAILED,
                data=result,
                message=result.get("error", f"P2P payment to {recipient_name} failed"),
                next_steps=[
                    "Check your account balance",
                    "Verify recipient information",
                    "Try again or contact support"
                ]
            )

    async def _execute_bill_payment(
        self, entities: Dict[str, Any], user_context: Optional[Dict[str, Any]] = None
    ) -> OperationResult:
        """Execute bill payment"""
        payee = entities.get("payee")
        amount = entities.get("amount")
        from_account = entities.get("from_account", "CHK001")  # Default to primary checking account

        # Use send_payment for bill payments (same underlying mechanism)
        result = await self.banking.send_payment(payee, amount, from_account)
        
        if result.get("success"):
            return OperationResult(
                status=OperationStatus.COMPLETED,
                data=result,
                message=f"Bill payment of ${amount:,.2f} to {payee} completed",
                reference_id=result.get("payment_id"),
                ui_hints={"display_mode": "confirmation", "payment_type": "bill"}
            )
        else:
            return OperationResult(
                status=OperationStatus.FAILED,
                data=result,
                message=result.get("error", "Bill payment failed")
            )

    async def _execute_block_card(
        self, entities: Dict[str, Any], user_context: Optional[Dict[str, Any]] = None
    ) -> OperationResult:
        """Execute card blocking"""
        card_id = entities.get("card_identifier", "default")
        block_type = entities.get("block_type", "temporary")
        
        result = await self.banking.block_card(card_id, temporary=(block_type == "temporary"))
        
        if result.get("success"):
            return OperationResult(
                status=OperationStatus.COMPLETED,
                data=result,
                message=f"Card {card_id} has been {block_type}ly blocked",
                ui_hints={"display_mode": "confirmation", "next_steps": ["replace_card", "contact_support"]}
            )
        else:
            return OperationResult(
                status=OperationStatus.FAILED,
                data=result,
                message=result.get("error", "Card blocking failed")
            )

    async def _execute_replace_card(
        self, entities: Dict[str, Any], user_context: Optional[Dict[str, Any]] = None
    ) -> OperationResult:
        """Execute card replacement"""
        card_id = entities.get("card_identifier", "default")
        reason = entities.get("reason", "lost")
        
        # Mock card replacement
        reference_id = f"CARD-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        return OperationResult(
            status=OperationStatus.COMPLETED,
            data={
                "replacement_reference": reference_id,
                "delivery_estimate": "3-5 business days",
                "card_id": card_id
            },
            message=f"Replacement card ordered for {reason} card. Reference: {reference_id}",
            reference_id=reference_id,
            ui_hints={"display_mode": "confirmation", "track_delivery": True}
        )

    async def _execute_dispute_transaction(
        self, entities: Dict[str, Any], user_context: Optional[Dict[str, Any]] = None
    ) -> OperationResult:
        """Execute transaction dispute"""
        transaction_id = entities.get("transaction_id")
        reason = entities.get("dispute_reason", "unauthorized")
        
        result = await self.banking.dispute_transaction(transaction_id)
        
        if result.get("success"):
            return OperationResult(
                status=OperationStatus.COMPLETED,
                data=result,
                message=f"Dispute initiated for transaction {transaction_id}",
                reference_id=result.get("dispute_id"),
                ui_hints={"display_mode": "confirmation", "follow_up_required": True}
            )
        else:
            return OperationResult(
                status=OperationStatus.FAILED,
                data=result,
                message=result.get("error", "Dispute initiation failed")
            )

    async def _execute_statement_download(
        self, entities: Dict[str, Any], user_context: Optional[Dict[str, Any]] = None
    ) -> OperationResult:
        """Execute statement download"""
        account_type = entities.get("account_type", "checking")
        period = entities.get("statement_period", "current_month")
        format_type = entities.get("format", "pdf")
        
        # Mock statement generation
        statement_id = f"STMT-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        return OperationResult(
            status=OperationStatus.COMPLETED,
            data={
                "statement_id": statement_id,
                "account_type": account_type,
                "period": period,
                "format": format_type,
                "download_url": f"/statements/{statement_id}.{format_type}"
            },
            message=f"Statement for {account_type} account ({period}) is ready for download",
            ui_hints={"display_mode": "download", "auto_download": True}
        )

    async def _execute_schedule_payment(
        self, entities: Dict[str, Any], user_context: Optional[Dict[str, Any]] = None
    ) -> OperationResult:
        """Execute payment scheduling"""
        payee = entities.get("payee")
        amount = entities.get("amount")
        frequency = entities.get("frequency")
        start_date = entities.get("start_date", datetime.now().strftime('%Y-%m-%d'))
        
        # Mock scheduling
        schedule_id = f"SCHED-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        return OperationResult(
            status=OperationStatus.COMPLETED,
            data={
                "schedule_id": schedule_id,
                "payee": payee,
                "amount": amount,
                "frequency": frequency,
                "start_date": start_date,
                "next_payment": start_date
            },
            message=f"Recurring payment scheduled: ${amount:,.2f} to {payee} {frequency}",
            reference_id=schedule_id,
            ui_hints={"display_mode": "confirmation", "manage_schedules": True}
        )

    async def _execute_navigation(
        self, entities: Dict[str, Any], user_context: Optional[Dict[str, Any]] = None
    ) -> OperationResult:
        """Execute UI navigation"""
        destination = entities.get("destination")
        
        # Map common navigation destinations
        nav_mapping = {
            "transfers": {"route": "/transfers", "section": "transfers"},
            "bill pay": {"route": "/bills", "section": "bill_pay"},
            "account settings": {"route": "/settings", "section": "account_settings"},
            "transaction history": {"route": "/history", "section": "transactions"},
            "statements": {"route": "/statements", "section": "statements"},
            "cards": {"route": "/cards", "section": "card_management"},
            "help": {"route": "/help", "section": "support"}
        }
        
        nav_info = nav_mapping.get(destination.lower(), {
            "route": f"/{destination.lower().replace(' ', '-')}",
            "section": destination.lower().replace(' ', '_')
        })
        
        return OperationResult(
            status=OperationStatus.COMPLETED,
            data={
                "destination": destination,
                "route": nav_info["route"],
                "section": nav_info["section"]
            },
            message=f"Navigating to {destination}",
            ui_hints={
                "display_mode": "navigation",
                "route": nav_info["route"],
                "highlight_section": nav_info["section"]
            }
        ) 