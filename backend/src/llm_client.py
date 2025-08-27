import asyncio
import json
import re
from abc import ABC, abstractmethod
from typing import Any, Optional

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI


class LLMClient(ABC):
    @abstractmethod
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
        pass


class OpenAIClient(LLMClient):
    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        """Initialize OpenAI client
        Models: gpt-4o-mini (fastest, cheapest)
                gpt-4o (balanced)
                gpt-4-turbo (most capable)
                gpt-3.5-turbo (legacy, fast)
        """
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model
        self.total_tokens = 0
        self.total_cost = 0.0

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
        try:
            # Build messages with system prompt
            messages = [
                {
                    "role": "system",
                    "content": "You are a banking assistant that classifies intents and extracts entities.",
                },
                {"role": "user", "content": prompt},
            ]

            kwargs = {
                "model": self.model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "timeout": timeout,
            }

            # OpenAI has native JSON mode and function calling
            if response_format and response_format.get("type") == "json_object":
                kwargs["response_format"] = {"type": "json_object"}

            # Add function calling if provided
            if functions:
                kwargs["tools"] = [
                    {"type": "function", "function": func} for func in functions
                ]
                if function_call:
                    kwargs["tool_choice"] = {
                        "type": "function",
                        "function": function_call,
                    }

            response = await asyncio.wait_for(
                self.client.chat.completions.create(**kwargs), timeout=timeout
            )

            message = response.choices[0].message
            content = message.content

            # Handle function calls
            if hasattr(message, "tool_calls") and message.tool_calls:
                tool_call = message.tool_calls[0]
                return {
                    "function_call": {
                        "name": tool_call.function.name,
                        "arguments": tool_call.function.arguments,
                    }
                }

            # Track usage
            if hasattr(response, "usage"):
                self.total_tokens += response.usage.total_tokens
                # Approximate costs (update with current pricing)
                if "gpt-4o-mini" in self.model:
                    cost = (
                        response.usage.prompt_tokens * 0.00015
                        + response.usage.completion_tokens * 0.0006
                    ) / 1000
                elif "gpt-4o" in self.model:
                    cost = (
                        response.usage.prompt_tokens * 0.0025
                        + response.usage.completion_tokens * 0.01
                    ) / 1000
                elif "gpt-4" in self.model:
                    cost = (
                        response.usage.prompt_tokens * 0.03
                        + response.usage.completion_tokens * 0.06
                    ) / 1000
                else:  # gpt-3.5-turbo
                    cost = (
                        response.usage.prompt_tokens * 0.0005
                        + response.usage.completion_tokens * 0.0015
                    ) / 1000
                self.total_cost += cost

            # Parse JSON if needed
            if response_format and response_format.get("type") == "json_object":
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    return {"error": "Invalid JSON response", "raw": content}

            return {"content": content}

        except asyncio.TimeoutError:
            raise TimeoutError(f"LLM request timed out after {timeout} seconds")
        except Exception as e:
            raise Exception(f"LLM request failed: {e!s}")


class AnthropicClient(LLMClient):
    def __init__(self, api_key: str, model: str = "claude-3-haiku-20240307"):
        """Initialize Anthropic client
        Models: claude-3-haiku-20240307 (fastest, cheapest)
                claude-3-sonnet-20240229 (balanced)
                claude-3-opus-20240229 (most capable)
                claude-3-5-sonnet-20241022 (latest)
        """
        self.client = AsyncAnthropic(api_key=api_key)
        self.model = model
        self.total_tokens = 0
        self.total_cost = 0.0

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
        try:
            # Build messages
            messages = [{"role": "user", "content": prompt}]

            # Build prompt with JSON instructions if needed
            system_prompt = "You are a banking assistant that classifies intents and extracts entities."
            if response_format and response_format.get("type") == "json_object":
                system_prompt += "\nRespond with valid JSON only."

            # For function calling, append instructions
            if functions and function_call:
                func_name = function_call.get("name")
                system_prompt += f"\nCall the {func_name} function with the extracted entities."
                messages[0][
                    "content"
                ] += '\n\nReturn a JSON object with a "function_call" key containing the function name and arguments.'

            response = await asyncio.wait_for(
                self.client.messages.create(
                    model=self.model,
                    system=system_prompt,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                ),
                timeout=timeout,
            )

            content = response.content[0].text

            # Track usage
            if hasattr(response, "usage"):
                self.total_tokens += response.usage.input_tokens + response.usage.output_tokens
                # Approximate costs (update with current pricing)
                if "haiku" in self.model:
                    cost = (
                        response.usage.input_tokens * 0.00025
                        + response.usage.output_tokens * 0.00125
                    ) / 1000
                elif "sonnet" in self.model:
                    cost = (
                        response.usage.input_tokens * 0.003
                        + response.usage.output_tokens * 0.015
                    ) / 1000
                else:  # opus
                    cost = (
                        response.usage.input_tokens * 0.015
                        + response.usage.output_tokens * 0.075
                    ) / 1000
                self.total_cost += cost

            # Handle function calls first
            if functions and function_call and "function_call" in content.lower():
                try:
                    # Try to parse as function call result
                    func_result = json.loads(content)
                    if "function_call" in func_result:
                        return func_result
                except json.JSONDecodeError:
                    # Try to extract function call from text
                    import re

                    func_match = re.search(
                        r'"function_call"\s*:\s*{[^}]+}', content, re.DOTALL
                    )
                    if func_match:
                        try:
                            return json.loads("{" + func_match.group() + "}")
                        except:
                            pass

            # Parse JSON if needed
            if response_format and response_format.get("type") == "json_object":
                if functions:
                    return {"error": "Function calling failed", "raw": content}
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    # Try to extract JSON from the response
                    import re

                    json_match = re.search(r"\{.*\}", content, re.DOTALL)
                    if json_match:
                        try:
                            return json.loads(json_match.group())
                        except:
                            pass
                    return {"error": "Invalid JSON response", "raw": content}

            return {"content": content}

        except asyncio.TimeoutError:
            raise TimeoutError(f"LLM request timed out after {timeout} seconds")
        except Exception as e:
            raise Exception(f"LLM request failed: {e!s}")


class MockLLMClient(LLMClient):
    """Mock LLM client that uses the actual intent catalog for accurate testing"""

    def __init__(self, delay: float = 0.1):
        self.delay = delay
        # Lazy import to avoid circular dependency
        from .intent_catalog import IntentCatalog
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
        """Fallback classification using improved keyword matching"""
        query_lower = query_text.lower()

        # Check for specific intent patterns - ordered by priority and specificity
        intent_patterns = {
            # Account Management - balance check should have priority over close
            "accounts.balance.check": ["what's my balance", "check my balance", "check balance", "check my account", "check account", "my balance", "balance", "how much money", "how much do i have", "available funds", "account balance", "checking balance", "savings balance", "what's in my"],
            "accounts.balance.history": ["balance history", "balance trends", "historical balance", "balance over time"],
            "accounts.statement.download": ["download statement", "statement pdf", "export statement", "get statement"],
            "accounts.statement.view": ["show statement", "view statement", "view transactions", "online statement", "see statement"],
            "accounts.alerts.setup": ["setup alerts", "configure notifications", "balance alerts", "alert me"],
            "accounts.close.request": ["close my account", "close account", "cancel account", "terminate account", "shutdown account"],

            # Payments & Transfers - Enhanced patterns
            "payments.transfer.internal": ["transfer between", "move to savings", "move to checking", "internal transfer", "transfer from checking", "transfer from savings"],
            "payments.transfer.external": ["wire transfer", "send to another bank", "external transfer", "wire money"],
            "payments.p2p.send": ["send money", "pay friend", "zelle", "venmo", "pay person", "send to john", "send to sarah", "transfer to alice", "pay bob", "send $", "send", "pay"],
            "payments.bill.pay": ["pay bill", "bill payment", "pay electric", "pay utility", "electricity bill", "gas bill", "water bill"],
            "payments.bill.schedule": ["schedule payment", "schedule a payment", "pay later", "future payment", "schedule bill", "scheduled payment"],
            "payments.recurring.setup": ["setup autopay", "set up autopay", "recurring payment", "monthly payment", "automatic payment", "setup recurring"],
            "payments.status.check": ["payment status", "did payment go through", "check if paid", "payment confirmation"],

            # Cards
            "cards.block.temporary": ["block card", "freeze card", "lock card", "disable card", "stop card", "suspend card"],
            "cards.replace.lost": ["lost card", "missing card", "replacement card", "can't find card", "stolen card", "new card"],
            "cards.activate": ["activate card", "turn on card", "enable card", "start using card"],
            "cards.pin.change": ["change pin", "update pin", "reset pin", "new pin", "modify pin"],
            "cards.limit.increase": ["increase limit", "raise limit", "higher limit", "credit limit", "spending limit"],

            # Disputes
            "disputes.transaction.initiate": ["dispute transaction", "dispute charge", "dispute", "fraudulent charge", "fraudulent", "unauthorized charge", "unauthorized", "didn't make", "wrong charge", "incorrect charge", "challenge transaction", "report fraud"],

            # Support
            "support.agent.request": ["talk to agent", "human help", "customer service", "speak to representative", "real person", "operator"],

            # Inquiries
            "inquiries.transaction.search": ["show my transactions", "show transactions", "transaction history", "recent purchases", "spending history", "recent transactions", "what did i spend", "transactions from", "transaction search"],
            "payments.status.check": ["payment status", "check payment status", "did payment go through", "check if paid", "payment confirmation"],

            # Lending
            "lending.apply.personal": ["personal loan", "borrow money", "apply for loan", "need loan"],
            "lending.apply.mortgage": ["apply for mortgage", "mortgage application", "mortgage", "home loan", "house loan", "buy house"],
            "lending.payment.make": ["pay loan", "loan payment", "pay mortgage", "mortgage payment"],

            # Investments
            "investments.portfolio.view": ["show portfolio", "my investments", "check stocks", "investment balance"],
            "investments.buy.stock": ["buy stock", "buy stocks", "purchase stock", "purchase shares", "invest in stock", "invest in", "buy apple stock", "buy tesla stock"],
            "investments.sell.stock": ["sell stock", "sell shares", "liquidate", "cash out"],

            # Authentication
            "authentication.login": ["log in", "sign in", "login", "access account"],
            "authentication.logout": ["log out", "sign out", "logout", "end session"],

            # Security
            "security.password.reset": ["reset password", "forgot password", "change password", "new password"],
            "security.2fa.setup": ["setup 2fa", "set up 2fa", "enable two factor", "two factor authentication", "two factor", "enable 2fa", "two-factor", "2fa setup"],

            # Profile
            "profile.update.contact": ["update email", "change phone", "update address", "change address"],

            # Onboarding
            "onboarding.account.open": ["open new account", "open an account", "open account", "new account", "start account", "create account", "open bank account"],

            # Business
            "business.account.open": ["open business account", "business account", "corporate account", "company banking", "business banking"],

            # Cash Management
            "cash.deposit.schedule": ["deposit cash", "cash deposit", "bring cash", "atm deposit"],

            # International
            "international.wire.send": ["international wire", "send abroad", "swift transfer", "overseas transfer"],
        }

        best_match = None
        best_score = 0

        # Score each intent based on keyword matches
        for intent_id, keywords in intent_patterns.items():
            score = 0
            matched_keywords = []
            
            for kw in keywords:
                # Give higher score for exact phrase matches
                if kw in query_lower:
                    # Longer keywords get exponentially higher scores for better specificity
                    keyword_score = len(kw.split()) ** 2
                    
                    # Bonus for exact match at beginning
                    if query_lower.startswith(kw):
                        keyword_score *= 1.5
                    
                    # Bonus for very close match (keyword is most of the query)
                    if len(kw) > len(query_lower) * 0.7:
                        keyword_score *= 1.3
                        
                    score += keyword_score
                    matched_keywords.append(kw)
            
            # Only update if this is a better match
            if score > best_score:
                best_score = score
                best_match = intent_id

        # If we have a match with reasonable confidence
        if best_match and best_score > 0:
            intent = self.catalog.get_intent(best_match)
            if intent:
                # Calculate confidence based on match strength
                # Higher scores = higher confidence
                confidence = min(0.95, 0.5 + (best_score * 0.15))
                
                return {
                    "intent_id": best_match,
                    "name": intent.name,
                    "confidence": confidence,
                    "category": intent.category.value,
                    "subcategory": intent.subcategory,
                    "risk_level": intent.risk_level.value,
                    "auth_required": intent.auth_required.value,
                    "alternatives": [],
                    "reasoning": f"Matched based on keyword patterns (score: {best_score})",
                }

        # Default to unknown
        return {
            "intent_id": "unknown",
            "confidence": 0.0,
            "category": "Unknown",
            "alternatives": [],
            "reasoning": "No matching intent found",
        }


def create_llm_client(provider: str, api_key: str, model: str) -> LLMClient:
    if provider == "openai":
        return OpenAIClient(api_key, model)
    elif provider == "anthropic":
        return AnthropicClient(api_key, model)
    elif provider == "mock":
        return MockLLMClient()
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")
