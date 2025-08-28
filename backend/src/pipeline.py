"""Enhanced Pipeline integrating new classifiers with existing multi-turn support
Combines enhanced intent classification, entity extraction, and context-aware responses
"""

import re
from datetime import datetime
from typing import Any, Optional

from .context_aware_responses import ContextAwareResponseGenerator, ResponseType
from .entity_extractor import EntityExtractor
from .intent_catalog import AuthLevel, RiskLevel
from .intent_classifier import IntentClassifier
from .mock_banking import MockBankingService
from .state_manager import ConversationStateManager
from .validator import EntityValidator
from .banking_operations import BankingOperationsCatalog, OperationStatus
from .ui_screen_catalog import ui_screen_catalog, ScreenType


class IntentPipeline:
    """Enhanced NLP pipeline with banking domain knowledge"""

    def __init__(
        self,
        classifier: IntentClassifier,
        extractor: EntityExtractor,
        response_generator: ContextAwareResponseGenerator,
        state_manager: ConversationStateManager,
        banking_service: MockBankingService,
        legacy_validator: Optional[EntityValidator] = None,
    ):
        self.classifier = classifier
        self.extractor = extractor
        self.response_gen = response_generator
        self.state = state_manager
        self.banking = banking_service
        self.legacy_validator = legacy_validator
        self.operations_catalog = BankingOperationsCatalog(banking_service)

    async def process(
        self,
        query: str,
        session_id: str,
        user_profile: Optional[dict[str, Any]] = None,
        skip_resolution: bool = False,
        ui_context: Optional[str] = None,
    ) -> dict[str, Any]:
        """Enhanced pipeline processing with multi-turn support

        Returns comprehensive response including:
        - Intent classification with confidence and risk
        - Entity extraction with validation
        - Context-aware response with preconditions
        - Multi-turn conversation state
        """
        start_time = datetime.now()

        try:
            # Get conversation context
            context = await self.state.get_context(session_id)

            # Check for pending clarification (missing entities from previous turn)
            pending_clarification = await self.state.get_pending_clarification(
                session_id
            )
            if pending_clarification:
                return await self._handle_clarification_response(
                    session_id, query, pending_clarification, user_profile
                )

            # Check for pending approval (high-risk operations)
            pending_approval = await self.state.get_pending_approval(session_id)
            if pending_approval and pending_approval.get("awaiting_approval"):
                if await self._is_approval_response(query):
                    return await self._handle_approval_confirmation(
                        session_id, query, pending_approval, user_profile
                    )

            # Resolve references in query (pronouns, "same amount", etc.)
            if skip_resolution:
                resolved_query = query
            else:
                resolved_query = await self.state.resolve_references(query, context)

            # Enhanced intent classification with risk assessment
            classification = await self.classifier.classify(
                resolved_query, context, include_risk=True
            )

            # Smart entity extraction with validation
            required_entities = classification.get("required_entities", [])
            entities = await self.extractor.extract(
                resolved_query,
                classification.get("intent_id"),
                required_entities,
                context,
            )

            # Generate context-aware response
            response = await self.response_gen.generate_response(
                classification, entities, context, user_profile
            )

            # Handle different response types
            result = await self._process_response_type(
                response,
                classification,
                entities,
                session_id,
                query,
                resolved_query,
                user_profile,
            )

            # Update conversation state
            await self._update_conversation_state(
                session_id, query, resolved_query, classification, entities, response
            )

            # Add timing information
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            result["processing_time_ms"] = int(processing_time)

            return result

        except Exception as e:
            print(f"Pipeline error: {e}")
            return self._create_error_response(str(e))

    async def _handle_clarification_response(
        self,
        session_id: str,
        query: str,
        pending_clarification: dict[str, Any],
        user_profile: Optional[dict[str, Any]],
    ) -> dict[str, Any]:
        """Handle response to a clarification request"""
        # Extract entities from clarification response
        original_intent = pending_clarification.get("original_intent", {})
        missing_entities = pending_clarification.get("missing_entities", [])

        # Try to extract the missing entities from the response
        clarification_entities = await self.extractor.extract(
            query, original_intent.get("intent_id"), missing_entities
        )

        # Check if we got the missing information
        still_missing = clarification_entities.get("missing_required", [])

        if not still_missing:
            # We have all required information, proceed with original intent
            merged_entities = self._merge_entity_sets(
                pending_clarification.get("original_entities", {}),
                clarification_entities,
            )

            # Generate response with complete information
            response = await self.response_gen.generate_response(
                original_intent,
                {"entities": merged_entities, "missing_required": []},
                await self.state.get_context(session_id),
                user_profile,
            )

            # Clear pending clarification
            await self.state.clear_pending_clarification(session_id)

            return self._format_response(response, original_intent, merged_entities)

        else:
            # Still missing information, provide helpful guidance
            return {
                "status": "clarification_needed",
                "intent": original_intent.get("intent_id"),
                "message": f"I still need: {', '.join(still_missing)}",
                "suggestions": clarification_entities.get("suggestions", []),
                "provided_entities": clarification_entities.get("entities", {}),
            }

    async def _handle_approval_confirmation(
        self,
        session_id: str,
        query: str,
        pending_approval: dict[str, Any],
        user_profile: Optional[dict[str, Any]],
    ) -> dict[str, Any]:
        """Handle approval confirmation for high-risk operations"""
        query_lower = query.lower()

        # Check for approval keywords
        approved = any(
            word in query_lower for word in ["yes", "confirm", "approve", "proceed"]
        )
        cancelled = any(
            word in query_lower for word in ["no", "cancel", "stop", "abort"]
        )

        if approved:
            # Execute the approved operation
            original_intent = pending_approval.get("intent", {})
            original_entities = pending_approval.get("entities", {})

            # Check if additional authentication is needed
            if original_intent.get("auth_required") == AuthLevel.CHALLENGE.value:
                # Request security challenge
                return {
                    "status": "auth_challenge_required",
                    "message": "Please complete security verification to proceed",
                    "challenge_type": "security_questions",
                    "intent": original_intent.get("intent_id"),
                }

            # Execute the banking operation
            execution_result = await self._execute_banking_operation(
                original_intent, original_entities, user_profile
            )

            # Clear pending approval
            await self.state.clear_pending_approval(session_id)

            return execution_result

        elif cancelled:
            # Clear pending approval
            await self.state.clear_pending_approval(session_id)

            return {
                "status": "cancelled",
                "message": "Operation cancelled. How else can I help you?",
                "intent": pending_approval.get("intent", {}).get("intent_id"),
            }

        else:
            # Unclear response
            return {
                "status": "confirmation_needed",
                "message": "Please confirm with 'yes' to proceed or 'no' to cancel",
                "pending_operation": pending_approval.get("summary"),
            }

    async def _process_response_type(
        self,
        response,
        classification: dict[str, Any],
        entities: dict[str, Any],
        session_id: str,
        original_query: str,
        resolved_query: str,
        user_profile: Optional[dict[str, Any]],
    ) -> dict[str, Any]:
        """Process different response types and prepare appropriate output"""
        if response.response_type == ResponseType.SUCCESS:
            # Execute banking operation if applicable
            if self._should_execute_operation(classification):
                execution_result = await self._execute_banking_operation(
                    classification, entities.get("entities", {}), user_profile
                )
                return self._format_success_response(
                    response, classification, entities, execution_result
                )
            else:
                # Information query, no execution needed
                return self._format_success_response(response, classification, entities)

        elif response.response_type == ResponseType.MISSING_INFO:
            # Store pending clarification
            await self.state.set_pending_clarification(
                session_id,
                {
                    "original_intent": classification,
                    "original_entities": entities.get("entities", {}),
                    "missing_entities": entities.get("missing_required", []),
                    "original_query": original_query,
                    "timestamp": datetime.now().isoformat(),
                },
            )

            return {
                "status": "clarification_needed",
                "intent": classification.get("intent_id"),
                "message": response.message,
                "missing_fields": entities.get("missing_required", []),
                "suggestions": response.follow_up_questions,
                "provided_entities": entities.get("entities", {}),
            }

        elif response.response_type == ResponseType.CONFIRMATION_NEEDED:
            # Store pending approval
            risk_level = RiskLevel(classification.get("risk_level", "low"))

            await self.state.set_pending_approval(
                session_id,
                {
                    "intent": classification,
                    "entities": entities.get("entities", {}),
                    "risk_level": risk_level.value,
                    "summary": response.message,
                    "awaiting_approval": True,
                    "timestamp": datetime.now().isoformat(),
                },
            )

            return {
                "status": "confirmation_needed",
                "intent": classification.get("intent_id"),
                "risk_level": risk_level.value,
                "message": response.message,
                "warning": response.risk_warning,
                "details": entities.get("entities", {}),
            }

        elif response.response_type == ResponseType.AUTH_REQUIRED:
            return {
                "status": "auth_required",
                "intent": classification.get("intent_id"),
                "message": response.message,
                "auth_challenge": response.auth_challenge,
                "required_level": classification.get("auth_required"),
            }

        elif response.response_type == ResponseType.ERROR:
            return {
                "status": "error",
                "intent": classification.get("intent_id"),
                "message": response.message,
                "failed_checks": [
                    p.name for p in response.preconditions if p.status.value == "failed"
                ],
                "next_steps": response.next_steps,
            }

        else:
            return {
                "status": "info",
                "intent": classification.get("intent_id"),
                "message": response.message,
                "data": response.data,
            }

    async def _execute_banking_operation(
        self,
        intent: dict[str, Any],
        entities: dict[str, Any],
        user_profile: Optional[dict[str, Any]],
    ) -> dict[str, Any]:
        """Execute banking operation using the operations catalog"""
        intent_id = intent.get("intent_id", "")
        
        # Get the appropriate operation from catalog
        operation = self.operations_catalog.get_operation_for_intent(intent_id)
        
        if not operation:
            # Fallback for unmapped intents
            return {
                "success": False,
                "message": f"Operation not implemented for intent: {intent_id}",
                "reference_id": f"REF{datetime.now().strftime('%Y%m%d%H%M%S')}",
            }

        # Convert entities to simple dict (remove nested structure if present)
        simple_entities = {}
        for key, value in entities.items():
            if isinstance(value, dict) and "value" in value:
                simple_entities[key] = value["value"]
            else:
                simple_entities[key] = value

        # Execute operation through catalog
        operation_result = await self.operations_catalog.execute_operation(
            operation.operation_id,
            simple_entities,
            user_profile
        )

        # Convert OperationResult to dict format expected by pipeline
        result = {
            "success": operation_result.status == OperationStatus.COMPLETED,
            "message": operation_result.message,
            "data": operation_result.data,
            "reference_id": operation_result.reference_id,
            "ui_hints": operation_result.ui_hints or {},
            "next_steps": operation_result.next_steps or []
        }

        return result

    async def _update_conversation_state(
        self,
        session_id: str,
        original_query: str,
        resolved_query: str,
        classification: dict[str, Any],
        entities: dict[str, Any],
        response,
    ):
        """Update conversation state with interaction details"""
        processing_result = {
            "intent": classification.get("intent_id"),
            "intent_name": classification.get("name"),
            "confidence": classification.get("confidence"),
            "risk_level": classification.get("risk_level"),
            "entities": entities.get("entities", {}),
            "response_type": response.response_type.value,
            "timestamp": datetime.now().isoformat(),
        }

        await self.state.update(
            session_id, original_query, resolved_query, processing_result
        )

    def _should_execute_operation(self, classification: dict[str, Any]) -> bool:
        """Determine if intent requires execution vs just information"""
        intent_id = classification.get("intent_id", "")
        classification.get("category", "")

        # Information-only intents
        info_patterns = ["check", "view", "show", "search", "inquiry"]

        return not any(pattern in intent_id for pattern in info_patterns)

    def _merge_entity_sets(
        self, original: dict[str, Any], new: dict[str, Any]
    ) -> dict[str, Any]:
        """Merge two sets of entities, with new values taking precedence"""
        merged = original.copy()
        merged.update(new.get("entities", {}))
        return merged

    def _format_response(
        self, response, intent: dict[str, Any], entities: dict[str, Any]
    ) -> dict[str, Any]:
        """Format response for output"""
        return {
            "status": "success",
            "intent": intent.get("intent_id"),
            "intent_name": intent.get("name"),
            "confidence": intent.get("confidence"),
            "risk_level": intent.get("risk_level"),
            "message": response.message,
            "entities": entities,
            "next_steps": response.next_steps,
            "preconditions": [
                {"name": p.name, "status": p.status.value, "message": p.message}
                for p in response.preconditions
            ],
        }

    def _format_success_response(
        self,
        response,
        classification: dict[str, Any],
        entities: dict[str, Any],
        execution_result: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Format a successful operation response"""
        result = {
            "status": "success",
            "intent": classification.get("intent_id"),
            "intent_name": classification.get("name"),
            "category": classification.get("category"),
            "confidence": classification.get("confidence"),
            "risk_level": classification.get("risk_level"),
            "message": response.message,
            "entities": entities.get("entities", {}),
            "next_steps": response.next_steps,
        }

        # Add UI assistance (navigation or transaction forms)
        ui_assistance = self._generate_ui_assistance(classification, entities, ui_context)
        if ui_assistance:
            result["ui_assistance"] = ui_assistance

        if execution_result:
            result["execution_result"] = execution_result

        if response.estimated_completion_time:
            result["estimated_completion_seconds"] = response.estimated_completion_time

        return result

    def _generate_ui_assistance(
        self, classification: dict[str, Any], entities: dict[str, Any], ui_context: Optional[str] = None
    ) -> Optional[dict[str, Any]]:
        """Generate UI assistance based on intent and UI context"""
        intent_id = classification.get("intent_id", "")
        
        # Context-aware routing: Same intent, different UI response based on active tab
        screen = ui_screen_catalog.get_screen_for_intent(intent_id)
        if not screen:
            return None
            
        # Banking (Navigation) context: Route to pre-built screens
        if ui_context == "banking":
            if screen.screen_type in [ScreenType.PRE_BUILT, ScreenType.DYNAMIC_FORM]:
                return {
                    "type": "navigation",
                    "action": "route_to_screen", 
                    "screen_id": screen.screen_id,
                    "route_path": screen.route_path,
                    "component_name": screen.component_name,
                    "title": screen.title_template,
                    "description": screen.description
                }
        
        # Transaction context: Create dynamic forms
        elif ui_context == "transaction":
            if screen.screen_type == ScreenType.DYNAMIC_FORM:
                form_config = ui_screen_catalog.assemble_dynamic_form(
                    intent_id, entities.get("entities", {}), {}
                )
                if form_config:
                    return {
                        "type": "transaction_form",
                        "action": "assemble_dynamic_form",
                        "form_config": form_config,
                        "title": screen.title_template,
                        "subtitle": screen.subtitle_template,
                        "success_message": screen.success_message
                    }
        
        # Chat context: No UI assistance, handle via conversation
        # (ui_context == "chat" or None)
        return None

    async def _is_approval_response(self, query: str) -> bool:
        """Check if query looks like an approval/rejection response"""
        approval_patterns = [
            r"\b(yes|no|confirm|cancel|approve|reject|proceed|stop|abort)\b",
            r"\b(ok|okay|sure|nope|nevermind)\b",
        ]

        query_lower = query.lower()
        return any(re.search(pattern, query_lower) for pattern in approval_patterns)

    def _create_error_response(self, error_message: str) -> dict[str, Any]:
        """Create an error response"""
        return {
            "status": "error",
            "message": "An error occurred processing your request",
            "error": error_message,
            "suggestions": [
                "Please try rephrasing your request",
                "Contact support if the issue persists",
            ],
        }
