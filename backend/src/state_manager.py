import json
import re
from datetime import datetime
from typing import Any, Optional

from .cache import RedisCache
from .database import Database


class ConversationStateManager:
    def __init__(self, redis_client: RedisCache, db: Database):
        self.redis = redis_client
        self.db = db
        self.max_history_size = 10
        self.session_ttl = 3600  # 1 hour

    async def get_context(self, session_id: str) -> dict[str, Any]:
        cache_key = f"session:{session_id}"
        cached_data = await self.redis.get(cache_key)

        if cached_data:
            return json.loads(cached_data)

        # Initialize new session context
        context = {
            "session_id": session_id,
            "history": [],
            "last_recipient": None,
            "last_recipient_id": None,
            "last_amount": None,
            "last_account": None,
            "last_account_id": None,
            "last_intent": None,
            "pending_action": None,
            "disambiguation_context": None,
            "pending_clarification": None,
            "approval_context": None,
            "created_at": datetime.now().isoformat(),
        }

        # Try to load from database
        db_history = await self.db.get_session_history(session_id, limit=10)
        if db_history:
            context["history"] = [
                {
                    "timestamp": row["timestamp"].isoformat()
                    if hasattr(row["timestamp"], "isoformat")
                    else row["timestamp"],
                    "query": row["query"],
                    "intent": row["intent_type"],
                    "entities": row["entities"],
                }
                for row in db_history
            ]

        await self._save_context(session_id, context)
        return context

    async def resolve_references(self, query: str, context: dict[str, Any]) -> str:
        """Replace pronouns and references with actual values from context"""
        resolved = query

        # Define replacement mappings
        replacements = []

        # Handle recipient references
        if context.get("last_recipient"):
            recipient_value = self._extract_entity_value(context["last_recipient"])
            if recipient_value:
                patterns = [
                    (r"\b(him|her|them)\b", str(recipient_value)),
                    (r"\bsame\s+person\b", str(recipient_value)),
                    (r"\bthat\s+person\b", str(recipient_value)),
                ]
                replacements.extend(patterns)

        # Handle amount references
        if context.get("last_amount"):
            try:
                # Extract value safely in case it's still an entity dictionary
                amount_value = self._extract_entity_value(context["last_amount"])
                if isinstance(amount_value, (int, float)):
                    amount_str = f"${amount_value:.2f}"
                    patterns = [
                        (r"\b(it|that|same\s+amount|that\s+much)\b", amount_str),
                        (r"\bsame\b(?!\s+person)", amount_str),
                    ]
                    replacements.extend(patterns)
            except (TypeError, ValueError):
                # Skip amount replacement if formatting fails
                print(f"Could not format amount reference: {e}. Continuing with original query.")
                pass

        # Handle account references
        if context.get("last_account"):
            account_value = self._extract_entity_value(context["last_account"])
            if account_value:
                patterns = [
                    (r"\bthere\b", str(account_value)),
                    (r"\bsame\s+account\b", str(account_value)),
                    (r"\bthat\s+account\b", str(account_value)),
                ]
                replacements.extend(patterns)

        # Apply replacements
        for pattern, replacement in replacements:
            if re.search(pattern, resolved, re.IGNORECASE):
                resolved = re.sub(pattern, replacement, resolved, flags=re.IGNORECASE)

        # Handle "another" pattern (requires amount)
        if context.get("last_amount"):
            try:
                amount_value = self._extract_entity_value(context["last_amount"])
                if isinstance(amount_value, (int, float)):
                    another_pattern = r"\banother\s+\$?(\d+(?:\.\d{2})?)\b"
                    match = re.search(another_pattern, resolved, re.IGNORECASE)
                    if match:
                        new_amount = float(match.group(1))
                        resolved = re.sub(
                            another_pattern, f"${new_amount:.2f}", resolved, flags=re.IGNORECASE
                        )
            except (TypeError, ValueError):
                # Skip "another" pattern if amount handling fails
                print(f"Could not handle 'another' pattern: {e}. Continuing with original query.")
                pass

        return resolved

    async def update(
        self,
        session_id: str,
        original_query: str,
        resolved_query: str,
        processing_result: dict[str, Any],
    ):
        """Update conversation state with new interaction"""
        context = await self.get_context(session_id)

        # Extract key information for context tracking
        entities = processing_result.get("entities", {})

        # Update context fields based on entities
        if entities.get("recipient"):
            recipient_entity = entities["recipient"]
            # Extract the actual value from entity dictionary
            context["last_recipient"] = self._extract_entity_value(recipient_entity)
            # Store recipient ID if available
            if processing_result.get("matched_recipient_id"):
                context["last_recipient_id"] = processing_result["matched_recipient_id"]

        if entities.get("amount"):
            amount_entity = entities["amount"]
            # Extract the actual value from entity dictionary
            context["last_amount"] = self._extract_entity_value(amount_entity)

        if entities.get("account") or entities.get("from_account"):
            account_entity = entities.get("from_account") or entities.get("account")
            # Extract the actual value from entity dictionary
            context["last_account"] = self._extract_entity_value(account_entity)
            # Store account ID if available
            if processing_result.get("account_id"):
                context["last_account_id"] = processing_result["account_id"]

        # Update last intent
        context["last_intent"] = processing_result.get("intent")

        # Handle disambiguation context
        if processing_result.get("disambiguations"):
            context["disambiguation_context"] = {
                "field": next(iter(processing_result["disambiguations"].keys())),
                "options": processing_result["disambiguations"],
            }
        else:
            context["disambiguation_context"] = None

        # Handle pending actions
        if processing_result.get("missing_fields"):
            context["pending_action"] = {
                "intent": processing_result["intent"],
                "entities": entities,
                "missing_fields": processing_result["missing_fields"],
            }
        else:
            context["pending_action"] = None

        # Add to history
        history_entry = {
            "timestamp": datetime.now().isoformat(),
            "original": original_query,
            "resolved": resolved_query,
            "intent": processing_result.get("intent"),
            "confidence": processing_result.get("confidence"),
            "entities": entities,
        }

        context["history"].append(history_entry)

        # Maintain history size limit
        context["history"] = context["history"][-self.max_history_size :]

        # Save updated context
        await self._save_context(session_id, context)

        # Log to database
        await self._log_to_database(
            session_id, original_query, resolved_query, processing_result
        )

    async def _save_context(self, session_id: str, context: dict[str, Any]):
        """Save context to Redis cache"""
        cache_key = f"session:{session_id}"
        await self.redis.setex(
            cache_key, self.session_ttl, json.dumps(context, default=str)
        )

    async def _log_to_database(
        self,
        session_id: str,
        original_query: str,
        resolved_query: str,
        processing_result: dict[str, Any],
    ):
        """Log interaction to database for analytics"""
        try:
            await self.db.log_interaction(
                session_id=session_id,
                query=original_query,
                resolved_query=resolved_query,
                intent_type=processing_result.get("intent"),
                confidence=processing_result.get("confidence", 0.0),
                entities=processing_result.get("entities", {}),
                validation_result=processing_result.get("validation", {}),
                action_taken=processing_result.get("intent"),
                response_time_ms=processing_result.get("response_time_ms"),
            )
        except Exception as e:
            print(f"Failed to log to database: {e}")

    async def get_pending_action(self, session_id: str) -> Optional[dict[str, Any]]:
        """Get any pending action that needs completion"""
        context = await self.get_context(session_id)
        return context.get("pending_action")

    async def clear_pending_action(self, session_id: str):
        """Clear pending action after completion"""
        context = await self.get_context(session_id)
        context["pending_action"] = None
        await self._save_context(session_id, context)

    async def get_disambiguation_context(
        self, session_id: str
    ) -> Optional[dict[str, Any]]:
        """Get disambiguation context if any"""
        context = await self.get_context(session_id)
        return context.get("disambiguation_context")

    async def resolve_disambiguation(
        self, session_id: str, field: str, selected_option: Any
    ):
        """Resolve a disambiguation by selecting an option"""
        context = await self.get_context(session_id)

        if context.get("disambiguation_context"):
            if context["disambiguation_context"]["field"] == field:
                # Clear disambiguation context
                context["disambiguation_context"] = None

                # Update relevant context field
                if field == "recipient":
                    context["last_recipient"] = selected_option.get("name")
                    context["last_recipient_id"] = selected_option.get("id")

                await self._save_context(session_id, context)

    async def get_conversation_summary(self, session_id: str) -> dict[str, Any]:
        """Get a summary of the conversation for display"""
        context = await self.get_context(session_id)

        return {
            "session_id": session_id,
            "interaction_count": len(context["history"]),
            "last_intent": context.get("last_intent"),
            "has_pending_action": context.get("pending_action") is not None,
            "has_disambiguation": context.get("disambiguation_context") is not None,
            "recent_intents": [
                entry["intent"]
                for entry in context["history"][-5:]
                if entry.get("intent")
            ],
        }

    async def cleanup_old_sessions(self):
        """Clean up old sessions from database"""
        await self.db.cleanup_old_sessions()

    def _extract_entity_value(self, entity):
        """Extract the actual value from an entity dictionary or return the entity if it's already a simple value."""
        if isinstance(entity, dict):
            # Handle entity dictionary format: {"value": X, "raw": Y, "confidence": Z}
            if "value" in entity:
                return entity["value"]
            elif "raw" in entity:
                return entity["raw"]
            else:
                # Fallback: return the entity as-is
                return entity
        else:
            # Handle simple value format
            return entity

    # === Multi-turn Clarification Dialog Support ===

    async def add_clarification_request(
        self,
        session_id: str,
        clarification_type: str,
        options: list[dict[str, Any]],
        original_intent: str,
        original_entities: dict[str, Any],
        field_name: str | None = None,
    ) -> dict[str, Any]:
        """Add a clarification request to the conversation state.

        Args:
        ----
            session_id: Session identifier
            clarification_type: Type of clarification (recipient, account, date, etc.)
            options: List of options to present to user
            original_intent: The original intent being processed
            original_entities: Entities collected so far
            field_name: Optional specific field name needing clarification

        Returns:
        -------
            Clarification context dict
        """
        context = await self.get_context(session_id)

        clarification_context = {
            "type": clarification_type,
            "options": options,
            "original_intent": original_intent,
            "original_entities": original_entities,
            "field_name": field_name or clarification_type,
            "awaiting_response": True,
            "created_at": datetime.now().isoformat(),
        }

        context["pending_clarification"] = clarification_context
        await self._save_context(session_id, context)

        return clarification_context

    async def get_pending_clarification(
        self, session_id: str
    ) -> Optional[dict[str, Any]]:
        """Get any pending clarification request"""
        context = await self.get_context(session_id)
        return context.get("pending_clarification")

    async def resolve_clarification(
        self, session_id: str, user_response: str
    ) -> Optional[dict[str, Any]]:
        """Resolve a pending clarification with user's response.

        Args:
        ----
            session_id: Session identifier
            user_response: User's response to clarification

        Returns:
        -------
            Selected option if matched, None otherwise
        """
        context = await self.get_context(session_id)
        clarification = context.get("pending_clarification")

        if not clarification or not clarification.get("awaiting_response"):
            return None

        # Try to match user response to options
        selected = self._match_clarification_response(
            user_response, clarification["options"]
        )

        if selected:
            # Update original entities with clarified value
            clarification["original_entities"][clarification["field_name"]] = selected
            clarification["awaiting_response"] = False
            clarification["resolved_at"] = datetime.now().isoformat()
            clarification["selected_option"] = selected

            # Clear pending clarification
            context["pending_clarification"] = None
            await self._save_context(session_id, context)

            return {
                "resolved": True,
                "original_intent": clarification["original_intent"],
                "updated_entities": clarification["original_entities"],
                "selected_option": selected,
            }

        return None

    def _match_clarification_response(
        self, response: str, options: list[dict[str, Any]]
    ) -> Optional[dict[str, Any]]:
        """Match user response to clarification options.

        Handles:
        - Numeric selection: "1", "the first one", "option 2"
        - Name matching: "John Smith", "checking account"
        - Partial matching: "Smith", "checking"
        """
        response_lower = response.lower().strip()

        # Check for numeric selection
        numeric_patterns = [
            (r"^(\d+)$", lambda m: int(m.group(1)) - 1),  # "1", "2"
            (r"(?:the\s+)?first\s+(?:one)?", lambda m: 0),  # "first", "the first one"
            (r"(?:the\s+)?second\s+(?:one)?", lambda m: 1),  # "second"
            (r"(?:the\s+)?third\s+(?:one)?", lambda m: 2),  # "third"
            (r"option\s+(\d+)", lambda m: int(m.group(1)) - 1),  # "option 1"
        ]

        for pattern, extractor in numeric_patterns:
            match = re.search(pattern, response_lower)
            if match:
                idx = extractor(match)
                if 0 <= idx < len(options):
                    return options[idx]

        # Check for exact or partial name matching
        for option in options:
            # Get searchable text from option
            if isinstance(option, dict):
                searchable = (
                    option.get("name", "") or option.get("display", "") or str(option)
                )
            else:
                searchable = str(option)

            searchable_lower = searchable.lower()

            # Exact match
            if response_lower == searchable_lower:
                return option

            # Partial match (response is contained in option)
            if response_lower in searchable_lower:
                return option

            # Option is contained in response
            if searchable_lower in response_lower:
                return option

        return None

    # === Transaction Approval Support ===

    async def add_approval_request(
        self,
        session_id: str,
        transaction_type: str,
        amount: float,
        details: dict[str, Any],
        approval_method: str = "biometric",
    ) -> dict[str, Any]:
        """Add a transaction approval request to the conversation state.

        Args:
        ----
            session_id: Session identifier
            transaction_type: Type of transaction (transfer, payment, etc.)
            amount: Transaction amount
            details: Transaction details
            approval_method: Method of approval (biometric, security_question, pin)

        Returns:
        -------
            Approval context dict with token
        """
        import hashlib

        context = await self.get_context(session_id)

        # Generate approval token
        token_source = f"{session_id}{datetime.now().isoformat()}{amount}"
        token_hash = hashlib.sha256(token_source.encode()).hexdigest()[:8]
        approval_token = f"APV-{token_hash.upper()}"

        approval_context = {
            "transaction_type": transaction_type,
            "amount": amount,
            "details": details,
            "approval_method": approval_method,
            "token": approval_token,
            "created_at": datetime.now().isoformat(),
            "expires_at": (datetime.now().timestamp() + 300),  # 5 minutes
            "awaiting_approval": True,
            "attempts": 0,
            "max_attempts": 3,
        }

        context["approval_context"] = approval_context
        await self._save_context(session_id, context)

        return approval_context

    async def get_pending_approval(self, session_id: str) -> Optional[dict[str, Any]]:
        """Get any pending approval request"""
        context = await self.get_context(session_id)
        approval = context.get("approval_context")

        # Check if expired
        if approval and approval.get("expires_at"):
            if datetime.now().timestamp() > approval["expires_at"]:
                context["approval_context"] = None
                await self._save_context(session_id, context)
                return None

        return approval

    async def verify_approval(
        self, session_id: str, verification_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Verify a transaction approval.

        Args:
        ----
            session_id: Session identifier
            verification_data: Data for verification (biometric result, security answer, etc.)

        Returns:
        -------
            Verification result dict
        """
        context = await self.get_context(session_id)
        approval = context.get("approval_context")

        if not approval or not approval.get("awaiting_approval"):
            return {"approved": False, "error": "No pending approval"}

        # Check expiration
        if datetime.now().timestamp() > approval["expires_at"]:
            context["approval_context"] = None
            await self._save_context(session_id, context)
            return {"approved": False, "error": "Approval expired"}

        # Increment attempts
        approval["attempts"] += 1

        # Simulate verification based on method
        approved = False
        if approval["approval_method"] == "biometric":
            # In prototype, always approve if biometric_success is True
            approved = verification_data.get("biometric_success", False)
        elif approval["approval_method"] == "security_question":
            # Check answer (in prototype, accept "mockAnswer123")
            approved = verification_data.get("answer") == "mockAnswer123"
        elif approval["approval_method"] == "pin":
            # Check PIN (in prototype, accept "1234")
            approved = verification_data.get("pin") == "1234"

        if approved:
            approval["awaiting_approval"] = False
            approval["approved_at"] = datetime.now().isoformat()
            await self._save_context(session_id, context)

            return {
                "approved": True,
                "transaction_type": approval["transaction_type"],
                "amount": approval["amount"],
                "details": approval["details"],
            }
        else:
            # Check if max attempts reached
            if approval["attempts"] >= approval["max_attempts"]:
                context["approval_context"] = None
                await self._save_context(session_id, context)
                return {"approved": False, "error": "Max attempts exceeded"}

            await self._save_context(session_id, context)
            return {
                "approved": False,
                "attempts_remaining": approval["max_attempts"] - approval["attempts"],
            }

    async def set_pending_approval(
        self, session_id: str, approval_context: dict[str, Any]
    ):
        """Set pending approval context"""
        context = await self.get_context(session_id)
        context["approval_context"] = approval_context
        await self._save_context(session_id, context)

    async def clear_pending_approval(self, session_id: str):
        """Clear pending approval context"""
        context = await self.get_context(session_id)
        context["approval_context"] = None
        await self._save_context(session_id, context)

    async def set_pending_clarification(
        self, session_id: str, clarification_context: dict[str, Any]
    ):
        """Set pending clarification context for missing entities"""
        context = await self.get_context(session_id)
        context["pending_clarification"] = clarification_context
        await self._save_context(session_id, context)

    async def clear_pending_clarification(self, session_id: str):
        """Clear pending clarification context"""
        context = await self.get_context(session_id)
        context["pending_clarification"] = None
        await self._save_context(session_id, context)
