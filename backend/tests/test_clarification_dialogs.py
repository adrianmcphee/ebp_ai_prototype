import asyncio
from datetime import datetime

import pytest

from src.cache import MockCache
from src.database import MockDatabase
from src.entity_extractor import EntityExtractor
from src.intent_classifier import IntentClassifier
from src.llm_client import MockLLMClient
from src.mock_banking import MockBankingService
from src.pipeline import IntentPipeline
from src.state_manager import ConversationStateManager
from src.validator import EntityValidator


@pytest.fixture()
async def setup_pipeline():
    """Setup pipeline with all dependencies"""
    llm = MockLLMClient()
    cache = MockCache()
    db = MockDatabase()
    banking = MockBankingService()

    classifier = IntentClassifier(llm, cache)
    extractor = EntityExtractor(llm)
    validator = EntityValidator(banking)
    state_manager = ConversationStateManager(cache, db)

    pipeline = IntentPipeline(
        classifier, extractor, validator, state_manager, banking
    )

    return pipeline, state_manager, banking


class TestClarificationDialogs:
    """Test multi-turn clarification dialog flows"""

    async def test_recipient_disambiguation(self, setup_pipeline):
        """Test disambiguation when multiple recipients match"""
        pipeline, state_manager, banking = await setup_pipeline
        session_id = "test-session-001"

        # First query with ambiguous recipient
        result = await pipeline.process(
            query="Send $500 to John",
            session_id=session_id
        )

        # Should have disambiguation request
        assert result.get("pending_clarification") is not None
        assert result["pending_clarification"]["type"] == "recipient"
        assert len(result["pending_clarification"]["options"]) == 2  # John Smith and John Doe

        # Check state has pending clarification
        pending = await state_manager.get_pending_clarification(session_id)
        assert pending is not None
        assert pending["awaiting_response"] is True
        assert pending["original_intent"] == "transfer"

        # User selects first option
        result2 = await pipeline.process(
            query="the first one",
            session_id=session_id
        )

        # Should have resolved and executed
        assert result2["clarification_resolved"] is True
        assert result2["intent"] == "transfer"
        assert result2["entities"]["recipient"]["name"] == "John Smith"
        assert result2["execution"]["success"] is True

    async def test_numeric_selection(self, setup_pipeline):
        """Test numeric selection in clarification"""
        pipeline, state_manager, _ = await setup_pipeline
        session_id = "test-session-002"

        # Create clarification scenario
        await state_manager.add_clarification_request(
            session_id=session_id,
            clarification_type="account",
            options=[
                {"name": "Primary Checking", "id": "CHK001"},
                {"name": "Savings Account", "id": "SAV001"},
                {"name": "Business Checking", "id": "CHK002"}
            ],
            original_intent="balance",
            original_entities={},
            field_name="account"
        )

        # Test numeric selection
        result = await state_manager.resolve_clarification(session_id, "2")
        assert result["resolved"] is True
        assert result["selected_option"]["name"] == "Savings Account"

    async def test_partial_name_matching(self, setup_pipeline):
        """Test partial name matching in clarification"""
        pipeline, state_manager, _ = await setup_pipeline
        session_id = "test-session-003"

        # Create clarification scenario
        await state_manager.add_clarification_request(
            session_id=session_id,
            clarification_type="recipient",
            options=[
                {"name": "John Smith", "id": "RCP001"},
                {"name": "John Doe", "id": "RCP002"}
            ],
            original_intent="transfer",
            original_entities={"amount": 500},
            field_name="recipient"
        )

        # Test partial matching
        result = await state_manager.resolve_clarification(session_id, "Smith")
        assert result["resolved"] is True
        assert result["selected_option"]["name"] == "John Smith"

    async def test_invalid_clarification_response(self, setup_pipeline):
        """Test handling of invalid clarification response"""
        pipeline, state_manager, _ = await setup_pipeline
        session_id = "test-session-004"

        # Setup clarification
        await state_manager.add_clarification_request(
            session_id=session_id,
            clarification_type="recipient",
            options=[
                {"name": "John Smith", "id": "RCP001"},
                {"name": "John Doe", "id": "RCP002"}
            ],
            original_intent="transfer",
            original_entities={"amount": 500},
            field_name="recipient"
        )

        # Invalid response
        result = await pipeline.process(
            query="I don't know",
            session_id=session_id
        )

        # Should provide help
        assert result.get("clarification_help") is not None
        assert "Please select one" in result["clarification_help"]["message"]
        assert len(result["clarification_help"]["options"]) == 2

    async def test_clarification_timeout(self, setup_pipeline):
        """Test clarification expiration after timeout"""
        _, state_manager, _ = await setup_pipeline
        session_id = "test-session-005"

        # Create clarification that's expired
        context = await state_manager.get_context(session_id)
        context["pending_clarification"] = {
            "type": "recipient",
            "options": [{"name": "Test"}],
            "original_intent": "transfer",
            "original_entities": {},
            "awaiting_response": True,
            "created_at": (datetime.now().timestamp() - 3700)  # Over 1 hour old
        }
        await state_manager._save_context(session_id, context)

        # Should not resolve due to timeout
        result = await state_manager.resolve_clarification(session_id, "Test")
        assert result is None


class TestTransactionApproval:
    """Test transaction approval flows"""

    async def test_high_value_transfer_requires_approval(self, setup_pipeline):
        """Test that high-value transfers trigger approval flow"""
        pipeline, state_manager, banking = await setup_pipeline
        session_id = "test-session-006"

        # High-value transfer
        result = await pipeline.process(
            query="Transfer $15000 to Sarah Johnson",
            session_id=session_id
        )

        # Should require approval
        assert result.get("requires_approval") is True
        assert result.get("approval") is not None
        assert result["approval"]["approval_method"] == "biometric"
        assert "APV-" in result["approval"]["token"]

        # Check approval context in state
        approval = await state_manager.get_pending_approval(session_id)
        assert approval is not None
        assert approval["amount"] == 15000
        assert approval["awaiting_approval"] is True

    async def test_biometric_approval_success(self, setup_pipeline):
        """Test successful biometric approval"""
        pipeline, state_manager, _ = await setup_pipeline
        session_id = "test-session-007"

        # Setup approval context
        await state_manager.add_approval_request(
            session_id=session_id,
            transaction_type="transfer",
            amount=15000,
            details={
                "from_account": "CHK001",
                "recipient_id": "RCP003",
                "amount": 15000,
                "reference": "Test transfer"
            }
        )

        # Simulate biometric approval
        result = await pipeline.process(
            query="approve with fingerprint",
            session_id=session_id
        )

        # Should be approved and executed
        assert result["approval_result"] == "approved"
        assert result["execution"]["success"] is True

    async def test_approval_failure_max_attempts(self, setup_pipeline):
        """Test approval failure after max attempts"""
        _, state_manager, _ = await setup_pipeline
        session_id = "test-session-008"

        # Setup approval
        await state_manager.add_approval_request(
            session_id=session_id,
            transaction_type="transfer",
            amount=15000,
            details={"amount": 15000}
        )

        # Fail 3 times
        for i in range(3):
            result = await state_manager.verify_approval(
                session_id,
                {"pin": "wrong"}
            )
            assert result["approved"] is False

            if i < 2:
                assert result.get("attempts_remaining") == 2 - i
            else:
                assert result["error"] == "Max attempts exceeded"

        # Approval should be cleared
        approval = await state_manager.get_pending_approval(session_id)
        assert approval is None

    async def test_approval_expiration(self, setup_pipeline):
        """Test approval expiration after timeout"""
        _, state_manager, _ = await setup_pipeline
        session_id = "test-session-009"

        # Create expired approval
        context = await state_manager.get_context(session_id)
        context["approval_context"] = {
            "transaction_type": "transfer",
            "amount": 15000,
            "awaiting_approval": True,
            "expires_at": datetime.now().timestamp() - 1  # Already expired
        }
        await state_manager._save_context(session_id, context)

        # Should return None due to expiration
        approval = await state_manager.get_pending_approval(session_id)
        assert approval is None

    async def test_different_approval_thresholds(self, setup_pipeline):
        """Test different approval methods for different amounts"""
        _, _, banking = await setup_pipeline

        # Under threshold - no approval needed
        result1 = await banking.request_transaction_approval(
            "transfer", 5000, {}
        )
        assert result1["requires_approval"] is False

        # Medium amount - PIN approval
        result2 = await banking.request_transaction_approval(
            "transfer", 15000, {}
        )
        assert result2["requires_approval"] is True
        assert result2["approval_method"] == "pin"

        # High amount - Biometric approval
        result3 = await banking.request_transaction_approval(
            "transfer", 30000, {}
        )
        assert result3["requires_approval"] is True
        assert result3["approval_method"] == "biometric"

        # Very high amount - Biometric + PIN
        result4 = await banking.request_transaction_approval(
            "transfer", 60000, {}
        )
        assert result4["requires_approval"] is True
        assert result4["approval_method"] == "biometric_and_pin"


class TestClarificationIntegration:
    """Test integration of clarification with other features"""

    async def test_clarification_with_context_resolution(self, setup_pipeline):
        """Test clarification working with context resolution"""
        pipeline, state_manager, _ = await setup_pipeline
        session_id = "test-session-010"

        # First transfer
        await pipeline.process(
            query="Send $500 to Sarah Johnson",
            session_id=session_id
        )

        # Second transfer with pronoun and ambiguous name
        result = await pipeline.process(
            query="Send another $200 to John",
            session_id=session_id
        )

        # Should have clarification for John, but amount should be resolved
        assert result.get("pending_clarification") is not None
        assert result["pending_clarification"]["type"] == "recipient"

        # Check entities have resolved amount
        pending = await state_manager.get_pending_clarification(session_id)
        assert pending["original_entities"]["amount"] == 200

    async def test_clarification_then_approval(self, setup_pipeline):
        """Test flow: clarification -> high-value -> approval"""
        pipeline, state_manager, _ = await setup_pipeline
        session_id = "test-session-011"

        # Ambiguous high-value transfer
        result1 = await pipeline.process(
            query="Transfer $20000 to John",
            session_id=session_id
        )

        # Should need clarification first
        assert result1.get("pending_clarification") is not None

        # Clarify recipient
        result2 = await pipeline.process(
            query="John Smith please",
            session_id=session_id
        )

        # Should now need approval
        assert result2.get("requires_approval") is True
        assert result2["approval"]["approval_method"] == "biometric"

        # Approve transaction
        result3 = await pipeline.process(
            query="approve with face id",
            session_id=session_id
        )

        # Should be executed
        assert result3["approval_result"] == "approved"
        assert result3["execution"]["success"] is True


if __name__ == "__main__":
    asyncio.run(pytest.main([__file__, "-v"]))
