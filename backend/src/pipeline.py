"""Enhanced Pipeline integrating new classifiers with existing multi-turn support
Combines enhanced intent classification, entity extraction, and context-aware responses
"""

import re
from datetime import datetime
from typing import Any, Optional, Dict, List, Tuple
from abc import ABC, abstractmethod

from .context_aware_responses import ContextAwareResponseGenerator, ResponseType
from .entity_extractor import EntityExtractor
from .intent_catalog import AuthLevel, RiskLevel
from .intent_classifier import IntentClassifier
from .mock_banking import MockBankingService
from .state_manager import ConversationStateManager
from .validator import EntityValidator
from .banking_operations import BankingOperationsCatalog, OperationStatus
from .ui_screen_catalog import ui_screen_catalog, ScreenType
from .entity_enricher import IntentDrivenEnricher
from .intent_refiner import IntentRefiner


class ParameterResolver(ABC):
    """Abstract base class for route parameter resolvers"""
    
    @abstractmethod
    def resolve(self, entities: Dict[str, Any]) -> Optional[str]:
        """Resolve parameter value from extracted entities"""
        pass


class AccountParameterResolver(ParameterResolver):
    """Resolves :accountId parameters from entities"""
    
    def __init__(self, banking_service):
        self.banking = banking_service
    
    def resolve(self, entities: Dict[str, Any]) -> Optional[str]:
        """Resolve account ID from entities"""
        accounts = self.banking.accounts
        
        # Try account_id entity first (most direct)
        if "account_id" in entities:
            account_id = entities["account_id"]["value"]
            if account_id in accounts:
                return account_id
        
        # Try account_name entity
        if "account_name" in entities:
            account_name = entities["account_name"]["value"].lower()
            
            # Find accounts matching this name
            for acc_id, account in accounts.items():
                if account.name.lower() == account_name:
                    return acc_id
        
        # Try account_type entity 
        if "account_type" in entities:
            account_type = entities["account_type"]["value"].lower()
            
            # Find accounts matching this type
            matching_accounts = []
            for acc_id, account in accounts.items():
                if account.type.lower() == account_type:
                    matching_accounts.append(acc_id)
            
            # If only one match, return it
            if len(matching_accounts) == 1:
                return matching_accounts[0]
        
        return None

class ParameterResolverRegistry:
    """Registry for parameter resolvers - supports Open-Closed Principle"""
    
    def __init__(self):
        self._resolvers: Dict[str, ParameterResolver] = {}
    
    def register(self, param_name: str, resolver: ParameterResolver) -> None:
        """Register a resolver for a parameter type"""
        self._resolvers[param_name] = resolver
    
    def get_resolver(self, param_name: str) -> Optional[ParameterResolver]:
        """Get resolver for a parameter type"""
        return self._resolvers.get(param_name)
    
    def get_registered_params(self) -> List[str]:
        """Get list of registered parameter names"""
        return list(self._resolvers.keys())


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
        
        # Initialize parameter resolver registry
        self.parameter_registry = ParameterResolverRegistry()
        self._register_default_resolvers()
        
        # Initialize intent-driven entity enricher
        from .intent_catalog import intent_catalog
        self.entity_enricher = IntentDrivenEnricher(intent_catalog, banking_service)
        
        # Initialize intent refiner
        self.intent_refiner = IntentRefiner()

    def _register_default_resolvers(self) -> None:
        """Register default parameter resolvers - can be extended without modifying this class"""
        # Register account parameter resolver
        account_resolver = AccountParameterResolver(self.banking)
        self.parameter_registry.register("account_id", account_resolver)
        
        # Register transaction parameter resolver (if needed in future)
        # transaction_resolver = TransactionParameterResolver(self.banking)
        # self.parameter_registry.register("transaction_id", transaction_resolver)
        
        # Future resolvers can be registered here or via plugin system

                    
    def _camel_to_snake(self, camel_str: str) -> str:
        """Convert camelCase to snake_case (accountId -> account_id)"""
        import re
        return re.sub(r'(?<!^)(?=[A-Z])', '_', camel_str).lower()

    async def _apply_entity_enrichment(self, intent_id: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """Apply intent-driven entity enrichment following SOLID principles
        
        This method enriches entities based on the intent's declared enrichment requirements.
        It follows the Open-Closed Principle by using strategies that can be extended without
        modifying this pipeline code.
        """
        if not intent_id:
            return entities
            
        # Get extracted entities in the format expected by enricher
        extracted_entities = entities.get("entities", {})
        
        # Apply enrichment based on intent requirements
        enriched_entities = await self.entity_enricher.enrich(intent_id, extracted_entities)
        
        # Update the entities dict with enriched values
        if enriched_entities != extracted_entities:
            # Create updated entities dict
            updated_entities = entities.copy()
            updated_entities["entities"] = enriched_entities
            
            # Update missing_required list if entities were resolved
            missing_required = updated_entities.get("missing_required", [])
            newly_added_entities = set(enriched_entities.keys()) - set(extracted_entities.keys())
            
            # Remove newly enriched entities from missing list
            updated_missing = [req for req in missing_required if req not in newly_added_entities]
            updated_entities["missing_required"] = updated_missing
            
            return updated_entities
            
        return entities

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

            # Apply intent-driven entity enrichment (e.g., account_type -> account_id)
            entities = await self._apply_entity_enrichment(classification.get("intent_id"), entities)
            
            # Apply intent refinement after enrichment
            if classification.get("intent_id"):
                try:
                    original_intent = classification["intent_id"]
                    
                    # Add original query to entities for refinement context
                    enriched_entities = entities.get("entities", {})
                    enriched_entities["original_query"] = resolved_query
                    
                    final_intent, reason = self.intent_refiner.refine_intent(
                        original_intent, 
                        enriched_entities
                    )
                    
                    if final_intent != original_intent:
                        classification["intent_id"] = final_intent
                        classification["refinement_applied"] = True
                        classification["refinement_reason"] = reason
                        
                except Exception as e:
                    # Continue with original intent if refinement fails
                    print(f"Intent refinement failed: {e}. Continuing with original intent: {classification.get('intent_id')}")
                    pass
                    
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
                ui_context,
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
            return {
                "status": "error",
                "intent": "unknown",
                "confidence": 0.0,
                "entities": {},
                "message": "An error occurred processing your request",
                "ui_assistance": None,
                "execution": None
            }

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

            if response.response_type == ResponseType.CONFIRMATION_NEEDED:
                from .intent_catalog import RiskLevel
                risk_level = RiskLevel(original_intent.get("risk_level", "low"))

                await self.state.set_pending_approval(
                    session_id,
                    {
                        "intent": original_intent,
                        "entities": merged_entities,
                        "risk_level": risk_level.value,
                        "summary": response.message,
                        "awaiting_approval": True,
                        "timestamp": datetime.now().isoformat(),
                    },
                )

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

            # Update conversation state after successful operation to ensure continuity
            try:
                processing_result = {
                    "intent": original_intent.get("intent_id"),
                    "intent_name": original_intent.get("name"),
                    "confidence": original_intent.get("confidence", 1.0),
                    "entities": original_entities,
                    "status": "success",
                    "timestamp": datetime.now().isoformat(),
                }
                
                # Note: We pass "confirm" as original query but maintain the resolved_query
                # This ensures the context reflects the confirmation action
                await self.state.update(
                    session_id, 
                    query,  # "confirm"
                    query,  # "confirm" 
                    processing_result
                )
                
            except Exception as e:
                # Continue anyway since the operation succeeded
                print(f"Failed to update conversation state after successful operation: {e} Continuing anyway...")
                pass

            # Format as proper pipeline response
            if execution_result.get("success"):
                return {
                    "status": "success",
                    "intent": original_intent.get("intent_id"),
                    "intent_name": original_intent.get("name"),
                    "confidence": original_intent.get("confidence", 1.0),
                    "entities": original_entities,
                    "message": execution_result.get("message"),
                    "execution_result": execution_result,
                    "ui_assistance": None,
                    "execution": execution_result
                }
            else:
                return {
                    "status": "error",
                    "intent": original_intent.get("intent_id"),
                    "confidence": original_intent.get("confidence", 0.0),
                    "entities": original_entities,
                    "message": execution_result.get("message", "Operation failed"),
                    "ui_assistance": None,
                    "execution": None
                }

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
        ui_context: Optional[str] = None,
    ) -> dict[str, Any]:
        """Process different response types and prepare appropriate output"""
        if response.response_type == ResponseType.SUCCESS:
            # Execute banking operation if applicable
            if self._should_execute_operation(classification):
                execution_result = await self._execute_banking_operation(
                    classification, entities.get("entities", {}), user_profile
                )
                return await self._format_success_response(
                    response, classification, entities, execution_result, ui_context, resolved_query
                )
            else:
                # Information query, no execution needed
                return await self._format_success_response(response, classification, entities, None, ui_context, resolved_query)

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
                "confidence": classification.get("confidence", 0.0),
                "entities": response.data.get("processed_entities", entities.get("entities", {})),
                "message": response.message,
                "risk_level": risk_level.value,
                "warning": response.risk_warning,
                "ui_assistance": None,
                "execution": None
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
            if isinstance(value, dict):
                # For enriched entities, use appropriate field based on entity type
                if "enriched_entity" in value and "id" in value["enriched_entity"]:
                    enriched = value["enriched_entity"]
                    if key == "recipient":
                        # For recipients, use the name for display in messages
                        simple_entities[key] = enriched.get("name", enriched["id"])
                        # Also provide the ID separately for banking operations that need it
                        simple_entities[f"{key}_id"] = enriched["id"]
                    else:
                        # For other entities (accounts, etc.), use the ID
                        simple_entities[key] = enriched["id"]
                elif "value" in value:
                    simple_entities[key] = value["value"]
                else:
                    simple_entities[key] = value
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
        
        # Import ResponseType here to avoid circular imports
        from .context_aware_responses import ResponseType
        
        status_mapping = {
            ResponseType.SUCCESS: "success",
            ResponseType.CONFIRMATION_NEEDED: "awaiting_user_confirmation",
            ResponseType.MISSING_INFO: "clarification_needed",
            ResponseType.AUTH_REQUIRED: "auth_required",
            ResponseType.ERROR: "error",
            ResponseType.WARNING: "warning",
            ResponseType.INFO: "info"
        }
        
        mapped_status = status_mapping.get(response.response_type, "success")
        
        return {
            "status": mapped_status,
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

    async def _format_success_response(
        self,
        response,
        classification: dict[str, Any],
        entities: dict[str, Any],
        execution_result: Optional[dict[str, Any]] = None,
        ui_context: Optional[str] = None,
        query: str = "",
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
        ui_assistance = await self._generate_ui_assistance(classification, entities, ui_context, query)
        if ui_assistance:
            result["ui_assistance"] = ui_assistance

        if execution_result:
            result["execution_result"] = execution_result

        if response.estimated_completion_time:
            result["estimated_completion_seconds"] = response.estimated_completion_time

        return result

    async def _generate_ui_assistance(
        self, classification: dict[str, Any], entities: dict[str, Any], ui_context: Optional[str] = None, query: str = ""
    ) -> Optional[dict[str, Any]]:
        """Generate UI assistance based on intent and UI context
        
        Note: Banking context navigation is now handled by frontend intent-based navigation.
        This method only handles transaction forms and other non-navigation UI assistance.
        """
        intent_id = classification.get("intent_id", "")
        
        # Banking (Navigation) context: No longer handled by backend
        # Frontend now uses intent-based navigation service for separation of concerns
        if ui_context == "banking":
            return None
        
        # Transaction context: Create dynamic forms
        elif ui_context == "transaction":
            screen = ui_screen_catalog.get_screen_for_intent(intent_id)
            if screen and screen.screen_type == ScreenType.DYNAMIC_FORM:
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
