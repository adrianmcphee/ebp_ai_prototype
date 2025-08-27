"""Enhanced Mock LLM Client that properly matches intent catalog"""

import asyncio
import json
import re
from typing import Any, Optional

from src.intent_catalog import IntentCatalog
from src.llm_client import LLMClient


class EnhancedMockLLMClient(LLMClient):
    """Mock LLM client that uses the actual intent catalog for matching"""

    def __init__(self, delay: float = 0.01):
        self.delay = delay
        self.catalog = IntentCatalog()

    async def complete(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 500,
        timeout: float = 5.0,
        response_format: Optional[dict[str, str]] = None,
        functions: Optional[list[dict[str, Any]]] = None,
        function_call: Optional[dict[str, str]] = None,
    ) -> dict[str, Any]:
        await asyncio.sleep(self.delay)

        if self.delay > timeout:
            raise TimeoutError(f"Mock timeout after {timeout} seconds")

        prompt_lower = prompt.lower()

        # Handle function calling for entity extraction
        if functions and function_call:
            func_name = function_call.get("name")
            if func_name == "extract_banking_entities":
                return self._extract_entities(prompt)

        # Handle intent classification
        if response_format and response_format.get("type") == "json_object":
            # Extract the actual query from the classification prompt
            query_match = re.search(r'Query:\s*"([^"]+)"', prompt)
            if query_match:
                query_text = query_match.group(1)
            else:
                query_text = prompt

            # Use the actual intent catalog to match
            result = self.catalog.match_intent(query_text)

            # Ensure proper format for mock responses
            if result["intent_id"] == "unknown":
                # Try harder with keyword matching for common intents
                result = self._fallback_classification(query_text)

            # Add required fields if missing
            if "alternatives" not in result:
                result["alternatives"] = []
            if "confidence" not in result:
                result["confidence"] = 0.85
            if "risk_level" not in result:
                intent = self.catalog.get_intent(result.get("intent_id"))
                if intent:
                    result["risk_level"] = intent.risk_level.value
                    result["auth_required"] = intent.auth_required.value
                    result["category"] = intent.category.value

            return result

        # Default text response
        return {"content": f"Processed: {prompt[:100]}"}

    def _extract_entities(self, prompt: str) -> dict[str, Any]:
        """Extract entities from prompt"""
        entities = {}
        prompt_lower = prompt.lower()

        # Extract amounts
        amount_patterns = [
            r"\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)",
            r"(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars?|USD)",
        ]
        for pattern in amount_patterns:
            match = re.search(pattern, prompt, re.IGNORECASE)
            if match:
                amount_str = match.group(1).replace(",", "")
                entities["amount"] = float(amount_str)
                break

        # Extract recipients/names
        names = ["john", "sarah", "alice", "bob", "david", "emily", "michael", "mom", "dad", "mike"]
        for name in names:
            if name in prompt_lower:
                entities["recipient"] = name.title()
                break

        # Extract account types
        account_types = {
            "checking": ["checking", "check"],
            "savings": ["savings", "save"],
            "credit": ["credit card", "credit"],
            "debit": ["debit card", "debit"],
        }
        for acc_type, keywords in account_types.items():
            if any(kw in prompt_lower for kw in keywords):
                entities["account_type"] = acc_type
                break

        # Extract dates
        date_patterns = [
            r"(?:on |for |by )?(?:the )?(\d{1,2}(?:st|nd|rd|th)?(?:\s+(?:of\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December))?)",
            r"(?:next|this|last)\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|week|month|year)",
            r"(?:tomorrow|today|yesterday)",
        ]
        for pattern in date_patterns:
            match = re.search(pattern, prompt, re.IGNORECASE)
            if match:
                entities["date"] = match.group(0)
                break

        # Extract card identifiers
        if "card" in prompt_lower:
            if "ending in" in prompt_lower:
                card_match = re.search(r"ending in (\d{4})", prompt_lower)
                if card_match:
                    entities["card_identifier"] = f"****{card_match.group(1)}"
            elif "debit" in prompt_lower:
                entities["card_identifier"] = "debit_card"
            elif "credit" in prompt_lower:
                entities["card_identifier"] = "credit_card"

        # Extract transaction IDs
        trans_match = re.search(r"transaction\s*(?:id|#|number)?\s*[:\s]?\s*([A-Z0-9]+)", prompt, re.IGNORECASE)
        if trans_match:
            entities["transaction_id"] = trans_match.group(1)

        return {
            "function_call": {
                "name": "extract_banking_entities",
                "arguments": json.dumps(entities),
            }
        }

    def _fallback_classification(self, query_text: str) -> dict[str, Any]:
        """Fallback classification using simple keyword matching"""
        query_lower = query_text.lower()

        # Check for specific intent patterns
        intent_patterns = {
            # Account Management
            "accounts.balance.check": ["balance", "how much", "available funds", "account balance"],
            "accounts.balance.history": ["balance history", "balance trends", "historical balance"],
            "accounts.statement.download": ["download statement", "statement pdf", "export statement"],
            "accounts.statement.view": ["show statement", "view statement", "online statement"],
            "accounts.alerts.setup": ["setup alerts", "configure notifications", "balance alerts"],
            "accounts.close.request": ["close account", "cancel account", "terminate account"],

            # Payments & Transfers
            "payments.transfer.internal": ["transfer between", "move to savings", "move to checking", "internal transfer"],
            "payments.transfer.external": ["wire transfer", "send to another bank", "external transfer"],
            "payments.p2p.send": ["send money to friend", "zelle", "venmo", "pay person"],
            "payments.bill.pay": ["pay bill", "bill payment", "pay electric", "pay utility"],
            "payments.bill.schedule": ["schedule payment", "pay later", "future payment"],
            "payments.recurring.setup": ["setup autopay", "recurring payment", "monthly payment"],
            "payments.status.check": ["payment status", "did payment go through", "check if paid"],

            # Cards
            "cards.block.temporary": ["block card", "freeze card", "lock card", "disable card"],
            "cards.replace.lost": ["lost card", "missing card", "replacement card", "can't find card"],
            "cards.activate": ["activate card", "turn on card", "enable card"],
            "cards.pin.change": ["change pin", "update pin", "reset pin", "new pin"],
            "cards.limit.increase": ["increase limit", "raise limit", "higher limit", "credit limit"],

            # Disputes
            "disputes.transaction.initiate": ["dispute", "fraudulent", "unauthorized", "didn't make", "wrong charge"],

            # Support
            "support.agent.request": ["talk to agent", "human help", "customer service", "speak to representative"],

            # Inquiries
            "inquiries.transaction.search": ["show transactions", "transaction history", "recent purchases", "spending history"],

            # Lending
            "lending.apply.personal": ["personal loan", "borrow money", "apply for loan"],
            "lending.apply.mortgage": ["mortgage", "home loan", "house loan"],
            "lending.payment.make": ["pay loan", "loan payment", "pay mortgage"],

            # Investments
            "investments.portfolio.view": ["show portfolio", "my investments", "check stocks"],
            "investments.buy.stock": ["buy stock", "purchase shares", "invest in"],
            "investments.sell.stock": ["sell stock", "sell shares", "liquidate"],

            # Authentication
            "authentication.login": ["log in", "sign in", "login", "access account"],
            "authentication.logout": ["log out", "sign out", "logout", "end session"],

            # Security
            "security.password.reset": ["reset password", "forgot password", "change password"],
            "security.2fa.setup": ["setup 2fa", "two factor", "enable 2fa"],

            # Profile
            "profile.update.contact": ["update email", "change phone", "update address"],

            # Onboarding
            "onboarding.account.open": ["open account", "new account", "start account"],

            # Business
            "business.account.open": ["business account", "corporate account", "company banking"],

            # Cash Management
            "cash.deposit.schedule": ["deposit cash", "cash deposit", "bring cash"],

            # International
            "international.wire.send": ["international wire", "send abroad", "swift transfer"],
        }

        best_match = None
        best_score = 0

        for intent_id, keywords in intent_patterns.items():
            score = sum(1 for kw in keywords if kw in query_lower)
            if score > best_score:
                best_score = score
                best_match = intent_id

        if best_match:
            intent = self.catalog.get_intent(best_match)
            if intent:
                return {
                    "intent_id": best_match,
                    "name": intent.name,
                    "confidence": min(0.95, 0.7 + (best_score * 0.1)),
                    "category": intent.category.value,
                    "subcategory": intent.subcategory,
                    "risk_level": intent.risk_level.value,
                    "auth_required": intent.auth_required.value,
                    "alternatives": [],
                    "reasoning": "Matched based on keyword patterns",
                }

        # Default to unknown
        return {
            "intent_id": "unknown",
            "confidence": 0.0,
            "category": "Unknown",
            "alternatives": [],
            "reasoning": "No matching intent found",
        }
