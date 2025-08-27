"""Enhanced Intent Classifier using unified intent catalog
Uses the comprehensive BankingIntent catalog with LLM enhancement and pattern-based fallback
"""

import asyncio
import hashlib
import json
from datetime import datetime
from typing import Any, Optional

from .cache import RedisCache
from .intent_catalog import intent_catalog, IntentCategory, RiskLevel, AuthLevel
from .llm_client import LLMClient


class IntentClassifier:
    """Enhanced intent classifier using unified banking intent catalog"""

    def __init__(self, llm_client: LLMClient, cache: RedisCache):
        self.llm = llm_client
        self.cache = cache
        self.catalog = intent_catalog

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
                "category": "Account Management",
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

            # Cache the result
            await self._cache_result(cache_key, llm_result)

            response_time = (datetime.now() - start_time).total_seconds() * 1000
            llm_result["response_time_ms"] = int(response_time)
            llm_result["from_cache"] = False

            return llm_result

        except Exception as e:
            print(f"LLM classification failed: {e}")
            # Fallback to pattern-based classification using the catalog
            fallback_result = self.catalog.match_intent(query)
            fallback_result["fallback"] = True
            fallback_result["error"] = str(e)
            
            response_time = (datetime.now() - start_time).total_seconds() * 1000
            fallback_result["response_time_ms"] = int(response_time)
            fallback_result["from_cache"] = False
            
            return fallback_result

    async def _classify_with_llm(
        self, query: str, context: Optional[dict[str, Any]] = None
    ) -> dict[str, Any]:
        """Classify using LLM with enhanced prompt"""
        # Build intent descriptions for the prompt from the catalog
        intent_descriptions = []
        for intent_id in self.catalog.get_all_intent_ids():
            intent = self.catalog.get_intent(intent_id)
            if intent:
                desc = f"- {intent_id}: {intent.name} (Category: {intent.category.value})"
                if intent.keywords:
                    desc += f" Keywords: {', '.join(intent.keywords[:5])}"
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
        """Validate and enhance LLM response using the catalog"""
        # Ensure we have a valid intent_id
        intent_id = response.get("intent_id", "unknown")
        
        if not self.catalog.validate_intent_id(intent_id):
            # Try to find closest match or fall back to catalog matching
            fallback_result = self.catalog.match_intent(response.get("reasoning", ""))
            intent_id = fallback_result["intent_id"]

        intent = self.catalog.get_intent(intent_id)
        if not intent:
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
                if self.catalog.validate_intent_id(alt_id) and alt_id != intent_id:
                    alternatives.append(
                        {
                            "intent_id": alt_id,
                            "confidence": float(alt.get("confidence", 0.0)),
                        }
                    )

        return {
            "intent_id": intent.intent_id,
            "name": intent.name,
            "category": intent.category.value,
            "subcategory": intent.subcategory,
            "confidence": confidence,
            "risk_level": intent.risk_level.value,
            "auth_required": intent.auth_required.value,
            "required_entities": intent.required_entities,
            "optional_entities": intent.optional_entities,
            "preconditions": intent.preconditions,
            "timeout_ms": intent.timeout_ms,
            "confidence_threshold": intent.confidence_threshold,
            "alternatives": alternatives[:3],  # Top 3 alternatives
            "reasoning": response.get("reasoning", ""),
            "entities_detected": response.get("entities_detected", []),
        }

    def _generate_cache_key(self, query: str) -> str:
        normalized = query.lower().strip()
        hash_value = hashlib.md5(normalized.encode()).hexdigest()
        return f"unified_intent:{hash_value}"

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

    def get_intent_config(self, intent_id: str) -> Optional[dict[str, Any]]:
        """Get configuration for a specific intent"""
        intent = self.catalog.get_intent(intent_id)
        if intent:
            return {
                "intent_id": intent.intent_id,
                "name": intent.name,
                "category": intent.category.value,
                "subcategory": intent.subcategory,
                "risk_level": intent.risk_level.value,
                "auth_required": intent.auth_required.value,
                "required_entities": intent.required_entities,
                "optional_entities": intent.optional_entities,
                "preconditions": intent.preconditions,
                "timeout_ms": intent.timeout_ms,
                "confidence_threshold": intent.confidence_threshold,
            }
        return None

    def get_high_risk_intents(self) -> list[str]:
        """Get list of high-risk intent IDs"""
        high_risk_intents = self.catalog.get_high_risk_intents()
        return [intent.intent_id for intent in high_risk_intents]

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

    def get_intent_count(self) -> int:
        """Get total number of available intents"""
        return self.catalog.get_intent_count()

    def get_categories(self) -> list[str]:
        """Get all available intent categories"""
        return [category.value for category in IntentCategory if category != IntentCategory.UNKNOWN]
