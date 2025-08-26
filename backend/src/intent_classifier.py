"""Enhanced Intent Classifier with confidence scoring, risk assessment, and hierarchical intents
Inspired by banking domain knowledge from CSV data
"""

import asyncio
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from .cache import RedisCache
from .llm_client import LLMClient


class RiskLevel(Enum):
    """Risk levels for banking operations"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AuthLevel(Enum):
    """Authentication requirements"""

    NONE = "none"
    BASIC = "basic"
    FULL = "full"
    CHALLENGE = "challenge"


class IntentCategory(Enum):
    """High-level intent categories"""

    ACCOUNTS = "accounts"
    PAYMENTS = "payments"
    TRANSFERS = "transfers"
    CARDS = "cards"
    LENDING = "lending"
    INVESTMENTS = "investments"
    SECURITY = "security"
    SUPPORT = "support"
    INQUIRIES = "inquiries"
    DISPUTES = "disputes"
    SETTINGS = "settings"
    UNKNOWN = "unknown"


@dataclass
class IntentConfig:
    """Configuration for each intent type"""

    intent_id: str
    name: str
    category: IntentCategory
    subcategory: str
    risk_level: RiskLevel
    auth_required: AuthLevel
    confidence_threshold: float
    required_entities: list[str]
    optional_entities: list[str]
    keywords: list[str]
    patterns: list[str]
    preconditions: list[str]
    timeout_ms: int = 5000
    max_retries: int = 3


class IntentClassifier:
    """Enhanced intent classifier with banking domain knowledge"""

    def __init__(self, llm_client: LLMClient, cache: RedisCache):
        self.llm = llm_client
        self.cache = cache
        self.intent_configs = self._initialize_intent_configs()
        self.compiled_patterns = self._compile_patterns()

    def _initialize_intent_configs(self) -> dict[str, IntentConfig]:
        """Initialize intent configurations inspired by banking domain"""
        return {
            # Account Management
            "accounts.balance.check": IntentConfig(
                intent_id="accounts.balance.check",
                name="Check Balance",
                category=IntentCategory.ACCOUNTS,
                subcategory="balance",
                risk_level=RiskLevel.LOW,
                auth_required=AuthLevel.BASIC,
                confidence_threshold=0.85,
                required_entities=["account_type"],
                optional_entities=["account_id", "currency"],
                keywords=["balance", "how much", "available", "funds", "money"],
                patterns=[
                    r"\b(what('s| is) my|check|show) .* balance\b",
                    r"\bhow much .* (have|available|left)\b",
                    r"\b(available|current) (funds|balance)\b",
                ],
                preconditions=["account_exists"],
                timeout_ms=2000,
            ),
            "accounts.statement.request": IntentConfig(
                intent_id="accounts.statement.request",
                name="Request Statement",
                category=IntentCategory.ACCOUNTS,
                subcategory="statements",
                risk_level=RiskLevel.LOW,
                auth_required=AuthLevel.FULL,
                confidence_threshold=0.80,
                required_entities=["period"],
                optional_entities=["format", "delivery_method", "account_id"],
                keywords=["statement", "download", "export", "pdf", "document"],
                patterns=[
                    r"\b(download|get|send|export) .* statement\b",
                    r"\bstatement .* (pdf|download|email)\b",
                    r"\b(monthly|quarterly|annual) statement\b",
                ],
                preconditions=["account_exists", "period_available"],
                timeout_ms=5000,
            ),
            # Payments & Transfers
            "payments.transfer.internal": IntentConfig(
                intent_id="payments.transfer.internal",
                name="Internal Transfer",
                category=IntentCategory.TRANSFERS,
                subcategory="internal",
                risk_level=RiskLevel.MEDIUM,
                auth_required=AuthLevel.FULL,
                confidence_threshold=0.85,
                required_entities=["amount", "from_account", "to_account"],
                optional_entities=["memo", "schedule_date"],
                keywords=[
                    "transfer",
                    "move",
                    "between",
                    "accounts",
                    "savings",
                    "checking",
                ],
                patterns=[
                    r"\btransfer .* (to|from|between) .* account\b",
                    r"\bmove .* (to|from) (savings|checking)\b",
                    r"\b(internal|between) .* transfer\b",
                ],
                preconditions=["balance_check", "accounts_active"],
                timeout_ms=4000,
            ),
            "payments.transfer.external": IntentConfig(
                intent_id="payments.transfer.external",
                name="External Transfer",
                category=IntentCategory.TRANSFERS,
                subcategory="external",
                risk_level=RiskLevel.HIGH,
                auth_required=AuthLevel.CHALLENGE,
                confidence_threshold=0.90,
                required_entities=["amount", "recipient_account", "recipient_name"],
                optional_entities=["routing_number", "bank_name", "memo", "wire_type"],
                keywords=["wire", "send", "external", "transfer", "bank", "ACH"],
                patterns=[
                    r"\b(wire|send) .* to .* (bank|account)\b",
                    r"\bexternal .* transfer\b",
                    r"\btransfer .* (different|another) bank\b",
                ],
                preconditions=["balance_check", "fraud_check", "limit_check"],
                timeout_ms=15000,
                max_retries=1,
            ),
            "payments.p2p.send": IntentConfig(
                intent_id="payments.p2p.send",
                name="P2P Payment",
                category=IntentCategory.PAYMENTS,
                subcategory="p2p",
                risk_level=RiskLevel.MEDIUM,
                auth_required=AuthLevel.FULL,
                confidence_threshold=0.85,
                required_entities=["amount", "recipient"],
                optional_entities=["memo", "payment_method"],
                keywords=["send", "pay", "zelle", "venmo", "friend", "person"],
                patterns=[
                    r"\b(send|pay) .* to .* (friend|person|someone)\b",
                    r"\b(zelle|venmo|paypal) .* to\b",
                    r"\bp2p .* payment\b",
                ],
                preconditions=["balance_check", "recipient_enrolled"],
                timeout_ms=6000,
            ),
            # Cards
            "cards.block.temporary": IntentConfig(
                intent_id="cards.block.temporary",
                name="Block Card",
                category=IntentCategory.CARDS,
                subcategory="security",
                risk_level=RiskLevel.HIGH,
                auth_required=AuthLevel.FULL,
                confidence_threshold=0.90,
                required_entities=["card_identifier"],
                optional_entities=["reason", "duration"],
                keywords=["block", "freeze", "lock", "disable", "card", "temporarily"],
                patterns=[
                    r"\b(block|freeze|lock|disable) .* card\b",
                    r"\bcard .* (lost|stolen|missing)\b",
                    r"\btemporarily .* (block|freeze) .* card\b",
                ],
                preconditions=["card_active"],
                timeout_ms=3000,
            ),
            # Disputes
            "disputes.transaction.initiate": IntentConfig(
                intent_id="disputes.transaction.initiate",
                name="Dispute Transaction",
                category=IntentCategory.DISPUTES,
                subcategory="transactions",
                risk_level=RiskLevel.HIGH,
                auth_required=AuthLevel.FULL,
                confidence_threshold=0.85,
                required_entities=["transaction_id"],
                optional_entities=["reason", "amount", "merchant"],
                keywords=[
                    "dispute",
                    "wrong",
                    "fraud",
                    "unauthorized",
                    "incorrect",
                    "charge",
                ],
                patterns=[
                    r"\b(dispute|report) .* (transaction|charge|payment)\b",
                    r"\b(fraudulent|unauthorized|wrong) .* charge\b",
                    r"\bdidn't .* (make|authorize) .* (purchase|transaction)\b",
                ],
                preconditions=["within_dispute_window", "transaction_posted"],
                timeout_ms=10000,
            ),
            # Support
            "support.agent.request": IntentConfig(
                intent_id="support.agent.request",
                name="Request Agent",
                category=IntentCategory.SUPPORT,
                subcategory="agent",
                risk_level=RiskLevel.LOW,
                auth_required=AuthLevel.BASIC,
                confidence_threshold=0.80,
                required_entities=[],
                optional_entities=["reason", "priority"],
                keywords=[
                    "agent",
                    "human",
                    "representative",
                    "help",
                    "support",
                    "speak",
                ],
                patterns=[
                    r"\b(talk|speak|connect) .* (agent|representative|human)\b",
                    r"\b(need|want) .* (help|support|assistance)\b",
                    r"\bcustomer .* service\b",
                ],
                preconditions=["hours_check"],
                timeout_ms=2000,
            ),
            # Inquiries
            "inquiries.transaction.search": IntentConfig(
                intent_id="inquiries.transaction.search",
                name="Search Transactions",
                category=IntentCategory.INQUIRIES,
                subcategory="transactions",
                risk_level=RiskLevel.LOW,
                auth_required=AuthLevel.BASIC,
                confidence_threshold=0.80,
                required_entities=[],
                optional_entities=[
                    "date_range",
                    "merchant",
                    "amount_range",
                    "category",
                ],
                keywords=[
                    "transaction",
                    "history",
                    "recent",
                    "purchase",
                    "spent",
                    "activity",
                ],
                patterns=[
                    r"\b(show|view|see) .* transaction\b",
                    r"\b(recent|last) .* (transactions|purchases|activity)\b",
                    r"\bwhat .* (spent|purchased|bought)\b",
                ],
                preconditions=["account_exists"],
                timeout_ms=3000,
            ),
        }

    def _compile_patterns(self) -> dict[str, list[re.Pattern]]:
        """Compile regex patterns for each intent"""
        compiled = {}
        for intent_id, config in self.intent_configs.items():
            compiled[intent_id] = [
                re.compile(pattern, re.IGNORECASE) for pattern in config.patterns
            ]
        return compiled

    async def classify(
        self,
        query: str,
        context: dict[str, Any] | None = None,
        include_risk: bool = True,
    ) -> dict[str, Any]:
        """Enhanced classification with confidence scoring and risk assessment

        Returns
        -------
            {
                "intent_id": "accounts.balance.check",
                "name": "Check Balance",
                "category": "accounts",
                "confidence": 0.92,
                "risk_level": "low",
                "auth_required": "basic",
                "required_entities": ["account_type"],
                "missing_entities": [],
                "alternatives": [
                    {"intent_id": "...", "confidence": 0.75},
                    {"intent_id": "...", "confidence": 0.60}
                ],
                "preconditions": ["account_exists"],
                "reasoning": "...",
                "response_time_ms": 145
            }
        """
        start_time = datetime.now()

        # Check cache
        cache_key = self._generate_cache_key(query)
        cached_result = await self._get_cached_result(cache_key)

        if cached_result:
            cached_result["from_cache"] = True
            return cached_result

        try:
            # Try LLM classification first
            llm_result = await self._classify_with_llm(query, context)

            # Enhance with risk and auth information
            if include_risk:
                llm_result = self._enhance_with_metadata(llm_result)

            # Cache the result
            await self._cache_result(cache_key, llm_result)

            response_time = (datetime.now() - start_time).total_seconds() * 1000
            llm_result["response_time_ms"] = int(response_time)
            llm_result["from_cache"] = False

            return llm_result

        except Exception as e:
            print(f"LLM classification failed: {e}")
            # Fallback to pattern-based classification
            fallback_result = self._pattern_based_classify(query)
            fallback_result["fallback"] = True
            fallback_result["error"] = str(e)
            return fallback_result

    async def _classify_with_llm(
        self, query: str, context: Optional[dict[str, Any]] = None
    ) -> dict[str, Any]:
        """Classify using LLM with enhanced prompt"""
        # Build intent descriptions for the prompt
        intent_descriptions = []
        for intent_id, config in self.intent_configs.items():
            desc = f"- {intent_id}: {config.name} (Category: {config.category.value})"
            if config.keywords:
                desc += f" Keywords: {', '.join(config.keywords[:5])}"
            intent_descriptions.append(desc)

        prompt = f"""Classify this banking query into the most specific intent.

Query: "{query}"

Available intents:
{chr(10).join(intent_descriptions)}

Context from previous interaction (if relevant):
{json.dumps(context.get('last_intent', {}), indent=2) if context else 'None'}

Return JSON with:
{{
    "intent_id": "most specific intent ID",
    "confidence": 0.0-1.0,
    "alternatives": [
        {{"intent_id": "alternative1", "confidence": 0.0-1.0}},
        {{"intent_id": "alternative2", "confidence": 0.0-1.0}}
    ],
    "reasoning": "Brief explanation of classification",
    "entities_detected": ["list", "of", "entities", "mentioned"]
}}

Be very specific - prefer subcategory intents over general ones."""

        response = await self.llm.complete(
            prompt=prompt,
            temperature=0.2,  # Lower temperature for more consistent classification
            timeout=3.0,
            response_format={"type": "json_object"},
        )

        if isinstance(response, dict) and "error" not in response:
            return self._validate_llm_response(response)

        raise ValueError(f"Invalid LLM response: {response}")

    def _validate_llm_response(self, response: dict[str, Any]) -> dict[str, Any]:
        """Validate and enhance LLM response"""
        # Ensure we have a valid intent_id
        intent_id = response.get("intent_id", "unknown")
        if intent_id not in self.intent_configs:
            # Try to find closest match
            intent_id = self._find_closest_intent(intent_id)

        config = self.intent_configs.get(intent_id)
        if not config:
            # Default to unknown
            return {
                "intent_id": "unknown",
                "category": IntentCategory.UNKNOWN.value,
                "confidence": 0.0,
                "alternatives": [],
                "reasoning": "Intent not recognized",
            }

        # Validate confidence
        confidence = float(response.get("confidence", 0.0))
        confidence = max(0.0, min(1.0, confidence))

        # Validate alternatives
        alternatives = []
        for alt in response.get("alternatives", []):
            if isinstance(alt, dict):
                alt_id = alt.get("intent_id")
                if alt_id in self.intent_configs and alt_id != intent_id:
                    alternatives.append(
                        {
                            "intent_id": alt_id,
                            "confidence": float(alt.get("confidence", 0.0)),
                        }
                    )

        return {
            "intent_id": intent_id,
            "name": config.name,
            "category": config.category.value,
            "subcategory": config.subcategory,
            "confidence": confidence,
            "alternatives": alternatives[:3],  # Top 3 alternatives
            "reasoning": response.get("reasoning", ""),
            "entities_detected": response.get("entities_detected", []),
        }

    def _pattern_based_classify(self, query: str) -> dict[str, Any]:
        """Fallback pattern-based classification"""
        query_lower = query.lower()
        scores = []

        for intent_id, patterns in self.compiled_patterns.items():
            config = self.intent_configs[intent_id]
            score = 0.0

            # Check pattern matches
            pattern_matches = sum(1 for p in patterns if p.search(query_lower))
            if pattern_matches > 0:
                score += 0.4 * (pattern_matches / len(patterns))

            # Check keyword matches
            keyword_matches = sum(1 for kw in config.keywords if kw in query_lower)
            if keyword_matches > 0:
                score += 0.6 * (keyword_matches / len(config.keywords))

            if score > 0:
                scores.append((intent_id, score * config.confidence_threshold))

        if not scores:
            return {
                "intent_id": "unknown",
                "category": IntentCategory.UNKNOWN.value,
                "confidence": 0.0,
                "alternatives": [],
                "reasoning": "No patterns matched",
            }

        # Sort by score
        scores.sort(key=lambda x: x[1], reverse=True)
        best_match = scores[0]
        config = self.intent_configs[best_match[0]]

        alternatives = [
            {"intent_id": intent_id, "confidence": score}
            for intent_id, score in scores[1:4]
        ]

        return {
            "intent_id": best_match[0],
            "name": config.name,
            "category": config.category.value,
            "subcategory": config.subcategory,
            "confidence": best_match[1],
            "alternatives": alternatives,
            "reasoning": "Pattern-based classification",
        }

    def _enhance_with_metadata(self, result: dict[str, Any]) -> dict[str, Any]:
        """Add risk level, auth requirements, and entity requirements"""
        intent_id = result.get("intent_id")
        config = self.intent_configs.get(intent_id)

        if config:
            result.update(
                {
                    "risk_level": config.risk_level.value,
                    "auth_required": config.auth_required.value,
                    "required_entities": config.required_entities,
                    "optional_entities": config.optional_entities,
                    "preconditions": config.preconditions,
                    "timeout_ms": config.timeout_ms,
                    "confidence_threshold": config.confidence_threshold,
                }
            )

        return result

    def _find_closest_intent(self, intent_id: str) -> str:
        """Find closest matching intent ID"""
        # Try exact match first
        if intent_id in self.intent_configs:
            return intent_id

        # Try prefix match
        for known_id in self.intent_configs:
            if known_id.startswith(intent_id) or intent_id.startswith(known_id):
                return known_id

        # Try category match
        for known_id, config in self.intent_configs.items():
            if intent_id.lower() in config.category.value.lower():
                return known_id

        return "unknown"

    def _generate_cache_key(self, query: str) -> str:
        normalized = query.lower().strip()
        hash_value = hashlib.md5(normalized.encode()).hexdigest()
        return f"enhanced_intent:{hash_value}"

    async def _get_cached_result(self, cache_key: str) -> Optional[dict[str, Any]]:
        try:
            cached = await self.cache.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            print(f"Cache retrieval error: {e}")
        return None

    async def _cache_result(
        self, cache_key: str, result: dict[str, Any], ttl: int = 300
    ):
        try:
            await self.cache.setex(cache_key, ttl, json.dumps(result))
        except Exception as e:
            print(f"Cache storage error: {e}")

    def get_intent_config(self, intent_id: str) -> Optional[IntentConfig]:
        """Get configuration for a specific intent"""
        return self.intent_configs.get(intent_id)

    def get_high_risk_intents(self) -> list[str]:
        """Get list of high-risk intent IDs"""
        return [
            intent_id
            for intent_id, config in self.intent_configs.items()
            if config.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]
        ]

    async def batch_classify(
        self, queries: list[str], context: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        """Classify multiple queries in parallel"""
        tasks = [self.classify(query, context) for query in queries]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        processed = []
        for result in results:
            if isinstance(result, Exception):
                processed.append(
                    {
                        "intent_id": "unknown",
                        "category": IntentCategory.UNKNOWN.value,
                        "confidence": 0.0,
                        "error": str(result),
                    }
                )
            else:
                processed.append(result)

        return processed
