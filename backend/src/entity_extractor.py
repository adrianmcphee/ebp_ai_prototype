"""Modern Entity Extractor with 2025 LLM Best Practices
Combines structured function calling with hybrid extraction approaches
"""

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from enum import Enum
from functools import lru_cache
from typing import Any, Optional, Union

from .llm_client import LLMClient

logger = logging.getLogger(__name__)


class EntityType(Enum):
    """Banking domain entity types"""

    AMOUNT = "amount"
    CURRENCY = "currency"
    ACCOUNT_TYPE = "account_type"
    ACCOUNT_NAME = "account_name"
    FROM_ACCOUNT = "from_account"
    TO_ACCOUNT = "to_account"
    ACCOUNT_ID = "account_id"
    RECIPIENT = "recipient"
    RECIPIENT_ACCOUNT = "recipient_account"
    ROUTING_NUMBER = "routing_number"
    CARD_ID = "card_id"
    DATE = "date"
    DATE_RANGE = "date_range"
    TIME_PERIOD = "time_period"
    FREQUENCY = "frequency"
    MERCHANT = "merchant"
    CATEGORY = "category"
    MEMO = "memo"
    PHONE = "phone"
    EMAIL = "email"
    AUTHENTICATION_METHOD = "authentication_method"
    TRANSACTION_ID = "transaction_id"


@dataclass
class ExtractedEntity:
    """Entity with metadata and validation state"""

    entity_type: EntityType
    value: Any
    raw_text: str
    confidence: float
    source: str  # "pattern", "llm", "function"
    position: Optional[tuple[int, int]] = None
    normalized_value: Any = None
    validation_errors: list[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "value": self.normalized_value or self.value,
            "raw": self.raw_text,
            "confidence": self.confidence,
            "source": self.source,
        }


@dataclass
class EntityValidationRule:
    """Validation rules for entities"""

    required: bool = False
    pattern: Optional[str] = None
    min_value: Optional[Union[int, float]] = None
    max_value: Optional[Union[int, float]] = None
    allowed_values: Optional[list[str]] = None
    custom_validator: Optional[callable] = None
    error_message: str = "Invalid value"


class EntityExtractor:
    """Modern entity extractor with function calling and hybrid approaches"""

    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client
        self.patterns = self._compile_patterns()
        self.validation_rules = self._init_validation_rules()
        self.extraction_functions = self._define_extraction_functions()

    @lru_cache(maxsize=128)
    def _compile_patterns(self) -> dict[EntityType, re.Pattern]:
        """Compile regex patterns with caching"""
        return {
            EntityType.AMOUNT: re.compile(
                r"(?:\$(\d+(?:,\d{3})*(?:\.\d{2})?)|(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(?:dollars?|USD))",
                re.IGNORECASE,
            ),
            EntityType.ACCOUNT_TYPE: re.compile(
                r"\b(checking|savings|credit|investment|loan|business)\s*(?:account)?\b",
                re.IGNORECASE,
            ),
            EntityType.ACCOUNT_NAME: re.compile(
                r"\b(?:primary|business|personal|main|savings?)\s+(?:checking|account)\b|\b(?:checking|savings)\s+account\b",
                re.IGNORECASE,
            ),
            EntityType.DATE: re.compile(
                r"\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|"
                r"today|tomorrow|yesterday|"
                r"(?:last|next|this)\s+(?:week|month|year))\b",
                re.IGNORECASE,
            ),
            EntityType.EMAIL: re.compile(
                r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b"
            ),
            EntityType.PHONE: re.compile(
                r"\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b"
            ),
            EntityType.ROUTING_NUMBER: re.compile(r"\b\d{9}\b"),
            EntityType.TRANSACTION_ID: re.compile(
                r"\b(?:transaction|trans|txn|ref)[#:\s]*([A-Z0-9]{8,20})\b",
                re.IGNORECASE,
            ),
            EntityType.CARD_ID: re.compile(
                r"(?:ending in|last\s*4|card\s*ending)\s*(\d{4})", re.IGNORECASE
            ),
        }

    def _init_validation_rules(self) -> dict[EntityType, EntityValidationRule]:
        """Initialize validation rules for each entity type"""
        return {
            EntityType.AMOUNT: EntityValidationRule(
                required=True,
                min_value=0.01,
                max_value=1000000,
                error_message="Amount must be between $0.01 and $1,000,000",
            ),
            EntityType.ACCOUNT_TYPE: EntityValidationRule(
                allowed_values=[
                    "checking",
                    "savings",
                    "credit",
                    "investment",
                    "loan",
                    "business",
                ],
                error_message="Invalid account type",
            ),
            EntityType.ACCOUNT_NAME: EntityValidationRule(
                allowed_values=[
                    "primary checking",
                    "savings account", 
                    "business checking",
                    "main account",
                    "personal account"
                ],
                error_message="Account name not recognized",
            ),
            EntityType.ROUTING_NUMBER: EntityValidationRule(
                pattern=r"^\d{9}$",
                custom_validator=self._validate_routing_number,
                error_message="Invalid routing number",
            ),
            EntityType.EMAIL: EntityValidationRule(
                pattern=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
                error_message="Invalid email format",
            ),
        }

    def _define_extraction_functions(self) -> list[dict[str, Any]]:
        """Define structured functions for LLM function calling"""
        return [
            {
                "name": "extract_banking_entities",
                "description": "Extract banking-related entities from user query",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "amount": {
                            "type": "number",
                            "description": "Monetary amount (number only, no currency symbols)",
                        },
                        "currency": {
                            "type": "string",
                            "description": "Currency code (USD, EUR, etc.)",
                        },
                        "recipient": {
                            "type": "string",
                            "description": "Person or entity receiving money",
                        },
                        "account_type": {
                            "type": "string",
                            "enum": [
                                "checking",
                                "savings",
                                "credit",
                                "investment",
                                "loan",
                                "business",
                            ],
                            "description": "Type of bank account",
                        },
                        "from_account": {
                            "type": "string",
                            "enum": [
                                "checking",
                                "savings",
                                "credit",
                                "investment",
                                "loan",
                                "business",
                            ],
                            "description": "Source account for transfers",
                        },
                        "to_account": {
                            "type": "string",
                            "enum": [
                                "checking",
                                "savings",
                                "credit",
                                "investment",
                                "loan",
                                "business",
                            ],
                            "description": "Destination account for transfers",
                        },
                        "account_id": {
                            "type": "string",
                            "description": "Account identifier or last 4 digits",
                        },
                        "date": {
                            "type": "string",
                            "description": "Date in ISO format (YYYY-MM-DD)",
                        },
                        "memo": {
                            "type": "string",
                            "description": "Payment memo or description",
                        },
                        "merchant": {
                            "type": "string",
                            "description": "Store or vendor name",
                        },
                        "phone": {"type": "string", "description": "Phone number"},
                        "email": {"type": "string", "description": "Email address"},
                    },
                    "required": [],
                },
            }
        ]

    async def extract(
        self,
        query: str,
        intent_type: Optional[str] = None,
        required_entities: Optional[list[str]] = None,
        context: Optional[dict[str, Any]] = None,
        use_function_calling: bool = True,
    ) -> dict[str, Any]:
        """Extract entities using modern hybrid approach with function calling

        Args:
        ----
            query: User input text
            intent_type: Detected intent for context
            required_entities: List of required entity types
            context: Conversation context
            use_function_calling: Whether to use structured function calling

        Returns:
        -------
            {
                "entities": {entity_type: ExtractedEntity.to_dict()},
                "missing_required": [entity_types],
                "validation_errors": {entity_type: error_message},
                "confidence_score": float,
                "follow_up_needed": bool,
                "suggestions": [string]
            }
        """
        try:
            # Phase 1: Pattern-based extraction (fast, reliable)
            pattern_entities = self._extract_with_patterns(query)

            # Phase 2: LLM-based extraction with function calling or JSON
            if use_function_calling:
                llm_entities = await self._extract_with_function_calling(
                    query, intent_type, context
                )
            else:
                llm_entities = await self._extract_with_json_mode(
                    query, intent_type, context
                )

            # Phase 3: Merge and validate
            merged_entities = self._merge_entities(pattern_entities, llm_entities)
            result = self._validate_and_format_result(
                merged_entities, required_entities, query, intent_type
            )

            # Add confidence score
            result["confidence_score"] = self._calculate_overall_confidence(
                result["entities"]
            )

            return result

        except Exception as e:
            logger.error(f"Entity extraction failed: {e}")
            return self._create_error_result(str(e))

    async def _extract_with_function_calling(
        self,
        query: str,
        intent_type: Optional[str] = None,
        context: Optional[dict[str, Any]] = None,
        max_retries: int = 2,
    ) -> dict[str, ExtractedEntity]:
        """Extract entities using structured function calling"""
        for attempt in range(max_retries + 1):
            try:
                prompt = self._build_function_calling_prompt(
                    query, intent_type, context
                )

                # Use function calling if LLM supports it
                response = await self.llm.complete(
                    prompt=prompt,
                    temperature=0.1,  # Low temperature for precision
                    timeout=3.0,
                    functions=self.extraction_functions,
                    function_call={"name": "extract_banking_entities"},
                )

                if isinstance(response, dict) and "function_call" in response:
                    function_result = json.loads(response["function_call"]["arguments"])
                    return self._convert_function_result_to_entities(function_result)

                # Fallback to JSON mode if function calling not supported
                return await self._extract_with_json_mode(query, intent_type, context)

            except Exception as e:
                if attempt == max_retries:
                    logger.warning(
                        f"Function calling failed after {max_retries + 1} attempts: {e}"
                    )
                    return {}
                await asyncio.sleep(0.5 * (2**attempt))  # Exponential backoff

        return {}

    async def _extract_with_json_mode(
        self,
        query: str,
        intent_type: Optional[str] = None,
        context: Optional[dict[str, Any]] = None,
        max_retries: int = 2,
    ) -> dict[str, ExtractedEntity]:
        """Extract entities using JSON mode with few-shot prompting"""
        for attempt in range(max_retries + 1):
            try:
                prompt = self._build_json_extraction_prompt(query, intent_type, context)

                response = await self.llm.complete(
                    prompt=prompt,
                    temperature=0.1,
                    timeout=3.0,
                    response_format={"type": "json_object"},
                )

                if isinstance(response, dict) and "entities" in response:
                    return self._convert_json_response_to_entities(response["entities"])
                elif isinstance(response, str):
                    # Try to parse JSON from string response
                    json_data = json.loads(response)
                    if "entities" in json_data:
                        return self._convert_json_response_to_entities(
                            json_data["entities"]
                        )

                return {}

            except Exception as e:
                if attempt == max_retries:
                    logger.warning(
                        f"JSON extraction failed after {max_retries + 1} attempts: {e}"
                    )
                    return {}
                await asyncio.sleep(0.5 * (2**attempt))

        return {}

    def _extract_with_patterns(self, query: str) -> dict[str, ExtractedEntity]:
        """Extract entities using regex patterns"""
        entities = {}

        for entity_type, pattern in self.patterns.items():
            matches = list(pattern.finditer(query))

            for match in matches:
                raw_text = match.group(0)
                value = self._normalize_pattern_value(entity_type, match)

                if value is not None:
                    entities[entity_type.value] = ExtractedEntity(
                        entity_type=entity_type,
                        value=value,
                        raw_text=raw_text,
                        confidence=0.85,  # High confidence for pattern matches
                        source="pattern",
                        position=(match.start(), match.end()),
                    )
                    break  # Take first match

        return entities

    def _build_function_calling_prompt(
        self,
        query: str,
        intent_type: Optional[str] = None,
        context: Optional[dict[str, Any]] = None,
    ) -> str:
        """Build prompt for function calling extraction"""
        context_info = ""
        if context:
            if context.get("last_recipient"):
                context_info += f"\nPrevious recipient: {context['last_recipient']}"
            if context.get("last_amount"):
                context_info += f"\nPrevious amount: ${context['last_amount']}"

        return f"""Extract banking entities from this user query using the provided function.

Query: "{query}"
Intent: {intent_type or 'unknown'}{context_info}

Instructions:
- Only extract entities that are explicitly mentioned in the query
- Be precise with amounts and names
- Use standard formats (ISO dates, proper account types)
- If unsure about an entity, omit it rather than guess"""

    def _build_json_extraction_prompt(
        self,
        query: str,
        intent_type: Optional[str] = None,
        context: Optional[dict[str, Any]] = None,
    ) -> str:
        """Build prompt for JSON mode extraction with few-shot examples"""
        examples = self._get_few_shot_examples(intent_type)
        context_info = ""

        if context:
            if context.get("last_recipient"):
                context_info += f"\nPrevious recipient: {context['last_recipient']}"
            if context.get("last_amount"):
                context_info += f"\nPrevious amount: ${context['last_amount']}"

        return f"""Extract banking entities from user queries. Return JSON with extracted entities.

{examples}

Query: "{query}"
Intent: {intent_type or 'unknown'}{context_info}

Extract entities and return JSON format:
{{
  "entities": {{
    "amount": 500.00,
    "recipient": "John Smith",
    "account_type": "checking"
  }}
}}

Rules:
- Only include entities explicitly mentioned in the query
- Use numbers for amounts (no currency symbols)
- Use ISO format for dates (YYYY-MM-DD)
- Account types: checking, savings, credit, investment, loan, business"""

    def _get_few_shot_examples(self, intent_type: Optional[str]) -> str:
        """Get few-shot examples based on intent type"""
        base_examples = """Examples:

Query: "Send $500 to John Smith from checking"
{"entities": {"amount": 500.00, "recipient": "John Smith", "account_type": "checking"}}

Query: "What's my savings account balance?"
{"entities": {"account_type": "savings"}}

Query: "Pay $150 to Electric Company for bill payment"
{"entities": {"amount": 150.00, "recipient": "Electric Company", "memo": "bill payment"}}"""

        if intent_type == "transfer":
            return (
                base_examples
                + """

Query: "Transfer 1000 dollars to my mom tomorrow"
{"entities": {"amount": 1000.00, "recipient": "mom", "date": "2024-01-16"}}"""
            )

        return base_examples

    def _convert_function_result_to_entities(
        self, function_result: dict[str, Any]
    ) -> dict[str, ExtractedEntity]:
        """Convert function calling result to ExtractedEntity objects"""
        entities = {}

        for key, value in function_result.items():
            if value is None or value == "":
                continue

            try:
                entity_type = EntityType(key)
                entities[key] = ExtractedEntity(
                    entity_type=entity_type,
                    value=value,
                    raw_text=str(value),
                    confidence=0.90,  # High confidence for function calls
                    source="function",
                )
            except ValueError:
                # Skip unknown entity types
                continue

        return entities

    def _convert_json_response_to_entities(
        self, json_entities: dict[str, Any]
    ) -> dict[str, ExtractedEntity]:
        """Convert JSON response to ExtractedEntity objects"""
        entities = {}

        for key, value in json_entities.items():
            if value is None or value == "":
                continue

            try:
                entity_type = EntityType(key)
                entities[key] = ExtractedEntity(
                    entity_type=entity_type,
                    value=value,
                    raw_text=str(value),
                    confidence=0.85,
                    source="llm",
                )
            except ValueError:
                continue

        return entities

    def _normalize_pattern_value(self, entity_type: EntityType, match: re.Match) -> Any:
        """Normalize values extracted from patterns"""
        if entity_type == EntityType.AMOUNT:
            # Check which group captured the amount
            amount_str = match.group(1) or match.group(2)
            if amount_str:
                amount_str = amount_str.replace(",", "")
                try:
                    return float(amount_str)
                except ValueError:
                    return None
            return None

        elif entity_type == EntityType.ACCOUNT_TYPE:
            account_type = match.group(1).lower()
            # Normalize common variations
            if "check" in account_type:
                return "checking"
            elif "sav" in account_type:
                return "savings"
            return account_type

        elif entity_type == EntityType.ACCOUNT_NAME:
            account_name = match.group(0).lower()
            # Normalize common variations to match actual account names
            if "primary" in account_name and "check" in account_name:
                return "primary checking"
            elif "business" in account_name and "check" in account_name:
                return "business checking"
            elif "savings" in account_name or "saving" in account_name:
                return "savings account"
            return account_name.strip()

        elif entity_type == EntityType.DATE:
            return self._parse_date(match.group(0))

        elif entity_type == EntityType.PHONE:
            # Format as (XXX) XXX-XXXX
            return f"({match.group(1)}) {match.group(2)}-{match.group(3)}"

        elif entity_type == EntityType.TRANSACTION_ID:
            return match.group(1)

        elif entity_type == EntityType.CARD_ID:
            return match.group(1)

        return match.group(0)

    def _merge_entities(
        self,
        pattern_entities: dict[str, ExtractedEntity],
        llm_entities: dict[str, ExtractedEntity],
    ) -> dict[str, ExtractedEntity]:
        """Merge entities from different sources, preferring higher confidence"""
        merged = pattern_entities.copy()

        for key, llm_entity in llm_entities.items():
            if key not in merged:
                merged[key] = llm_entity
            elif llm_entity.confidence > merged[key].confidence:
                merged[key] = llm_entity
            elif (
                key == "amount"
                and isinstance(llm_entity.value, int | float)
                and llm_entity.value > 0
            ):
                # Prefer LLM for amounts if it found a valid number
                merged[key] = llm_entity

        return merged

    def _validate_and_format_result(
        self,
        entities: dict[str, ExtractedEntity],
        required_entities: Optional[list[str]],
        query: str,
        intent_type: Optional[str],
    ) -> dict[str, Any]:
        """Validate entities and format final result"""
        validated_entities = {}
        validation_errors = {}

        # Validate and normalize each entity
        for key, entity in entities.items():
            rule = self.validation_rules.get(entity.entity_type)

            if rule:
                is_valid, error_msg = self._validate_entity(entity, rule)
                if is_valid:
                    entity.normalized_value = self._normalize_entity_value(entity)
                    validated_entities[key] = entity.to_dict()
                else:
                    validation_errors[key] = error_msg
            else:
                # No validation rule, accept as-is with basic normalization
                entity.normalized_value = self._normalize_entity_value(entity)
                validated_entities[key] = entity.to_dict()

        # Check for missing required entities
        missing_required = []
        if required_entities:
            for req_entity in required_entities:
                if req_entity not in validated_entities:
                    missing_required.append(req_entity)

        # Generate suggestions for missing entities
        suggestions = self._generate_suggestions(missing_required, intent_type)

        return {
            "entities": validated_entities,
            "missing_required": missing_required,
            "validation_errors": validation_errors,
            "follow_up_needed": len(missing_required) > 0,
            "suggestions": suggestions,
        }

    def _validate_entity(
        self, entity: ExtractedEntity, rule: EntityValidationRule
    ) -> tuple[bool, Optional[str]]:
        """Validate a single entity against its rule"""
        value = entity.value

        # Check pattern
        if rule.pattern:
            pattern = re.compile(rule.pattern)
            if not pattern.match(str(value)):
                return False, rule.error_message

        # Check allowed values
        if rule.allowed_values:
            if str(value).lower() not in [v.lower() for v in rule.allowed_values]:
                return (
                    False,
                    f"{rule.error_message}. Allowed: {', '.join(rule.allowed_values)}",
                )

        # Check numeric range
        if rule.min_value is not None or rule.max_value is not None:
            try:
                numeric_val = float(value)
                if rule.min_value and numeric_val < rule.min_value:
                    return False, f"Value must be at least {rule.min_value}"
                if rule.max_value and numeric_val > rule.max_value:
                    return False, f"Value must not exceed {rule.max_value}"
            except (ValueError, TypeError):
                return False, "Invalid numeric value"

        # Custom validation
        if rule.custom_validator:
            if not rule.custom_validator(value):
                return False, rule.error_message

        return True, None

    def _normalize_entity_value(self, entity: ExtractedEntity) -> Any:
        """Normalize entity values to standard format"""
        value = entity.value

        if entity.entity_type == EntityType.DATE:
            return self._parse_date(str(value))
        elif entity.entity_type == EntityType.EMAIL:
            return str(value).lower().strip()
        elif entity.entity_type == EntityType.ACCOUNT_TYPE:
            return str(value).lower()
        elif entity.entity_type == EntityType.ACCOUNT_NAME:
            return str(value).lower().strip()

        return value

    def _parse_date(self, date_str: str) -> Optional[str]:
        """Parse date string to ISO format"""
        date_lower = date_str.lower()
        today = date.today()

        # Handle relative dates
        if date_lower == "today":
            return today.isoformat()
        elif date_lower == "tomorrow":
            return (today + timedelta(days=1)).isoformat()
        elif date_lower == "yesterday":
            return (today - timedelta(days=1)).isoformat()

        # Try common formats
        formats = ["%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y", "%d/%m/%Y", "%m/%d/%y"]

        for fmt in formats:
            try:
                parsed = datetime.strptime(date_str, fmt).date()
                return parsed.isoformat()
            except ValueError:
                continue

        return date_str

    def _validate_routing_number(self, routing_number: str) -> bool:
        """Validate routing number using checksum algorithm"""
        if not re.match(r"^\d{9}$", str(routing_number)):
            return False

        # ABA routing number checksum
        digits = [int(d) for d in str(routing_number)]
        checksum = (
            3 * (digits[0] + digits[3] + digits[6])
            + 7 * (digits[1] + digits[4] + digits[7])
            + 1 * (digits[2] + digits[5] + digits[8])
        ) % 10

        return checksum == 0

    def _calculate_overall_confidence(self, entities: dict[str, Any]) -> float:
        """Calculate overall confidence score for extracted entities"""
        if not entities:
            return 0.0

        total_confidence = sum(entity["confidence"] for entity in entities.values())
        return total_confidence / len(entities)

    def _generate_suggestions(
        self, missing_entities: list[str], intent_type: Optional[str]
    ) -> list[str]:
        """Generate helpful suggestions for missing entities"""
        suggestions = []

        for entity in missing_entities:
            if entity == "amount":
                suggestions.append("What amount would you like to transfer?")
            elif entity == "recipient":
                suggestions.append("Who would you like to send the money to?")
            elif entity == "account_type":
                suggestions.append(
                    "Which account would you like to use (checking or savings)?"
                )
            elif entity == "date":
                suggestions.append("When would you like to schedule this?")
            else:
                suggestions.append(f"Please specify the {entity.replace('_', ' ')}")

        return suggestions

    def _create_error_result(self, error_message: str) -> dict[str, Any]:
        """Create error result structure"""
        return {
            "entities": {},
            "missing_required": [],
            "validation_errors": {"system": error_message},
            "confidence_score": 0.0,
            "follow_up_needed": False,
            "suggestions": ["Please try rephrasing your request"],
        }

    async def extract_batch(
        self, queries: list[str], intent_types: Optional[list[str]] = None
    ) -> list[dict[str, Any]]:
        """Extract entities from multiple queries concurrently"""
        if not intent_types:
            intent_types = [None] * len(queries)
        elif len(intent_types) != len(queries):
            intent_types = intent_types[: len(queries)] + [None] * (
                len(queries) - len(intent_types)
            )

        tasks = [
            self.extract(query, intent_type)
            for query, intent_type in zip(queries, intent_types, strict=False)
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Convert exceptions to error results
        formatted_results = []
        for result in results:
            if isinstance(result, Exception):
                formatted_results.append(self._create_error_result(str(result)))
            else:
                formatted_results.append(result)

        return formatted_results
