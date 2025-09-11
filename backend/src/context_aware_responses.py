"""Context-Aware Response Generator with precondition checks and authentication handling
Inspired by banking domain requirements
"""

from dataclasses import dataclass
from datetime import datetime, time
from enum import Enum
from typing import Any, Optional

from .intent_catalog import AuthLevel, RiskLevel


class ResponseType(Enum):
    """Types of responses"""

    SUCCESS = "success"
    CONFIRMATION_NEEDED = "confirmation_needed"
    AUTH_REQUIRED = "auth_required"
    MISSING_INFO = "missing_info"
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class PreconditionStatus(Enum):
    """Status of precondition checks"""

    PASSED = "passed"
    FAILED = "failed"
    PENDING = "pending"
    NOT_APPLICABLE = "not_applicable"


@dataclass
class PreconditionCheck:
    """Represents a precondition check"""

    name: str
    status: PreconditionStatus
    message: Optional[str] = None
    action_required: Optional[str] = None


@dataclass
class ContextualResponse:
    """Structured response with context awareness"""

    response_type: ResponseType
    message: str
    data: dict[str, Any]
    preconditions: list[PreconditionCheck]
    next_steps: list[str]
    auth_challenge: Optional[dict[str, Any]] = None
    follow_up_questions: list[str] = None
    risk_warning: Optional[str] = None
    estimated_completion_time: Optional[int] = None  # in seconds


class ContextAwareResponseGenerator:
    """Generate context-aware responses based on intent, entities, and business rules"""

    def __init__(self):
        self.business_rules = self._initialize_business_rules()
        self.response_templates = self._initialize_templates()

    def _initialize_business_rules(self) -> dict[str, Any]:
        """Initialize business rules for precondition checks"""
        return {
            "balance_check": {
                "description": "Check if account has sufficient balance",
                "required_for": ["transfer", "payment", "withdrawal"],
                "error_message": "Insufficient funds for this transaction",
            },
            "limit_check": {
                "description": "Check transaction limits",
                "daily_limit": 10000,
                "per_transaction_limit": 5000,
                "error_message": "Transaction exceeds limit",
            },
            "fraud_check": {
                "description": "Fraud detection check",
                "high_risk_amount": 2500,
                "error_message": "Transaction flagged for review",
            },
            "hours_check": {
                "description": "Business hours check",
                "start_time": time(8, 0),
                "end_time": time(20, 0),
                "error_message": "Service available 8 AM - 8 PM EST",
            },
            "account_exists": {
                "description": "Verify account exists",
                "error_message": "Account not found",
            },
            "recipient_enrolled": {
                "description": "Check if recipient is enrolled",
                "error_message": "Recipient must be enrolled to receive payments",
            },
            "within_dispute_window": {
                "description": "Check if transaction is within dispute window",
                "window_days": 60,
                "error_message": "Transaction is outside the dispute window",
            },
        }

    def _initialize_templates(self) -> dict[str, str]:
        """Initialize response message templates"""
        return {
            # Success templates
            "balance_check_success": "Your {account_type} account balance is ${balance:,.2f}",
            "transfer_initiated": "Transfer of ${amount:,.2f} to {recipient} has been initiated. Estimated completion: {completion_time}",
            "card_blocked": "Your {card_type} card ending in {last4} has been temporarily blocked",
            # Confirmation templates
            "transfer_confirmation": "Please confirm: Transfer ${amount:,.2f} from {from_account} to {to_account}?",
            "high_risk_confirmation": "⚠️ This is a high-risk transaction. Please confirm with additional authentication.",
            # Error templates
            "insufficient_funds": "Unable to complete transfer. Your available balance is ${available:,.2f}, but ${amount:,.2f} is required.",
            "missing_required_info": "To proceed, I need the following information: {missing_fields}",
            "authentication_required": "This operation requires {auth_level} authentication. Please {auth_action}.",
            # Info templates
            "precondition_pending": "Checking: {checks}. This may take a moment.",
            "multi_step_process": "This will be completed in {num_steps} steps. Starting with: {first_step}",
        }

    async def generate_response(
        self,
        intent: dict[str, Any],
        entities: dict[str, Any],
        context: Optional[dict[str, Any]] = None,
        user_profile: Optional[dict[str, Any]] = None,
    ) -> ContextualResponse:
        """Generate a context-aware response based on intent and entities

        Args:
        ----
            intent: Intent classification result
            entities: Extracted entities result
            context: Conversation context
            user_profile: User authentication and profile info

        Returns:
        -------
            ContextualResponse with appropriate message and metadata
        """
        # Extract key information
        intent.get("intent_id", "unknown")
        risk_level = RiskLevel(intent.get("risk_level", "low"))
        auth_required = AuthLevel(intent.get("auth_required", "none"))
        confidence = intent.get("confidence", 0.0)

        # Check preconditions
        precondition_results = await self._check_preconditions(
            intent, entities.get("entities", {}), user_profile
        )

        # Check authentication
        auth_check = self._check_authentication(auth_required, user_profile)

        # Handle missing required entities
        if entities.get("missing_required"):
            return self._handle_missing_info(intent, entities, precondition_results)

        # IMPORTANT: Medium+ risk operations require user confirmation before execution
        # This check comes BEFORE auth to show users what they're confirming
        if self._requires_confirmation(intent):
            return self._handle_transfer_confirmation(
                intent, entities, precondition_results, confidence
            )

        # Handle authentication requirements
        if not auth_check["passed"]:
            return self._handle_auth_required(intent, auth_check, precondition_results)

        # Handle failed preconditions
        failed_preconditions = [
            p for p in precondition_results if p.status == PreconditionStatus.FAILED
        ]
        if failed_preconditions:
            return self._handle_failed_preconditions(
                intent, entities, failed_preconditions
            )

        # Handle high-risk operations
        if risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
            return self._handle_high_risk_operation(
                intent, entities, precondition_results, confidence
            )

        # Generate successful response
        return self._generate_success_response(intent, entities, precondition_results)

    async def _check_preconditions(
        self,
        intent: dict[str, Any],
        entities: dict[str, Any],
        user_profile: Optional[dict[str, Any]],
    ) -> list[PreconditionCheck]:
        """Check all preconditions for the intent"""
        preconditions = intent.get("preconditions", [])
        results = []

        for precondition_name in preconditions:
            check = await self._evaluate_precondition(
                precondition_name, entities, user_profile
            )
            results.append(check)

        return results

    async def _evaluate_precondition(
        self,
        precondition_name: str,
        entities: dict[str, Any],
        user_profile: Optional[dict[str, Any]],
    ) -> PreconditionCheck:
        """Evaluate a single precondition"""
        rule = self.business_rules.get(precondition_name, {})

        # Simulate precondition checks
        if precondition_name == "balance_check":
            amount = entities.get("amount", {}).get("value", 0)
            available_balance = (
                user_profile.get("available_balance", 10000) if user_profile else 10000
            )

            if amount > available_balance:
                return PreconditionCheck(
                    name=precondition_name,
                    status=PreconditionStatus.FAILED,
                    message=f"Insufficient funds. Available: ${available_balance:,.2f}",
                    action_required="Add funds or reduce amount",
                )
            else:
                return PreconditionCheck(
                    name=precondition_name,
                    status=PreconditionStatus.PASSED,
                    message="Sufficient funds available",
                )

        elif precondition_name == "limit_check":
            amount = entities.get("amount", {}).get("value", 0)
            daily_limit = rule.get("daily_limit", 10000)

            if amount > daily_limit:
                return PreconditionCheck(
                    name=precondition_name,
                    status=PreconditionStatus.FAILED,
                    message=f"Exceeds daily limit of ${daily_limit:,.2f}",
                    action_required="Contact support to increase limit",
                )
            else:
                return PreconditionCheck(
                    name=precondition_name, status=PreconditionStatus.PASSED
                )

        elif precondition_name == "fraud_check":
            amount = entities.get("amount", {}).get("value", 0)
            high_risk_amount = rule.get("high_risk_amount", 2500)

            if amount > high_risk_amount:
                return PreconditionCheck(
                    name=precondition_name,
                    status=PreconditionStatus.PENDING,
                    message="Additional verification required for large transfer",
                    action_required="Complete identity verification",
                )
            else:
                return PreconditionCheck(
                    name=precondition_name, status=PreconditionStatus.PASSED
                )

        elif precondition_name == "hours_check":
            current_time = datetime.now().time()
            start_time = rule.get("start_time", time(8, 0))
            end_time = rule.get("end_time", time(20, 0))

            if start_time <= current_time <= end_time:
                return PreconditionCheck(
                    name=precondition_name, status=PreconditionStatus.PASSED
                )
            else:
                return PreconditionCheck(
                    name=precondition_name,
                    status=PreconditionStatus.FAILED,
                    message=rule.get("error_message"),
                    action_required="Try again during business hours",
                )

        # Default: assume precondition passes
        return PreconditionCheck(
            name=precondition_name, status=PreconditionStatus.PASSED
        )

    def _check_authentication(
        self, required_auth: AuthLevel, user_profile: Optional[dict[str, Any]]
    ) -> dict[str, Any]:
        """Check if user has required authentication level"""
        if required_auth == AuthLevel.NONE:
            return {"passed": True}

        if not user_profile:
            return {
                "passed": False,
                "required_level": required_auth.value,
                "message": "Please log in to continue",
            }

        user_auth_level = AuthLevel(user_profile.get("auth_level", "none"))

        # Define auth level hierarchy
        auth_hierarchy = {
            AuthLevel.NONE: 0,
            AuthLevel.BASIC: 1,
            AuthLevel.FULL: 2,
            AuthLevel.CHALLENGE: 3,
        }

        if auth_hierarchy[user_auth_level] >= auth_hierarchy[required_auth]:
            return {"passed": True}
        else:
            auth_actions = {
                AuthLevel.BASIC: "log in",
                AuthLevel.FULL: "complete full authentication",
                AuthLevel.CHALLENGE: "complete security challenge",
            }

            return {
                "passed": False,
                "required_level": required_auth.value,
                "current_level": user_auth_level.value,
                "message": f"Please {auth_actions.get(required_auth, 'authenticate')}",
            }

    def _handle_missing_info(
        self,
        intent: dict[str, Any],
        entities: dict[str, Any],
        preconditions: list[PreconditionCheck],
    ) -> ContextualResponse:
        """Handle response when required information is missing"""
        missing_fields = entities.get("missing_required", [])
        suggestions = entities.get("suggestions", [])

        # Create friendly field names
        field_names = {
            "amount": "transfer amount",
            "recipient": "recipient's name",
            "account_id": "account",
            "account_type": "account type (checking/savings)",
            "date": "date",
            "reason": "reason for this request",
        }

        missing_text = ", ".join(
            [field_names.get(f, f.replace("_", " ")) for f in missing_fields]
        )

        message = self.response_templates["missing_required_info"].format(
            missing_fields=missing_text
        )

        return ContextualResponse(
            response_type=ResponseType.MISSING_INFO,
            message=message,
            data={
                "intent": intent.get("intent_id"),
                "missing_fields": missing_fields,
                "provided_entities": entities.get("entities", {}),
            },
            preconditions=preconditions,
            next_steps=["Provide missing information"],
            follow_up_questions=suggestions,
        )

    def _handle_auth_required(
        self,
        intent: dict[str, Any],
        auth_check: dict[str, Any],
        preconditions: list[PreconditionCheck],
    ) -> ContextualResponse:
        """Handle response when authentication is required"""
        auth_level = auth_check.get("required_level", "full")

        auth_methods = {
            "basic": ["username and password"],
            "full": ["username, password, and 2FA code"],
            "challenge": ["security questions", "biometric verification"],
        }

        message = self.response_templates["authentication_required"].format(
            auth_level=auth_level, auth_action=auth_check.get("message", "authenticate")
        )

        auth_challenge = {
            "required_level": auth_level,
            "methods": auth_methods.get(auth_level, []),
            "timeout": 300,  # 5 minutes
        }

        return ContextualResponse(
            response_type=ResponseType.AUTH_REQUIRED,
            message=message,
            data={"intent": intent.get("intent_id")},
            preconditions=preconditions,
            next_steps=["Complete authentication", "Retry operation"],
            auth_challenge=auth_challenge,
        )

    def _handle_failed_preconditions(
        self,
        intent: dict[str, Any],
        entities: dict[str, Any],
        failed_preconditions: list[PreconditionCheck],
    ) -> ContextualResponse:
        """Handle response when preconditions fail"""
        # Get the most critical failure
        first_failure = failed_preconditions[0]

        message = first_failure.message or "Unable to proceed with this operation"

        # Add specific guidance based on failure type
        if first_failure.name == "balance_check":
            amount = entities.get("entities", {}).get("amount", {}).get("value", 0)
            message = self.response_templates["insufficient_funds"].format(
                available=10000,  # Would come from user profile
                amount=amount,
            )

        return ContextualResponse(
            response_type=ResponseType.ERROR,
            message=message,
            data={
                "intent": intent.get("intent_id"),
                "failed_checks": [p.name for p in failed_preconditions],
            },
            preconditions=failed_preconditions,
            next_steps=[
                p.action_required for p in failed_preconditions if p.action_required
            ],
        )

    def _handle_high_risk_operation(
        self,
        intent: dict[str, Any],
        entities: dict[str, Any],
        preconditions: list[PreconditionCheck],
        confidence: float,
    ) -> ContextualResponse:
        """Handle high-risk operations with additional confirmation"""
        # Build confirmation message with all details
        entity_values = entities.get("entities", {})

        confirmation_details = []
        if "amount" in entity_values:
            confirmation_details.append(
                f"Amount: ${entity_values['amount']['value']:,.2f}"
            )
        if "recipient" in entity_values:
            confirmation_details.append(
                f"Recipient: {entity_values['recipient']['value']}"
            )

        message = "⚠️ High-risk operation detected.\n"
        message += "\n".join(confirmation_details)
        message += "\n\nPlease review carefully and confirm to proceed."

        risk_warning = (
            f"This {intent.get('name', 'operation')} has been flagged as high-risk. "
            "Additional verification may be required."
        )

        return ContextualResponse(
            response_type=ResponseType.CONFIRMATION_NEEDED,
            message=message,
            data={
                "intent": intent.get("intent_id"),
                "risk_level": intent.get("risk_level"),
                "confidence": confidence,
                "processed_entities": entity_values,
            },
            preconditions=preconditions,
            next_steps=[
                "Review transaction details",
                "Confirm or cancel operation",
                "Complete additional verification if prompted",
            ],
            risk_warning=risk_warning,
        )

    def _generate_success_response(
        self,
        intent: dict[str, Any],
        entities: dict[str, Any],
        preconditions: list[PreconditionCheck],
    ) -> ContextualResponse:
        """Generate a successful response"""
        intent_id = intent.get("intent_id", "")
        entity_values = entities.get("entities", {})

        # Select appropriate template based on intent
        if "balance" in intent_id:
            message = self.response_templates["balance_check_success"].format(
                account_type=entity_values.get("account_type", {}).get(
                    "value", "checking"
                ),
                balance=10000.00,  # Would come from actual backend
            )

        elif "transfer" in intent_id:
            amount = entity_values.get("amount", {}).get("value", 0)
            recipient = entity_values.get("recipient", {}).get("value", "recipient")

            message = self.response_templates["transfer_initiated"].format(
                amount=amount, recipient=recipient, completion_time="2-3 business days"
            )

        elif "card" in intent_id and "block" in intent_id:
            message = self.response_templates["card_blocked"].format(
                card_type=entity_values.get("card_type", {}).get("value", "debit"),
                last4="1234",  # Would come from actual data
            )

        else:
            message = f"Successfully processed your {intent.get('name', 'request')}"

        # Estimate completion time based on intent
        completion_times = {
            "accounts.balance.check": 1,
            "payments.transfer.internal": 5,
            "payments.transfer.external": 86400,  # 1 day
            "cards.block.temporary": 2,
        }

        return ContextualResponse(
            response_type=ResponseType.SUCCESS,
            message=message,
            data={
                "intent": intent_id,
                "processed_entities": entity_values,
                "confidence": intent.get("confidence", 0),
            },
            preconditions=preconditions,
            next_steps=self._get_next_steps(intent_id),
            estimated_completion_time=completion_times.get(intent_id, 10),
        )

    def _get_next_steps(self, intent_id: str) -> list[str]:
        """Get suggested next steps based on intent"""
        next_steps_map = {
            "accounts.balance.check": [
                "View transaction history",
                "Set up balance alerts",
            ],
            "payments.transfer": [
                "Save recipient for future transfers",
                "Set up recurring transfer",
            ],
            "cards.block": ["Order replacement card", "Review recent transactions"],
            "disputes.transaction": [
                "Upload supporting documents",
                "Monitor dispute status",
            ],
        }

        # Find matching next steps
        for key, steps in next_steps_map.items():
            if key in intent_id:
                return steps

        return ["Return to main menu", "Ask another question"]

    def _requires_confirmation(self, intent: dict[str, Any]) -> bool:
        """Check if an intent requires confirmation based on risk level (OCP compliant)"""
        risk_level = RiskLevel(intent.get("risk_level", "low"))
        # All MEDIUM and above risk operations require confirmation
        return risk_level in [RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL]

    def _handle_transfer_confirmation(
        self,
        intent: dict[str, Any],
        entities: dict[str, Any],
        preconditions: list[PreconditionCheck],
        confidence: float,
    ) -> ContextualResponse:
        """Handle confirmation for medium+ risk operations - dynamically processes entities"""
        entity_values = entities.get("entities", {})
        intent_id = intent.get("intent_id", "")
        intent_name = intent.get("name", "Operation")

        # Get required and optional entities from intent
        required_entities = intent.get("required_entities", [])
        optional_entities = intent.get("optional_entities", [])

        # Build detailed confirmation message dynamically
        confirmation_details = []
        
        # Get all relevant entity names for context
        all_relevant_entities = set(required_entities + optional_entities)
        
        # Process required entities first
        for entity_name in required_entities:
            if entity_name in entity_values:
                detail = self._format_entity_for_confirmation(entity_name, entity_values[entity_name], all_relevant_entities)
                if detail:
                    confirmation_details.append(detail)
        
        # Then process optional entities
        for entity_name in optional_entities:
            if entity_name in entity_values:
                detail = self._format_entity_for_confirmation(entity_name, entity_values[entity_name], all_relevant_entities)
                if detail:
                    confirmation_details.append(detail)

        # Create confirmation message
        message = f"Confirmation Required for {intent_name} \n\n"
        if confirmation_details:
            message += "\n".join(confirmation_details)
        else:
            message += "Please review the operation details\n\n"
        message += "\n\nPlease review the details carefully and confirm to proceed."

        return ContextualResponse(
            response_type=ResponseType.CONFIRMATION_NEEDED,
            message=message,
            data={
                "intent": intent_id,
                "operation_type": intent.get("subcategory", "Operation"),
                "confidence": confidence,
                "processed_entities": entity_values,
                "requires_confirmation": True
            },
            preconditions=preconditions,
            next_steps=[
                "Review the operation details above",
                "Confirm to proceed or cancel to abort"
            ],
            auth_challenge=None,
            risk_warning="Medium+ risk operations require confirmation for security",
            follow_up_questions=[],
            estimated_completion_time=None
        )

    def _format_entity_for_confirmation(self, entity_name: str, entity_data: dict[str, Any], relevant_entities: set[str]) -> str:
        """Format an entity for confirmation display using generic, data-driven approach"""
        if not entity_data:
            return ""
        
        # Get the best available value: enriched first, then raw value
        display_value = self._extract_display_value(entity_data)
        if not display_value:
            return ""
        
        formatted_value = self._format_value(display_value, entity_data)
        formatted_name = self._format_entity_name(entity_name)
        
        # Handle enriched entities with additional context
        additional_context = self._extract_additional_context(entity_data, relevant_entities)
        
        base_line = f"- {formatted_name}: {formatted_value}\n"
        
        if additional_context:
            return f"{base_line}{additional_context}"
        else:
            return base_line
    
    def _extract_display_value(self, entity_data: dict[str, Any]) -> Any:
        """Extract the best display value from entity data"""
        enriched = entity_data.get("enriched_entity", {})
        
        # Try enriched entity display fields first
        for field in ["display_name", "name", "label"]:
            if enriched.get(field):
                return enriched[field]
        
        # Fall back to raw value
        return entity_data.get("value")
    
    def _format_value(self, value: Any, entity_data: dict[str, Any]) -> str:
        """Format value based on its type and context"""
        if value is None:
            return "Not specified"
        
        # Check if it's a numeric amount (look for common amount indicators)
        if isinstance(value, (int, float)):
            # If it seems like money, format as currency
            if value > 0 and value < 1000000:  # Reasonable money range
                return f"${value:,.2f}"
            else:
                return f"{value:,}"
        
        # Format strings
        if isinstance(value, str):
            # If it looks like an account number, mask it partially
            if len(value) > 6 and value.replace('-', '').replace(' ', '').isdigit():
                return f"...{value[-4:]}"
            return value
        
        return str(value)
    
    def _format_entity_name(self, entity_name: str) -> str:
        """Format entity name for display"""
        return entity_name.replace('_', ' ').title()
    
    def _extract_additional_context(self, entity_data: dict[str, Any], relevant_entities: set[str]) -> str:
        """Extract additional context from enriched entity data based on intent entities"""
        enriched = entity_data.get("enriched_entity", {})
        if not enriched:
            return ""
        
        context_lines = []
        
        # Process any enriched fields that have values and are relevant to the intent
        for field_name, value in enriched.items():
            if value and field_name in relevant_entities:
                formatted_value = self._format_value(value, entity_data)
                formatted_field_name = self._format_entity_name(field_name)
                context_lines.append(f"- {formatted_field_name}: {formatted_value}")
        
        return "\n".join(context_lines)

    def generate_error_response(
        self,
        error_type: str,
        error_message: str,
        intent: Optional[dict[str, Any]] = None,
    ) -> ContextualResponse:
        """Generate an error response"""
        return ContextualResponse(
            response_type=ResponseType.ERROR,
            message=error_message,
            data={
                "error_type": error_type,
                "intent": intent.get("intent_id") if intent else None,
            },
            preconditions=[],
            next_steps=["Try again", "Contact support for assistance"],
        )
