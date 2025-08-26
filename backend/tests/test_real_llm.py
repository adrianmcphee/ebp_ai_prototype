"""Tests for real LLM providers (requires API keys)"""

import os

import pytest

from src.llm_observability import init_observability
from src.llm_wrapper import EnhancedLLMClient, LLMProvider, create_enhanced_llm_client

# Skip these tests if no API keys are configured
SKIP_OPENAI = not os.getenv("OPENAI_API_KEY")
SKIP_ANTHROPIC = not os.getenv("ANTHROPIC_API_KEY")


@pytest.fixture()
def observability():
    """Initialize observability for tests"""
    return init_observability(
        enabled=bool(os.getenv("LANGFUSE_PUBLIC_KEY")),
        environment="test"
    )


class TestRealLLMProviders:
    """Test real LLM providers (run with API keys configured)"""

    @pytest.mark.skipif(SKIP_ANTHROPIC, reason="No Anthropic API key")
    @pytest.mark.asyncio()
    async def test_anthropic_claude(self, observability):
        """Test Anthropic Claude models"""
        client = EnhancedLLMClient(
            provider=LLMProvider.ANTHROPIC,
            model="claude-3-haiku-20240307",  # Cheapest/fastest
            observability_enabled=True
        )

        # Test simple completion
        result = await client.complete(
            prompt="What is 2+2? Reply with just the number.",
            temperature=0.0,
            max_tokens=10
        )

        assert "content" in result or "error" not in result
        assert "4" in str(result.get("content", ""))

        # Test JSON response
        json_prompt = """
        Classify this banking query: "Check my balance"

        Respond with JSON:
        {
            "intent": "balance|transfer|history|other",
            "confidence": 0.0-1.0
        }
        """

        json_result = await client.complete(
            prompt=json_prompt,
            temperature=0.0,
            response_format={"type": "json_object"},
            max_tokens=100
        )

        assert "intent" in json_result
        assert json_result["intent"] == "balance"
        assert 0 <= json_result["confidence"] <= 1

        # Check metrics
        metrics = client.get_metrics()
        assert metrics["total_calls"] == 2
        assert metrics["errors"] == 0

    @pytest.mark.skipif(SKIP_OPENAI, reason="No OpenAI API key")
    @pytest.mark.asyncio()
    async def test_openai_gpt(self, observability):
        """Test OpenAI GPT models"""
        client = EnhancedLLMClient(
            provider=LLMProvider.OPENAI,
            model="gpt-4o-mini",  # Cheapest/fastest
            observability_enabled=True
        )

        # Test simple completion
        result = await client.complete(
            prompt="What is the capital of France? Reply with just the city name.",
            temperature=0.0,
            max_tokens=10
        )

        assert "content" in result or "error" not in result
        assert "Paris" in str(result.get("content", ""))

        # Test entity extraction
        entity_prompt = """
        Extract entities from: "Send $500 to John Smith tomorrow"

        Return JSON with: amount, recipient, date
        """

        entity_result = await client.complete(
            prompt=entity_prompt,
            temperature=0.0,
            response_format={"type": "json_object"},
            max_tokens=100
        )

        assert "amount" in entity_result or 500 in str(entity_result)
        assert "John Smith" in str(entity_result) or "recipient" in entity_result

    @pytest.mark.skipif(SKIP_ANTHROPIC and SKIP_OPENAI, reason="No API keys")
    @pytest.mark.asyncio()
    async def test_provider_switching(self, observability):
        """Test switching between providers"""
        # Start with mock
        client = create_enhanced_llm_client(provider="mock")

        result1 = await client.complete(
            prompt="Check my balance",
            response_format={"type": "json_object"}
        )
        assert result1["_metadata"]["provider"] == "mock"

        # Switch to real provider if available
        if not SKIP_ANTHROPIC:
            client.switch_provider(
                LLMProvider.ANTHROPIC,
                model="claude-3-haiku-20240307"
            )

            result2 = await client.complete(
                prompt="What is 1+1? Just the number.",
                max_tokens=10
            )
            assert result2["_metadata"]["provider"] == "anthropic"

        elif not SKIP_OPENAI:
            client.switch_provider(
                LLMProvider.OPENAI,
                model="gpt-4o-mini"
            )

            result2 = await client.complete(
                prompt="What is 1+1? Just the number.",
                max_tokens=10
            )
            assert result2["_metadata"]["provider"] == "openai"

    @pytest.mark.skipif(SKIP_ANTHROPIC or SKIP_OPENAI, reason="Need both providers for fallback")
    @pytest.mark.asyncio()
    async def test_fallback_mechanism(self, observability):
        """Test fallback from one provider to another"""
        client = EnhancedLLMClient(
            provider=LLMProvider.ANTHROPIC,
            model="claude-3-haiku-20240307",
            fallback_provider=LLMProvider.OPENAI,
            fallback_model="gpt-4o-mini",
            observability_enabled=True
        )

        # Normal operation
        result = await client.complete(
            prompt="Say 'hello'",
            max_tokens=10
        )
        assert not result["_metadata"]["fallback"]

        # Simulate failure by using invalid model
        client.model = "invalid-model-xxx"

        result = await client.complete(
            prompt="Say 'hello'",
            max_tokens=10
        )

        # Should have used fallback
        assert result["_metadata"]["fallback"]
        assert "primary_error" in result["_metadata"]

    @pytest.mark.asyncio()
    async def test_mock_as_fallback(self, observability):
        """Test using mock as fallback when real providers fail"""
        # Use mock as fallback for a fake provider
        client = EnhancedLLMClient(
            provider=LLMProvider.OPENAI,
            model="gpt-4o-mini",
            api_key="invalid-key-xxx",  # Invalid key
            fallback_provider=LLMProvider.MOCK,
            observability_enabled=True
        )

        # Should fall back to mock
        result = await client.complete(
            prompt="Check my balance",
            response_format={"type": "json_object"}
        )

        assert result["_metadata"]["fallback"]
        assert "intent" in result  # Mock returns intent

        metrics = client.get_metrics()
        assert metrics["fallback_used"] == 1


class TestCostTracking:
    """Test cost tracking for different providers"""

    @pytest.mark.skipif(SKIP_ANTHROPIC, reason="No Anthropic API key")
    @pytest.mark.asyncio()
    async def test_anthropic_cost_tracking(self):
        """Test cost tracking for Anthropic"""
        from src.llm_client import AnthropicClient

        client = AnthropicClient(
            api_key=os.getenv("ANTHROPIC_API_KEY"),
            model="claude-3-haiku-20240307"
        )

        # Make a request
        await client.complete(
            prompt="Count to 5",
            max_tokens=20
        )

        # Check cost tracking
        assert hasattr(client, "total_cost")
        assert client.total_cost > 0
        assert client.total_tokens > 0

        print(f"Anthropic cost: ${client.total_cost:.6f} for {client.total_tokens} tokens")

    @pytest.mark.skipif(SKIP_OPENAI, reason="No OpenAI API key")
    @pytest.mark.asyncio()
    async def test_openai_cost_tracking(self):
        """Test cost tracking for OpenAI"""
        from src.llm_client import OpenAIClient

        client = OpenAIClient(
            api_key=os.getenv("OPENAI_API_KEY"),
            model="gpt-4o-mini"
        )

        # Make a request
        await client.complete(
            prompt="Count to 5",
            max_tokens=20
        )

        # Check cost tracking
        assert hasattr(client, "total_cost")
        assert client.total_cost > 0
        assert client.total_tokens > 0

        print(f"OpenAI cost: ${client.total_cost:.6f} for {client.total_tokens} tokens")


class TestBankingIntents:
    """Test banking-specific intents with real LLMs"""

    @pytest.mark.skipif(SKIP_ANTHROPIC and SKIP_OPENAI, reason="No API keys")
    @pytest.mark.asyncio()
    async def test_intent_classification(self):
        """Test intent classification with real LLM"""
        # Use whichever provider is available
        if not SKIP_ANTHROPIC:
            provider = LLMProvider.ANTHROPIC
            model = "claude-3-haiku-20240307"
        else:
            provider = LLMProvider.OPENAI
            model = "gpt-4o-mini"

        client = EnhancedLLMClient(provider=provider, model=model)

        test_queries = [
            ("What's my checking account balance?", "balance"),
            ("Send $500 to John Smith", "transfer"),
            ("Show my recent transactions", "history"),
            ("Block my credit card", "card_management"),
            ("I want to dispute a charge", "dispute"),
        ]

        for query, expected_intent in test_queries:
            prompt = f"""
            Classify this banking query into one intent:
            balance, transfer, history, payment, card_management, dispute, other

            Query: "{query}"

            Respond with JSON:
            {{"intent": "<intent>", "confidence": 0.0-1.0}}
            """

            result = await client.complete(
                prompt=prompt,
                temperature=0.0,
                response_format={"type": "json_object"},
                max_tokens=50
            )

            assert "intent" in result
            assert result["intent"] == expected_intent, f"Expected {expected_intent}, got {result['intent']} for: {query}"
            assert result["confidence"] > 0.5

    @pytest.mark.skipif(SKIP_ANTHROPIC and SKIP_OPENAI, reason="No API keys")
    @pytest.mark.asyncio()
    async def test_entity_extraction(self):
        """Test entity extraction with real LLM"""
        # Use whichever provider is available
        if not SKIP_ANTHROPIC:
            provider = LLMProvider.ANTHROPIC
            model = "claude-3-haiku-20240307"
        else:
            provider = LLMProvider.OPENAI
            model = "gpt-4o-mini"

        client = EnhancedLLMClient(provider=provider, model=model)

        test_cases = [
            (
                "Transfer $1,234.56 to Alice Johnson from my savings account",
                {"amount": 1234.56, "recipient": "Alice Johnson", "from_account": "savings"}
            ),
            (
                "Pay my electricity bill of $125.50",
                {"amount": 125.50, "bill_type": "electricity"}
            ),
        ]

        for query, expected_entities in test_cases:
            prompt = f"""
            Extract entities from this banking query.

            Query: "{query}"

            Return JSON with relevant fields like: amount, recipient, from_account, bill_type, etc.
            Only include fields that are present in the query.
            """

            result = await client.complete(
                prompt=prompt,
                temperature=0.0,
                response_format={"type": "json_object"},
                max_tokens=100
            )

            # Check that expected entities are present
            for key, value in expected_entities.items():
                assert key in result, f"Missing key: {key}"
                if isinstance(value, int | float):
                    assert abs(result[key] - value) < 0.01, f"Amount mismatch: {result[key]} vs {value}"
                else:
                    assert value.lower() in str(result[key]).lower(), f"Value mismatch for {key}: {result[key]} vs {value}"


# Command to run these tests:
# pytest tests/test_real_llm.py -v -k "not skip" --tb=short
#
# With specific provider:
# ANTHROPIC_API_KEY=your_key pytest tests/test_real_llm.py -v -k anthropic
# OPENAI_API_KEY=your_key pytest tests/test_real_llm.py -v -k openai
#
# With observability:
# LANGFUSE_PUBLIC_KEY=pk_... LANGFUSE_SECRET_KEY=sk_... pytest tests/test_real_llm.py -v
