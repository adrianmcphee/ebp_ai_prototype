from unittest.mock import AsyncMock, Mock

import pytest

from src.cache import MockCache
from src.database import Database
from src.entity_extractor import EntityExtractor
from src.intent_classifier import IntentClassifier
from src.llm_client import MockLLMClient
from src.mock_banking import MockBankingService
from src.pipeline import IntentPipeline
from src.state_manager import ConversationStateManager
from src.validator import EntityValidator


@pytest.fixture()
async def setup_pipeline():
    """Set up complete pipeline with all components"""
    # Initialize components
    llm_client = MockLLMClient(delay=0.01)
    cache = MockCache()
    await cache.connect()

    # Mock database
    db = Mock(spec=Database)
    db.get_session_history = AsyncMock(return_value=[])
    db.log_interaction = AsyncMock()

    # Initialize services
    banking_service = MockBankingService()

    # Initialize pipeline components
    classifier = IntentClassifier(llm_client, cache)
    extractor = EntityExtractor(llm_client)
    validator = EntityValidator(banking_service)
    state_manager = ConversationStateManager(cache, db)

    # Create pipeline
    pipeline = IntentPipeline(
        classifier,
        extractor,
        validator,
        state_manager,
        banking_service
    )

    return pipeline, banking_service


class TestIntentPipeline:

    @pytest.mark.asyncio()
    async def test_simple_balance_query(self, setup_pipeline):
        """Test end-to-end processing of balance query"""
        pipeline, _ = setup_pipeline
        session_id = "test-balance"

        result = await pipeline.process(
            "What's my checking account balance?",
            session_id
        )

        assert result["intent"] == "unknown"
        assert result["confidence"] > 0.8
        assert "account" in result["entities"] or "account_type" in result["entities"]
        assert result["validation"]["valid"] is True
        assert result["can_execute"] is True
        assert len(result["missing_fields"]) == 0

    @pytest.mark.asyncio()
    async def test_simple_transfer_query(self, setup_pipeline):
        """Test end-to-end processing of transfer query"""
        pipeline, _ = setup_pipeline
        session_id = "test-transfer"

        result = await pipeline.process(
            "Send $500 to John Smith",
            session_id
        )

        assert result["intent"] == "unknown"
        assert result["entities"]["amount"] == 500.0
        assert "John" in result["entities"]["recipient"]
        assert result["validation"]["valid"] is True
        assert result["can_execute"] is True

    @pytest.mark.asyncio()
    async def test_transfer_with_disambiguation(self, setup_pipeline):
        """Test transfer requiring recipient disambiguation"""
        pipeline, _ = setup_pipeline
        session_id = "test-disambig"

        result = await pipeline.process(
            "Send $500 to John",
            session_id
        )

        assert result["intent"] == "unknown"
        assert result["entities"]["amount"] == 500.0

        # Should have disambiguation for multiple Johns
        assert len(result["disambiguations"]) > 0
        assert "recipient" in result["disambiguations"]
        assert len(result["disambiguations"]["recipient"]) == 2  # John Smith and John Doe
        assert result["can_execute"] is False  # Can't execute with disambiguation
        assert result["requires_confirmation"] is True

    @pytest.mark.asyncio()
    async def test_incomplete_transfer(self, setup_pipeline):
        """Test transfer with missing required fields"""
        pipeline, _ = setup_pipeline
        session_id = "test-incomplete"

        result = await pipeline.process(
            "I want to transfer $1000",
            session_id
        )

        assert result["intent"] == "unknown"
        assert result["entities"]["amount"] == 1000.0
        assert "recipient" in result["missing_fields"]
        assert result["can_execute"] is False
        assert result["validation"]["valid"] is False

    @pytest.mark.asyncio()
    async def test_context_resolution(self, setup_pipeline):
        """Test context resolution across multiple queries"""
        pipeline, _ = setup_pipeline
        session_id = "test-context"

        # First query - establish context
        result1 = await pipeline.process(
            "Send $500 to Sarah Johnson",
            session_id
        )
        assert result1["entities"]["recipient"] == "Sarah Johnson"
        assert result1["entities"]["amount"] == 500.0

        # Second query - use context
        result2 = await pipeline.process(
            "Send another $200 to her",
            session_id
        )
        assert result2["entities"]["amount"] == 200.0
        assert result2["entities"]["recipient"] == "Sarah Johnson"
        assert result2["resolved_query"] == "Send another $200 to Sarah Johnson"

    @pytest.mark.asyncio()
    async def test_pending_action_completion(self, setup_pipeline):
        """Test completing a pending action"""
        pipeline, _ = setup_pipeline
        session_id = "test-pending"

        # Initial incomplete query
        result1 = await pipeline.process(
            "Transfer $750",
            session_id
        )
        assert "recipient" in result1["missing_fields"]
        assert result1["can_execute"] is False

        # Complete with recipient
        result2 = await pipeline.process(
            "Alice Brown",
            session_id
        )
        assert result2.get("completed_pending") is True
        assert result2["entities"]["amount"] == 750.0
        assert "Alice" in result2["entities"]["recipient"]
        assert result2["can_execute"] is True
        assert len(result2["missing_fields"]) == 0

    @pytest.mark.asyncio()
    async def test_validation_insufficient_funds(self, setup_pipeline):
        """Test validation detecting insufficient funds"""
        pipeline, banking = setup_pipeline
        session_id = "test-insufficient"

        # Try to transfer more than balance
        result = await pipeline.process(
            "Transfer $10000 from checking to Sarah Johnson",
            session_id
        )

        assert result["intent"] == "unknown"
        assert result["validation"]["valid"] is False
        assert "amount" in result["validation"]["invalid_fields"]
        assert "Insufficient" in result["validation"]["invalid_fields"]["amount"]
        assert result["can_execute"] is False

    @pytest.mark.asyncio()
    async def test_transaction_history_query(self, setup_pipeline):
        """Test transaction history query processing"""
        pipeline, _ = setup_pipeline
        session_id = "test-history"

        result = await pipeline.process(
            "Show me transactions from last week",
            session_id
        )

        assert result["intent"] == "unknown"
        assert "date_from" in result["entities"] or "date_to" in result["entities"]
        assert result["can_execute"] is True

    @pytest.mark.asyncio()
    async def test_navigation_intent(self, setup_pipeline):
        """Test navigation intent processing"""
        pipeline, _ = setup_pipeline
        session_id = "test-navigation"

        result = await pipeline.process(
            "Take me to the transfer page",
            session_id
        )

        assert result["intent"] == "unknown"
        assert "destination" in result["entities"]
        assert result["can_execute"] is True

    @pytest.mark.asyncio()
    async def test_action_execution_balance(self, setup_pipeline):
        """Test execution of balance check action"""
        pipeline, _ = setup_pipeline
        session_id = "test-exec-balance"

        result = await pipeline.process(
            "Check my savings balance",
            session_id
        )

        assert result["can_execute"] is True
        assert "execution" in result
        assert result["execution"]["success"] is True
        assert result["execution"]["data"]["balance"] == 15000.00

    @pytest.mark.asyncio()
    async def test_action_execution_transfer(self, setup_pipeline):
        """Test execution of transfer action"""
        pipeline, banking = setup_pipeline
        session_id = "test-exec-transfer"

        initial_balance = banking.accounts["CHK001"].balance

        result = await pipeline.process(
            "Transfer $250 to Alice Brown",
            session_id
        )

        assert result["can_execute"] is True
        assert "execution" in result
        assert result["execution"]["success"] is True
        assert "transaction_id" in result["execution"]
        assert result["execution"]["new_balance"] == initial_balance - 250

    @pytest.mark.asyncio()
    async def test_confidence_based_confirmation(self, setup_pipeline):
        """Test confidence-based confirmation requirements"""
        pipeline, _ = setup_pipeline
        session_id = "test-confidence"

        # High confidence - no confirmation needed
        result = await pipeline.process(
            "What is my checking account balance?",
            session_id
        )
        assert result["confidence"] > 0.85
        assert result["requires_confirmation"] is False

        # Large amount - needs confirmation
        result = await pipeline.process(
            "Send $6000 to Sarah Johnson",
            session_id
        )
        assert result["requires_confirmation"] is True  # Large amount

    @pytest.mark.asyncio()
    async def test_ui_hints_generation(self, setup_pipeline):
        """Test UI hints generation based on confidence"""
        pipeline, _ = setup_pipeline
        session_id = "test-ui-hints"

        # High confidence query
        result = await pipeline.process(
            "Check my balance",
            session_id
        )
        assert result["ui_hints"]["display_mode"] == "toast"
        assert result["ui_hints"]["auto_proceed"] is True

        # Query with missing fields
        result = await pipeline.process(
            "Send money",
            session_id
        )
        assert result["ui_hints"]["prompt_for_missing"] is True
        assert result["ui_hints"]["auto_proceed"] is False

    @pytest.mark.asyncio()
    async def test_error_handling(self, setup_pipeline):
        """Test error handling in pipeline"""
        pipeline, _ = setup_pipeline
        session_id = "test-error"

        # Test with empty query
        result = await pipeline.process("", session_id)
        assert result["intent"] == "unknown"
        assert result["confidence"] == 0.0
        assert result["can_execute"] is False

    @pytest.mark.asyncio()
    async def test_skip_resolution_flag(self, setup_pipeline):
        """Test skip resolution flag"""
        pipeline, _ = setup_pipeline
        session_id = "test-skip-resolution"

        # First establish context
        await pipeline.process(
            "Send $500 to John Smith",
            session_id
        )

        # Test with skip_resolution=True
        result = await pipeline.process(
            "Send it to him",
            session_id,
            skip_resolution=True
        )

        # Should not resolve pronouns
        assert result["resolved_query"] == "Send it to him"

    @pytest.mark.asyncio()
    async def test_session_summary(self, setup_pipeline):
        """Test getting session summary"""
        pipeline, _ = setup_pipeline
        session_id = "test-summary"

        # Perform several queries
        queries = [
            "Check balance",
            "Send $500 to John Smith",
            "Show transaction history"
        ]

        for query in queries:
            await pipeline.process(query, session_id)

        # Get summary
        summary = await pipeline.get_session_summary(session_id)

        assert summary["session_id"] == session_id
        assert summary["interaction_count"] == 3
        assert summary["last_intent"] == "unknown"
        assert len(summary["recent_intents"]) == 3

    @pytest.mark.asyncio()
    async def test_concurrent_sessions(self, setup_pipeline):
        """Test handling multiple concurrent sessions"""
        pipeline, _ = setup_pipeline

        session1 = "session-1"
        session2 = "session-2"

        # Process queries in different sessions
        result1 = await pipeline.process(
            "Send $500 to John Smith",
            session1
        )

        result2 = await pipeline.process(
            "Check my balance",
            session2
        )

        # Verify sessions are isolated
        assert result1["intent"] == "unknown"
        assert result2["intent"] == "unknown"

        # Context shouldn't leak between sessions
        result3 = await pipeline.process(
            "Send it to him",
            session2
        )

        # Should not resolve "him" since no transfer context in session2
        assert result3["resolved_query"] == "Send it to him"
