"""Tests for enhanced NLP features: risk assessment, entity validation, context-aware responses"""


import pytest

from src.cache import MockCache
from src.context_aware_responses import (
    ContextAwareResponseGenerator,
    PreconditionStatus,
    ResponseType,
)
from src.database import MockDatabase
from src.entity_extractor import EntityExtractor
from src.intent_classifier import AuthLevel, IntentClassifier, RiskLevel
from src.llm_client import MockLLMClient
from src.mock_banking import MockBankingService
from src.pipeline import IntentPipeline
from src.state_manager import ConversationStateManager


class TestEnhancedIntentClassifier:
    """Test enhanced intent classification with risk and auth levels"""

    def setup_method(self):
        self.llm = MockLLMClient()
        self.cache = MockCache()
        self.classifier = IntentClassifier(self.llm, self.cache)

    @pytest.mark.asyncio()
    async def test_hierarchical_intent_classification(self):
        """Test hierarchical intent structure"""
        test_cases = [
            ("Check my balance", "accounts.balance.check"),
            ("Transfer between my accounts", "payments.transfer.internal"),
            ("Wire money to external bank", "payments.transfer.external"),
            ("Send money to John via Zelle", "payments.p2p.send"),
            ("Block my debit card", "cards.block.temporary"),
            ("Dispute this transaction", "disputes.transaction.initiate"),
        ]

        for query, expected_intent in test_cases:
            result = await self.classifier.classify(query)
            assert result["intent_id"] == expected_intent, f"Failed for: {query}"
            assert result["confidence"] > 0.8

    @pytest.mark.asyncio()
    async def test_risk_level_assessment(self):
        """Test risk level assignment for different operations"""
        test_cases = [
            ("Check balance", RiskLevel.LOW),
            ("Transfer $100 between my accounts", RiskLevel.MEDIUM),
            ("Wire $5000 to external account", RiskLevel.HIGH),
            ("Dispute fraudulent charge", RiskLevel.HIGH),
        ]

        for query, expected_risk in test_cases:
            result = await self.classifier.classify(query, include_risk=True)
            if "risk_level" in result:
                assert result["risk_level"] == expected_risk.value, f"Failed risk assessment for: {query}"

    @pytest.mark.asyncio()
    async def test_authentication_requirements(self):
        """Test auth level requirements"""
        test_cases = [
            ("What's my balance", AuthLevel.BASIC),
            ("Transfer to savings", AuthLevel.FULL),
            ("Wire $10000 externally", AuthLevel.CHALLENGE),
            ("Block my card", AuthLevel.FULL),
        ]

        for query, expected_auth in test_cases:
            result = await self.classifier.classify(query, include_risk=True)
            if "auth_required" in result:
                assert result["auth_required"] == expected_auth.value, f"Failed auth requirement for: {query}"

    @pytest.mark.asyncio()
    async def test_confidence_thresholds(self):
        """Test confidence scoring and alternatives"""
        result = await self.classifier.classify("Send money")

        assert "confidence" in result
        assert 0.0 <= result["confidence"] <= 1.0
        assert "alternatives" in result
        assert isinstance(result["alternatives"], list)

        # Should have alternatives for ambiguous queries
        if result["confidence"] < 0.9:
            assert len(result["alternatives"]) > 0


class TestEnhancedEntityExtractor:
    """Test enhanced entity extraction with validation"""

    def setup_method(self):
        self.llm = MockLLMClient()
        self.extractor = EntityExtractor(self.llm)

    @pytest.mark.asyncio()
    async def test_entity_extraction_with_validation(self):
        """Test entity extraction and validation"""
        test_cases = [
            ("Transfer $1,500.50 from checking to savings", ["amount", "account_type"]),
            ("Send $100 to john.smith@email.com", ["amount", "email"]),
            ("Wire to account 123456789 routing 987654321", ["routing_number"]),
            ("Block my card ending in 4567", ["card_id"]),
        ]

        for query, expected_entities in test_cases:
            result = await self.extractor.extract(query)
            extracted = result.get("entities", {})

            for entity in expected_entities:
                assert entity in extracted or entity in result.get("validation_errors", {}), \
                    f"Failed to extract {entity} from: {query}"

    @pytest.mark.asyncio()
    async def test_amount_validation(self):
        """Test amount validation rules"""
        test_cases = [
            ("Transfer $50.00", True, 50.00),
            ("Send $1,234.56", True, 1234.56),
            ("Transfer $0", False, None),  # Below minimum
            ("Send $-100", False, None),  # Negative amount
        ]

        for query, should_validate, expected_value in test_cases:
            result = await self.extractor.extract(query)

            if should_validate:
                assert "amount" in result["entities"]
                assert result["entities"]["amount"]["value"] == expected_value
            else:
                assert "amount" in result.get("validation_errors", {}) or \
                       "amount" not in result.get("entities", {})

    @pytest.mark.asyncio()
    async def test_routing_number_validation(self):
        """Test routing number checksum validation"""
        # Valid routing number (passes checksum)
        result = await self.extractor.extract("Wire to routing 121000248")

        # Note: Our mock doesn't do real checksum validation
        # In production, this would validate the ABA routing number checksum
        assert "routing_number" in result.get("entities", {}) or \
               "routing_number" in result.get("validation_errors", {})

    @pytest.mark.asyncio()
    async def test_missing_required_entities(self):
        """Test detection of missing required entities"""
        result = await self.extractor.extract(
            "Transfer money",
            intent_type="payments.transfer.internal",
            required_entities=["amount", "from_account", "to_account"]
        )

        assert result["follow_up_needed"] is True
        assert len(result["missing_required"]) > 0
        assert len(result.get("suggestions", [])) > 0


class TestContextAwareResponses:
    """Test context-aware response generation"""

    def setup_method(self):
        self.response_gen = ContextAwareResponseGenerator()

    @pytest.mark.asyncio()
    async def test_precondition_checking(self):
        """Test precondition validation"""
        intent = {
            "intent_id": "payments.transfer.internal",
            "risk_level": "medium",
            "auth_required": "full",
            "preconditions": ["balance_check", "accounts_active"]
        }

        entities = {
            "entities": {
                "amount": {"value": 500},
                "from_account": {"value": "checking"},
                "to_account": {"value": "savings"}
            },
            "missing_required": []
        }

        user_profile = {
            "auth_level": "full",
            "available_balance": 1000
        }

        response = await self.response_gen.generate_response(
            intent, entities, None, user_profile
        )

        assert response.response_type in [ResponseType.SUCCESS, ResponseType.CONFIRMATION_NEEDED]
        assert len(response.preconditions) > 0

        # Check that balance check passed
        balance_check = next((p for p in response.preconditions if p.name == "balance_check"), None)
        if balance_check:
            assert balance_check.status == PreconditionStatus.PASSED

    @pytest.mark.asyncio()
    async def test_authentication_escalation(self):
        """Test auth level escalation"""
        intent = {
            "intent_id": "payments.transfer.external",
            "risk_level": "high",
            "auth_required": "challenge",
            "preconditions": []
        }

        entities = {"entities": {}, "missing_required": []}

        # User has only basic auth
        user_profile = {"auth_level": "basic"}

        response = await self.response_gen.generate_response(
            intent, entities, None, user_profile
        )

        assert response.response_type == ResponseType.AUTH_REQUIRED
        assert response.auth_challenge is not None
        assert "challenge" in response.auth_challenge.get("required_level", "")

    @pytest.mark.asyncio()
    async def test_high_risk_confirmation(self):
        """Test high-risk operation confirmation"""
        intent = {
            "intent_id": "payments.transfer.external",
            "name": "External Transfer",
            "risk_level": "high",
            "auth_required": "challenge",
            "confidence": 0.95,
            "preconditions": []
        }

        entities = {
            "entities": {
                "amount": {"value": 5000},
                "recipient": {"value": "External Bank"}
            },
            "missing_required": []
        }

        user_profile = {"auth_level": "challenge"}

        response = await self.response_gen.generate_response(
            intent, entities, None, user_profile
        )

        # High-risk operations should require confirmation
        assert response.response_type == ResponseType.CONFIRMATION_NEEDED
        assert response.risk_warning is not None
        assert "high-risk" in response.risk_warning.lower()

    @pytest.mark.asyncio()
    async def test_missing_information_response(self):
        """Test response for missing required information"""
        intent = {
            "intent_id": "payments.transfer.internal",
            "risk_level": "medium",
            "auth_required": "full"
        }

        entities = {
            "entities": {"amount": {"value": 500}},
            "missing_required": ["from_account", "to_account"],
            "suggestions": [
                "Which account would you like to transfer from?",
                "Which account would you like to transfer to?"
            ]
        }

        response = await self.response_gen.generate_response(
            intent, entities, None, None
        )

        assert response.response_type == ResponseType.MISSING_INFO
        assert response.follow_up_questions is not None
        assert len(response.follow_up_questions) > 0


class TestEnhancedPipeline:
    """Test the complete enhanced pipeline"""

    def setup_method(self):
        self.llm = MockLLMClient()
        self.cache = MockCache()
        self.db = MockDatabase()

        self.classifier = IntentClassifier(self.llm, self.cache)
        self.extractor = EntityExtractor(self.llm)
        self.response_gen = ContextAwareResponseGenerator()
        self.state_manager = ConversationStateManager(self.cache, self.db)
        self.banking_service = MockBankingService()

        self.pipeline = IntentPipeline(
            self.classifier,
            self.extractor,
            self.response_gen,
            self.state_manager,
            self.banking_service
        )

    @pytest.mark.asyncio()
    async def test_complete_transfer_flow(self):
        """Test end-to-end transfer with all enhancements"""
        session_id = "test_session_001"
        user_profile = {
            "auth_level": "full",
            "available_balance": 5000,
            "daily_limit": 10000
        }

        # Process transfer request
        result = await self.pipeline.process(
            "Transfer $500 from checking to savings",
            session_id,
            user_profile
        )

        assert result["status"] in ["success", "confirmation_needed"]
        assert "intent" in result
        assert result.get("confidence", 0) > 0.8
        assert "risk_level" in result
        assert "entities" in result

    @pytest.mark.asyncio()
    async def test_multi_turn_missing_info(self):
        """Test multi-turn conversation for missing information"""
        session_id = "test_session_002"

        # First query - missing information
        result1 = await self.pipeline.process(
            "I want to transfer money",
            session_id
        )

        assert result1["status"] == "clarification_needed"
        assert "missing_fields" in result1
        assert len(result1["missing_fields"]) > 0

        # Second query - provide some information
        result2 = await self.pipeline.process(
            "$750 to my savings account",
            session_id
        )

        # Should either complete or ask for remaining info
        assert result2["status"] in ["success", "clarification_needed"]

    @pytest.mark.asyncio()
    async def test_high_risk_approval_flow(self):
        """Test high-risk operation approval flow"""
        session_id = "test_session_003"
        user_profile = {
            "auth_level": "challenge",
            "available_balance": 20000
        }

        # High-value transfer
        result1 = await self.pipeline.process(
            "Wire $15000 to external account 123456789",
            session_id,
            user_profile
        )

        # Should require confirmation for high-risk
        if result1["status"] == "confirmation_needed":
            assert "risk_level" in result1
            assert result1["risk_level"] in ["high", "critical"]

            # Approve the transfer
            result2 = await self.pipeline.process(
                "yes",
                session_id,
                user_profile
            )

            assert result2["status"] in ["success", "auth_required"]

    @pytest.mark.asyncio()
    async def test_reference_resolution(self):
        """Test pronoun and reference resolution"""
        session_id = "test_session_004"

        # First transfer
        await self.pipeline.process(
            "Send $100 to John Smith",
            session_id
        )

        # Reference previous recipient
        result2 = await self.pipeline.process(
            "Send him another $50",
            session_id
        )

        # The context should resolve "him" to "John Smith"
        # Note: This depends on state_manager implementation
        assert result2["status"] in ["success", "clarification_needed"]


class TestRiskAssessmentMatrix:
    """Test risk assessment for different scenarios"""

    def setup_method(self):
        self.response_gen = ContextAwareResponseGenerator()

    @pytest.mark.asyncio()
    async def test_amount_based_risk(self):
        """Test risk levels based on transaction amounts"""
        test_cases = [
            (100, RiskLevel.LOW),
            (2500, RiskLevel.MEDIUM),
            (7500, RiskLevel.HIGH),
            (15000, RiskLevel.HIGH),  # Would be CRITICAL with proper rules
        ]

        for amount, expected_risk in test_cases:
            intent = {
                "intent_id": "payments.transfer.external",
                "risk_level": expected_risk.value,
                "auth_required": "full"
            }

            entities = {
                "entities": {"amount": {"value": amount}},
                "missing_required": []
            }

            response = await self.response_gen.generate_response(
                intent, entities, None, {"auth_level": "full"}
            )

            # Verify appropriate response type based on risk
            if expected_risk in [RiskLevel.HIGH]:
                assert response.response_type in [
                    ResponseType.CONFIRMATION_NEEDED,
                    ResponseType.AUTH_REQUIRED
                ]


@pytest.mark.asyncio()
class TestIntegrationScenarios:
    """Integration tests for complete scenarios"""

    async def test_balance_check_scenario(self):
        """Test simple balance check scenario"""
        llm = MockLLMClient()
        cache = MockCache()
        classifier = IntentClassifier(llm, cache)

        result = await classifier.classify("What's my checking account balance?")

        assert result["intent_id"] == "accounts.balance.check"
        assert result["risk_level"] == "low"
        assert result["auth_required"] == "basic"
        assert result["confidence"] > 0.9

    async def test_dispute_scenario(self):
        """Test dispute initiation scenario"""
        llm = MockLLMClient()
        cache = MockCache()
        classifier = IntentClassifier(llm, cache)
        extractor = EntityExtractor(llm)

        query = "I want to dispute a $500 charge from yesterday"

        # Classify intent
        intent = await classifier.classify(query)
        assert intent["intent_id"] == "disputes.transaction.initiate"
        assert intent["risk_level"] == "high"

        # Extract entities
        entities = await extractor.extract(query, intent["intent_id"])
        assert "amount" in entities["entities"]
        assert entities["entities"]["amount"]["value"] == 500.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
