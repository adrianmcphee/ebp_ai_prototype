import asyncio
import json
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
            # Build system prompt for JSON responses or function calls
            system_prompt = "You are a banking assistant that classifies intents and extracts entities."

            if functions and function_call:
                # Convert to tool-like prompt for Anthropic
                func_name = function_call.get("name")
                if func_name and functions:
                    func_def = next(
                        (f for f in functions if f["name"] == func_name), None
                    )
                    if func_def:
                        system_prompt += f'\n\nCall the {func_name} function with the appropriate parameters based on the user query. Return the function call as JSON in this format: {{"function_call": {{"name": "{func_name}", "arguments": "{{...}}"}}}}'
            elif response_format and response_format.get("type") == "json_object":
                system_prompt += "\nYou must respond with valid JSON only. No additional text or explanation."

            # Create the message
            response = await asyncio.wait_for(
                self.client.messages.create(
                    model=self.model,
                    system=system_prompt,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=temperature,
                    max_tokens=max_tokens,
                ),
                timeout=timeout,
            )

            # Extract content
            content = response.content[0].text

            # Track usage
            if hasattr(response, "usage"):
                self.total_tokens += (
                    response.usage.input_tokens + response.usage.output_tokens
                )
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
    def __init__(self, delay: float = 0.1):
        self.delay = delay
        self.responses = {
            "balance": {"intent_id": "accounts.balance.check", "confidence": 0.95, "alternatives": []},
            "transfer": {
                "intent_id": "payments.transfer.internal",
                "confidence": 0.92,
                "alternatives": [],
            },
            "history": {
                "intent_id": "inquiries.transaction.search",
                "confidence": 0.88,
                "alternatives": [],
            },
            "navigation": {
                "intent_id": "support.agent.request",
                "confidence": 0.90,
                "alternatives": [],
            },
            "card_management": {
                "intent_id": "card_management",
                "confidence": 0.91,
                "alternatives": [],
            },
            "loan": {"intent_id": "loan", "confidence": 0.89, "alternatives": []},
            "investment": {
                "intent_id": "investment",
                "confidence": 0.87,
                "alternatives": [],
            },
            "dispute": {"intent_id": "dispute", "confidence": 0.93, "alternatives": []},
            "security": {"intent_id": "security", "confidence": 0.94, "alternatives": []},
            "notification": {
                "intent_id": "notification",
                "confidence": 0.86,
                "alternatives": [],
            },
            "budget": {"intent_id": "budget", "confidence": 0.88, "alternatives": []},
            "recurring": {
                "intent_id": "recurring",
                "confidence": 0.90,
                "alternatives": [],
            },
            "atm_location": {
                "intent_id": "atm_location",
                "confidence": 0.92,
                "alternatives": [],
            },
            "exchange_rate": {
                "intent_id": "exchange_rate",
                "confidence": 0.91,
                "alternatives": [],
            },
            "appointment": {
                "intent_id": "appointment",
                "confidence": 0.89,
                "alternatives": [],
            },
            "document": {"intent_id": "document", "confidence": 0.87, "alternatives": []},
            "payment": {
                "intent_id": "payment",
                "confidence": 0.90,
                "alternatives": ["transfer"],
            },
            "help": {"intent_id": "support.agent.request", "confidence": 0.85, "alternatives": []},
        }

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

        # Handle function calling
        if functions and function_call:
            func_name = function_call.get("name")
            if func_name == "extract_banking_entities":
                # Extract entities based on prompt content
                entities = {}

                # Look for amounts
                import re

                amount_match = re.search(r"\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)", prompt)
                if amount_match:
                    entities["amount"] = float(amount_match.group(1).replace(",", ""))

                # Look for recipients
                names = [
                    "john",
                    "sarah",
                    "alice",
                    "bob",
                    "david",
                    "emily",
                    "michael",
                    "mom",
                    "dad",
                ]
                for name in names:
                    if name in prompt_lower:
                        entities["recipient"] = name.title()
                        break

                # Look for account types
                if "checking" in prompt_lower:
                    entities["account_type"] = "checking"
                elif "savings" in prompt_lower:
                    entities["account_type"] = "savings"
                elif "credit" in prompt_lower:
                    entities["account_type"] = "credit"

                return {
                    "function_call": {
                        "name": "extract_banking_entities",
                        "arguments": json.dumps(entities),
                    }
                }

        if response_format and response_format.get("type") == "json_object":
            # Extract the actual query from the classification prompt
            import re

            query_match = re.search(r'Query:\s*"([^"]+)"', prompt)
            if query_match:
                query_text = query_match.group(1).lower()
            else:
                query_text = prompt_lower

            # For classification prompts, check for intents in order of specificity
            # First check for most specific/unique patterns, then more general ones
            if (
                "send" in query_text
                or "transfer" in query_text
                or "wire" in query_text
                or "move money" in query_text
                or "zelle" in query_text
                or "venmo" in query_text
            ):
                response = self.responses["transfer"].copy()

                if "extract" in prompt_lower:
                    amounts = [word for word in prompt.split() if word.startswith("$")]
                    if amounts:
                        amount = float(amounts[0].replace("$", "").replace(",", ""))
                    else:
                        amount = 500.00

                    names = [
                        "john",
                        "sarah",
                        "alice",
                        "bob",
                        "david",
                        "emily",
                        "michael",
                    ]
                    recipient = None
                    for name in names:
                        if name in prompt_lower:
                            recipient = name.title()
                            break

                    return {
                        "entities": {
                            "amount": amount,
                            "recipient": recipient or "Unknown",
                            "from_account": "checking",
                        }
                    }

                return response
            elif (
                "card" in query_text
                or "freeze" in query_text
                or "block" in query_text
                or "lost card" in query_text
                or "stolen" in query_text
                or "pin" in query_text
            ):
                return self.responses["card_management"]
            elif (
                "loan" in query_text
                or "borrow" in query_text
                or "mortgage" in query_text
                or "interest rate" in query_text
                or "refinance" in query_text
                or "credit line" in query_text
            ):
                return self.responses["loan"]
            elif (
                "invest" in query_text
                or "stock" in query_text
                or "portfolio" in query_text
                or "crypto" in query_text
                or "bitcoin" in query_text
                or "trading" in query_text
                or "buy" in query_text
                and "shares" in query_text
            ):
                return self.responses["investment"]
            elif (
                "dispute" in query_text
                or "fraud" in query_text
                or "unauthorized" in query_text
                or "wrong" in query_text
                or "chargeback" in query_text
                or "incorrect" in query_text
                or "didn't make" in query_text
            ):
                return self.responses["dispute"]
            elif (
                "security" in query_text
                or "2fa" in query_text
                or "two factor" in query_text
                or "suspicious" in query_text
                or "verify" in query_text
                or "secure" in query_text
            ):
                return self.responses["security"]
            elif (
                "alert" in query_text
                or "notify" in query_text
                or "notification" in query_text
                or "reminder" in query_text
                or "subscribe" in query_text
            ):
                return self.responses["notification"]
            elif (
                "budget" in query_text
                or "spending" in query_text
                or "savings goal" in query_text
                or "expense" in query_text
                or "track" in query_text
                and "spending" in query_text
            ):
                return self.responses["budget"]
            elif (
                "recurring" in query_text
                or "subscription" in query_text
                or "automatic" in query_text
                or "autopay" in query_text
                or "scheduled" in query_text
                or "standing order" in query_text
            ):
                return self.responses["recurring"]
            elif (
                "atm" in query_text
                or "branch" in query_text
                or "nearest" in query_text
                or "cash machine" in query_text
                or ("find" in query_text and "location" in query_text)
            ):
                return self.responses["atm_location"]
            elif (
                "exchange rate" in query_text
                or "currency" in query_text
                or "convert" in query_text
                or "forex" in query_text
                or ("yen" in query_text and "usd" in query_text)
            ):
                return self.responses["exchange_rate"]
            elif (
                "appointment" in query_text
                or "schedule" in query_text
                or "book" in query_text
                or "meeting" in query_text
                or "advisor" in query_text
                or "banker" in query_text
                or "consultation" in query_text
            ):
                return self.responses["appointment"]
            elif (
                "document" in query_text
                or "download" in query_text
                or "tax" in query_text
                or "form" in query_text
                or "1099" in query_text
                or "w2" in query_text
                or "pdf" in query_text
                or "statement pdf" in query_text
            ):
                return self.responses["document"]
            elif (
                "pay bill" in query_text
                or "payment" in query_text
                or "bill" in query_text
                or "utility" in query_text
                or "rent" in query_text
                or "mortgage payment" in query_text
            ):
                return self.responses["payment"]
            elif (
                "history" in query_text
                or "transaction" in query_text
                or "recent" in query_text
                or "activity" in query_text
                or "spent" in query_text
                or "purchase" in query_text
            ):
                return self.responses["history"]
            elif (
                "balance" in query_text
                or "how much money" in query_text
                or "funds" in query_text
                or "available" in query_text
                or "account total" in query_text
                or (
                    "how much" in query_text
                    and ("have" in query_text or "money" in query_text)
                )
                or (
                    "show" in query_text
                    and ("balance" in query_text or "account" in query_text)
                )
                or (
                    "check" in query_text
                    and ("balance" in query_text or "funds" in query_text)
                )
                or ("account" in query_text and "balance" in query_text)
                or "credit available" in query_text
                or ("what" in query_text and "balance" in query_text)
                or ("display" in query_text and "total" in query_text)
            ):
                return self.responses["balance"]
            elif (
                "help" in query_text
                or "assist" in query_text
                or "guide" in query_text
                or "tutorial" in query_text
                or "explain" in query_text
                or ("how to" in query_text)
                or ("how do" in query_text)
                or ("i need help" in query_text)
            ):
                return self.responses["help"]
            elif (
                "navigate" in query_text
                or "take me" in query_text
                or "go to" in query_text
                or "open" in query_text
                or ("show me" in query_text and "balance" not in query_text)
            ):
                return self.responses["navigation"]
            else:
                return {
                    "intent_id": "unknown",
                    "confidence": 0.0,
                    "alternatives": ["balance", "transfer", "history"],
                }

        return {"content": "Processed: " + prompt[:100]}


def create_llm_client(provider: str, api_key: str, model: str) -> LLMClient:
    if provider == "openai":
        return OpenAIClient(api_key, model)
    elif provider == "anthropic":
        return AnthropicClient(api_key, model)
    elif provider == "mock":
        return MockLLMClient()
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")
