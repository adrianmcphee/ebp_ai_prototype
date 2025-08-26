from unittest.mock import AsyncMock, Mock

import pytest

from src.cache import MockCache
from src.database import Database
from src.state_manager import ConversationStateManager


@pytest.fixture()
async def mock_cache():
    """Create a mock cache instance"""
    cache = MockCache()
    await cache.connect()
    return cache


@pytest.fixture()
async def mock_db():
    """Create a mock database"""
    db = Mock(spec=Database)
    db.get_session_history = AsyncMock(return_value=[])
    db.log_interaction = AsyncMock()
    db.cleanup_old_sessions = AsyncMock()
    return db


@pytest.fixture()
async def state_manager(mock_cache, mock_db):
    """Create a state manager instance"""
    return ConversationStateManager(mock_cache, mock_db)


class TestConversationStateManager:

    @pytest.mark.asyncio()
    async def test_get_initial_context(self, state_manager):
        """Test getting initial context for new session"""
        session_id = "test-session-123"
        context = await state_manager.get_context(session_id)

        assert context["session_id"] == session_id
        assert context["history"] == []
        assert context["last_recipient"] is None
        assert context["last_amount"] is None
        assert context["last_account"] is None
        assert context["last_intent"] is None
        assert context["pending_action"] is None
        assert context["disambiguation_context"] is None
        assert "created_at" in context

    @pytest.mark.asyncio()
    async def test_save_and_retrieve_context(self, state_manager):
        """Test saving and retrieving context from cache"""
        session_id = "test-session-456"

        # Get initial context
        context = await state_manager.get_context(session_id)

        # Modify context
        context["last_recipient"] = "John Smith"
        context["last_amount"] = 500.00
        await state_manager._save_context(session_id, context)

        # Retrieve modified context
        retrieved = await state_manager.get_context(session_id)
        assert retrieved["last_recipient"] == "John Smith"
        assert retrieved["last_amount"] == 500.00

    @pytest.mark.asyncio()
    async def test_resolve_recipient_references(self, state_manager):
        """Test resolving recipient pronouns"""
        context = {
            "last_recipient": "John Smith",
            "last_recipient_id": "RCP001"
        }

        test_cases = [
            ("Send $200 to him", "Send $200 to John Smith"),
            ("Pay her $100", "Pay John Smith $100"),
            ("Transfer to them", "Transfer to John Smith"),
            ("Send money to same person", "Send money to John Smith"),
            ("Pay that person", "Pay John Smith")
        ]

        for query, _expected in test_cases:
            resolved = await state_manager.resolve_references(query, context)
            assert "John Smith" in resolved

    @pytest.mark.asyncio()
    async def test_resolve_amount_references(self, state_manager):
        """Test resolving amount references"""
        context = {
            "last_amount": 500.00
        }

        test_cases = [
            ("Send it again", "Send $500.00 again"),
            ("Transfer that amount", "Transfer $500.00"),
            ("Pay the same", "Pay $500.00"),
            ("Send that much", "Send $500.00")
        ]

        for query, _expected in test_cases:
            resolved = await state_manager.resolve_references(query, context)
            assert "$500.00" in resolved

    @pytest.mark.asyncio()
    async def test_resolve_account_references(self, state_manager):
        """Test resolving account references"""
        context = {
            "last_account": "savings"
        }

        test_cases = [
            ("Transfer from there", "Transfer from savings"),
            ("Check that account", "Check savings"),
            ("Use same account", "Use savings")
        ]

        for query, _expected in test_cases:
            resolved = await state_manager.resolve_references(query, context)
            assert "savings" in resolved

    @pytest.mark.asyncio()
    async def test_resolve_another_pattern(self, state_manager):
        """Test resolving 'another' pattern"""
        context = {
            "last_amount": 500.00,
            "last_recipient": "John"
        }

        query = "Send another $200 to him"
        resolved = await state_manager.resolve_references(query, context)

        assert "$200" in resolved
        assert "John" in resolved

    @pytest.mark.asyncio()
    async def test_update_context(self, state_manager):
        """Test updating context with new interaction"""
        session_id = "test-update"

        processing_result = {
            "intent": "transfer",
            "confidence": 0.95,
            "entities": {
                "recipient": "Sarah Johnson",
                "amount": 750.00,
                "from_account": "checking"
            },
            "matched_recipient_id": "RCP003",
            "account_id": "CHK001"
        }

        await state_manager.update(
            session_id,
            "Send $750 to Sarah",
            "Send $750 to Sarah Johnson",
            processing_result
        )

        context = await state_manager.get_context(session_id)

        assert context["last_recipient"] == "Sarah Johnson"
        assert context["last_recipient_id"] == "RCP003"
        assert context["last_amount"] == 750.00
        assert context["last_account"] == "checking"
        assert context["last_account_id"] == "CHK001"
        assert context["last_intent"] == "transfer"
        assert len(context["history"]) == 1

        # Check history entry
        history_entry = context["history"][0]
        assert history_entry["original"] == "Send $750 to Sarah"
        assert history_entry["resolved"] == "Send $750 to Sarah Johnson"
        assert history_entry["intent"] == "transfer"
        assert history_entry["confidence"] == 0.95

    @pytest.mark.asyncio()
    async def test_history_size_limit(self, state_manager):
        """Test that history is limited to max size"""
        session_id = "test-history-limit"

        # Add more than max entries
        for i in range(15):
            processing_result = {
                "intent": "balance",
                "confidence": 0.9,
                "entities": {}
            }

            await state_manager.update(
                session_id,
                f"Query {i}",
                f"Resolved {i}",
                processing_result
            )

        context = await state_manager.get_context(session_id)
        assert len(context["history"]) == state_manager.max_history_size

        # Check that latest entries are kept
        assert context["history"][-1]["original"] == "Query 14"

    @pytest.mark.asyncio()
    async def test_pending_action_management(self, state_manager):
        """Test pending action tracking"""
        session_id = "test-pending"

        # Create pending action
        processing_result = {
            "intent": "transfer",
            "entities": {"amount": 500},
            "missing_fields": ["recipient"]
        }

        await state_manager.update(
            session_id,
            "Send $500",
            "Send $500",
            processing_result
        )

        context = await state_manager.get_context(session_id)
        assert context["pending_action"] is not None
        assert context["pending_action"]["intent"] == "transfer"
        assert context["pending_action"]["missing_fields"] == ["recipient"]

        # Get pending action
        pending = await state_manager.get_pending_action(session_id)
        assert pending["intent"] == "transfer"

        # Clear pending action
        await state_manager.clear_pending_action(session_id)
        pending = await state_manager.get_pending_action(session_id)
        assert pending is None

    @pytest.mark.asyncio()
    async def test_disambiguation_context(self, state_manager):
        """Test disambiguation context management"""
        session_id = "test-disambig"

        processing_result = {
            "intent": "transfer",
            "entities": {"amount": 500, "recipient": "John"},
            "disambiguations": {
                "recipient": [
                    {"id": "RCP001", "name": "John Smith"},
                    {"id": "RCP002", "name": "John Doe"}
                ]
            }
        }

        await state_manager.update(
            session_id,
            "Send $500 to John",
            "Send $500 to John",
            processing_result
        )

        # Check disambiguation context
        context = await state_manager.get_context(session_id)
        assert context["disambiguation_context"] is not None
        assert context["disambiguation_context"]["field"] == "recipient"
        assert len(context["disambiguation_context"]["options"]["recipient"]) == 2

        # Get disambiguation context
        disambig = await state_manager.get_disambiguation_context(session_id)
        assert disambig["field"] == "recipient"

        # Resolve disambiguation
        await state_manager.resolve_disambiguation(
            session_id,
            "recipient",
            {"id": "RCP001", "name": "John Smith"}
        )

        context = await state_manager.get_context(session_id)
        assert context["disambiguation_context"] is None
        assert context["last_recipient"] == "John Smith"
        assert context["last_recipient_id"] == "RCP001"

    @pytest.mark.asyncio()
    async def test_get_conversation_summary(self, state_manager):
        """Test getting conversation summary"""
        session_id = "test-summary"

        # Add some interactions
        for intent in ["balance", "transfer", "history"]:
            processing_result = {
                "intent": intent,
                "entities": {},
                "confidence": 0.9
            }
            await state_manager.update(
                session_id,
                f"Query for {intent}",
                f"Resolved {intent}",
                processing_result
            )

        # Add pending action
        processing_result["missing_fields"] = ["amount"]
        await state_manager.update(
            session_id,
            "Transfer query",
            "Transfer query",
            processing_result
        )

        summary = await state_manager.get_conversation_summary(session_id)

        assert summary["session_id"] == session_id
        assert summary["interaction_count"] == 4
        assert summary["last_intent"] == "transfer"
        assert summary["has_pending_action"] is True
        assert summary["has_disambiguation"] is False
        assert "history" in summary["recent_intents"]

    @pytest.mark.asyncio()
    async def test_database_logging(self, state_manager, mock_db):
        """Test that interactions are logged to database"""
        session_id = "test-db-log"

        processing_result = {
            "intent": "transfer",
            "confidence": 0.92,
            "entities": {"amount": 500},
            "validation": {"valid": True},
            "response_time_ms": 150
        }

        await state_manager.update(
            session_id,
            "Send $500",
            "Send $500",
            processing_result
        )

        # Check database was called
        mock_db.log_interaction.assert_called_once()
        call_args = mock_db.log_interaction.call_args[1]
        assert call_args["session_id"] == session_id
        assert call_args["query"] == "Send $500"
        assert call_args["intent_type"] == "transfer"
        assert call_args["confidence"] == 0.92
        assert call_args["response_time_ms"] == 150

    @pytest.mark.asyncio()
    async def test_empty_context_resolution(self, state_manager):
        """Test resolution with empty context doesn't break"""
        context = {}

        query = "Send it to him there"
        resolved = await state_manager.resolve_references(query, context)

        # Should return original query when no context
        assert resolved == query

    @pytest.mark.asyncio()
    async def test_cleanup_old_sessions(self, state_manager, mock_db):
        """Test cleanup of old sessions"""
        await state_manager.cleanup_old_sessions()
        mock_db.cleanup_old_sessions.assert_called_once()
