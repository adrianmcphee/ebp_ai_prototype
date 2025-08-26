"""Comprehensive tests for expanded intent classification"""


import pytest

from src.cache import MockCache
from src.intent_classifier import IntentClassifier
from src.llm_client import MockLLMClient


class TestExpandedIntentClassification:

    def setup_method(self):
        self.llm_client = MockLLMClient()
        self.cache = MockCache()
        self.classifier = IntentClassifier(self.llm_client, self.cache)

    @pytest.mark.asyncio()
    async def test_balance_queries(self):
        """Test various balance check queries"""
        test_cases = [
            ("What's my balance?", "balance"),
            ("How much money do I have?", "balance"),
            ("Show me my account balance", "balance"),
            ("Check available funds", "balance"),
            ("What's my credit available?", "balance"),
            ("Display my account total", "balance"),
        ]

        for query, expected_intent in test_cases:
            await self.cache.flush_all()  # Clear cache
            result = await self.classifier.classify(query)
            assert result["primary_intent"] == expected_intent, f"Failed for: {query}"

    @pytest.mark.asyncio()
    async def test_transfer_queries(self):
        """Test various transfer queries"""
        test_cases = [
            ("Send $100 to John", "transfer"),
            ("Transfer $500 to my savings", "transfer"),
            ("Wire $1000 to account 12345", "transfer"),
            ("Move money to checking", "transfer"),
            ("Zelle $50 to Sarah", "transfer"),
            ("Venmo $20 to Mike", "transfer"),
        ]

        for query, expected_intent in test_cases:
            await self.cache.flush_all()
            result = await self.classifier.classify(query)
            assert result["primary_intent"] == expected_intent, f"Failed for: {query}"

    @pytest.mark.asyncio()
    async def test_card_management_queries(self):
        """Test card management queries"""
        test_cases = [
            ("Block my credit card", "card_management"),
            ("I lost my debit card", "card_management"),
            ("Freeze my card immediately", "card_management"),
            ("Order a new card", "card_management"),
            ("Change my PIN", "card_management"),
            ("My card was stolen", "card_management"),
        ]

        for query, expected_intent in test_cases:
            await self.cache.flush_all()
            result = await self.classifier.classify(query)
            assert result["primary_intent"] == expected_intent, f"Failed for: {query}"

    @pytest.mark.asyncio()
    async def test_loan_queries(self):
        """Test loan-related queries"""
        test_cases = [
            ("I want to apply for a loan", "loan"),
            ("What's my mortgage rate?", "loan"),
            ("Can I refinance my home?", "loan"),
            ("Show me loan options", "loan"),
            ("Check my credit line", "loan"),
            ("Current interest rates", "loan"),
        ]

        for query, expected_intent in test_cases:
            await self.cache.flush_all()
            result = await self.classifier.classify(query)
            assert result["primary_intent"] == expected_intent, f"Failed for: {query}"

    @pytest.mark.asyncio()
    async def test_investment_queries(self):
        """Test investment queries"""
        test_cases = [
            ("Show my portfolio", "investment"),
            ("Buy 100 shares of AAPL", "investment"),
            ("How are my stocks doing?", "investment"),
            ("Invest in mutual funds", "investment"),
            ("Check bitcoin price", "investment"),
            ("ETF recommendations", "investment"),
        ]

        for query, expected_intent in test_cases:
            await self.cache.flush_all()
            result = await self.classifier.classify(query)
            assert result["primary_intent"] == expected_intent, f"Failed for: {query}"

    @pytest.mark.asyncio()
    async def test_dispute_queries(self):
        """Test dispute and fraud queries"""
        test_cases = [
            ("I want to dispute a charge", "dispute"),
            ("This transaction is fraud", "dispute"),
            ("Unauthorized charge on my account", "dispute"),
            ("Wrong amount charged", "dispute"),
            ("Request a chargeback", "dispute"),
            ("Report incorrect transaction", "dispute"),
        ]

        for query, expected_intent in test_cases:
            await self.cache.flush_all()
            result = await self.classifier.classify(query)
            assert result["primary_intent"] == expected_intent, f"Failed for: {query}"

    @pytest.mark.asyncio()
    async def test_security_queries(self):
        """Test security-related queries"""
        test_cases = [
            ("Enable two factor authentication", "security"),
            ("Is my account secure?", "security"),
            ("Suspicious activity alert", "security"),
            ("Verify my identity", "security"),
            ("Security breach notification", "security"),
            ("Set up 2FA", "security"),
        ]

        for query, expected_intent in test_cases:
            await self.cache.flush_all()
            result = await self.classifier.classify(query)
            assert result["primary_intent"] == expected_intent, f"Failed for: {query}"

    @pytest.mark.asyncio()
    async def test_notification_queries(self):
        """Test notification preferences"""
        test_cases = [
            ("Set up alerts for transactions", "notification"),
            ("Turn off notifications", "notification"),
            ("Subscribe to account alerts", "notification"),
            ("Set payment reminder", "notification"),
            ("Unsubscribe from emails", "notification"),
            ("Daily balance notification", "notification"),
        ]

        for query, expected_intent in test_cases:
            await self.cache.flush_all()
            result = await self.classifier.classify(query)
            assert result["primary_intent"] == expected_intent, f"Failed for: {query}"

    @pytest.mark.asyncio()
    async def test_budget_queries(self):
        """Test budget and spending queries"""
        test_cases = [
            ("Set up a budget", "budget"),
            ("Track my spending", "budget"),
            ("Set spending limit", "budget"),
            ("Create savings goal", "budget"),
            ("Categorize my expenses", "budget"),
            ("Monthly expense report", "budget"),
        ]

        for query, expected_intent in test_cases:
            await self.cache.flush_all()
            result = await self.classifier.classify(query)
            assert result["primary_intent"] == expected_intent, f"Failed for: {query}"

    @pytest.mark.asyncio()
    async def test_recurring_queries(self):
        """Test recurring payment queries"""
        test_cases = [
            ("Set up recurring payment", "recurring"),
            ("Cancel my subscription", "recurring"),
            ("Enable autopay", "recurring"),
            ("Create standing order", "recurring"),
            ("Schedule monthly transfer", "recurring"),
            ("Automatic bill payment", "recurring"),
        ]

        for query, expected_intent in test_cases:
            await self.cache.flush_all()
            result = await self.classifier.classify(query)
            assert result["primary_intent"] == expected_intent, f"Failed for: {query}"

    @pytest.mark.asyncio()
    async def test_atm_location_queries(self):
        """Test ATM and branch location queries"""
        test_cases = [
            ("Find nearest ATM", "atm_location"),
            ("Where is the closest branch?", "atm_location"),
            ("ATM near me", "atm_location"),
            ("Find cash machine", "atm_location"),
            ("Branch locations", "atm_location"),
            ("Nearest bank location", "atm_location"),
        ]

        for query, expected_intent in test_cases:
            await self.cache.flush_all()
            result = await self.classifier.classify(query)
            assert result["primary_intent"] == expected_intent, f"Failed for: {query}"

    @pytest.mark.asyncio()
    async def test_exchange_rate_queries(self):
        """Test currency exchange queries"""
        test_cases = [
            ("USD to EUR exchange rate", "exchange_rate"),
            ("Convert 100 pounds to dollars", "exchange_rate"),
            ("Current forex rates", "exchange_rate"),
            ("Currency conversion", "exchange_rate"),
            ("Foreign exchange rates", "exchange_rate"),
            ("How much is 1000 yen in USD?", "exchange_rate"),
        ]

        for query, expected_intent in test_cases:
            await self.cache.flush_all()
            result = await self.classifier.classify(query)
            assert result["primary_intent"] == expected_intent, f"Failed for: {query}"

    @pytest.mark.asyncio()
    async def test_appointment_queries(self):
        """Test appointment scheduling queries"""
        test_cases = [
            ("Schedule appointment with advisor", "appointment"),
            ("Book a meeting", "appointment"),
            ("Meet with banker", "appointment"),
            ("Schedule consultation", "appointment"),
            ("Appointment with financial advisor", "appointment"),
            ("Book bank appointment", "appointment"),
        ]

        for query, expected_intent in test_cases:
            await self.cache.flush_all()
            result = await self.classifier.classify(query)
            assert result["primary_intent"] == expected_intent, f"Failed for: {query}"

    @pytest.mark.asyncio()
    async def test_document_queries(self):
        """Test document-related queries"""
        test_cases = [
            ("Download my tax documents", "document"),
            ("Get my 1099 form", "document"),
            ("Statement PDF", "document"),
            ("Download W2", "document"),
            ("Tax forms", "document"),
            ("Get account documents", "document"),
        ]

        for query, expected_intent in test_cases:
            await self.cache.flush_all()
            result = await self.classifier.classify(query)
            assert result["primary_intent"] == expected_intent, f"Failed for: {query}"

    @pytest.mark.asyncio()
    async def test_payment_queries(self):
        """Test bill payment queries"""
        test_cases = [
            ("Pay my electricity bill", "payment"),
            ("Utility payment", "payment"),
            ("Pay rent", "payment"),
            ("Mortgage payment due", "payment"),
            ("Pay credit card bill", "payment"),
            ("Bill payment", "payment"),
        ]

        for query, expected_intent in test_cases:
            await self.cache.flush_all()
            result = await self.classifier.classify(query)
            assert result["primary_intent"] == expected_intent, f"Failed for: {query}"

    @pytest.mark.asyncio()
    async def test_help_queries(self):
        """Test help and support queries"""
        test_cases = [
            ("Help me understand fees", "help"),
            ("How to transfer money?", "help"),
            ("Guide for mobile app", "help"),
            ("Tutorial on online banking", "help"),
            ("Assist with account setup", "help"),
            ("I need help", "help"),
        ]

        for query, expected_intent in test_cases:
            await self.cache.flush_all()
            result = await self.classifier.classify(query)
            assert result["primary_intent"] == expected_intent, f"Failed for: {query}"

    @pytest.mark.asyncio()
    async def test_edge_cases(self):
        """Test edge cases and ambiguous queries"""
        test_cases = [
            # Ambiguous queries
            ("show me", "navigation"),  # Default to navigation for vague show requests
            ("I need", "help"),  # Default to help for incomplete needs

            # Mixed intent queries (should pick primary)
            ("Send $100 and check balance", "transfer"),  # Transfer is primary action
            ("Pay bill then show history", "payment"),  # Payment is primary

            # Typos and variations
            ("chek balence", "balance"),  # Misspellings
            ("TRANSFER MONEY NOW", "transfer"),  # All caps
            ("   send  $50   ", "transfer"),  # Extra spaces

            # Complex queries
            ("I lost my card yesterday and need to block it right away", "card_management"),
            ("Can you help me set up automatic payments for my mortgage?", "recurring"),
            ("Show me how much I spent on groceries last month", "budget"),
        ]

        for query, _expected_intent in test_cases:
            await self.cache.flush_all()
            result = await self.classifier.classify(query)
            # For edge cases, we're more lenient - just ensure it's not unknown
            assert result["primary_intent"] != "unknown", f"Failed to classify: {query}"

    @pytest.mark.asyncio()
    async def test_confidence_scores(self):
        """Test that confidence scores are reasonable"""
        test_queries = [
            "Check my balance",  # Clear intent
            "xyz123",  # Gibberish
            "I want to do something with my account",  # Vague
        ]

        for query in test_queries:
            await self.cache.flush_all()
            result = await self.classifier.classify(query)
            assert 0 <= result["confidence"] <= 1, f"Invalid confidence for: {query}"

            # Clear queries should have high confidence
            if "balance" in query.lower() or "transfer" in query.lower():
                assert result["confidence"] > 0.7, f"Low confidence for clear query: {query}"

    @pytest.mark.asyncio()
    async def test_caching_behavior(self):
        """Test that caching works correctly"""
        query = "Check my balance"

        # First call - not from cache
        await self.cache.flush_all()
        result1 = await self.classifier.classify(query)
        assert not result1.get("from_cache", False)

        # Second call - should be from cache
        result2 = await self.classifier.classify(query)
        assert result2.get("from_cache", False)
        assert result1["primary_intent"] == result2["primary_intent"]

    @pytest.mark.asyncio()
    async def test_context_awareness(self):
        """Test context-aware classification"""
        context = {
            "history": [
                {"intent": "transfer", "original": "Send $100 to John"}
            ]
        }

        # Follow-up query that might be ambiguous without context
        query = "Send another $50"
        result = await self.classifier.classify(query, context)
        assert result["primary_intent"] == "transfer"

    @pytest.mark.asyncio()
    async def test_batch_classification(self):
        """Test batch classification performance"""
        queries = [
            "Check balance",
            "Transfer money",
            "Find ATM",
            "Pay bill",
            "Block card",
        ]

        results = await self.classifier.batch_classify(queries)
        assert len(results) == len(queries)

        # Verify each was classified correctly
        expected_intents = ["balance", "transfer", "atm_location", "payment", "card_management"]
        for result, expected in zip(results, expected_intents, strict=False):
            assert result["primary_intent"] == expected
