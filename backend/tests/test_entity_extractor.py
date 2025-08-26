from datetime import datetime, timedelta

import pytest

from src.entity_extractor import EntityExtractor, EntityType
from src.llm_client import MockLLMClient


@pytest.fixture()
def mock_llm():
    """Create a mock LLM client"""
    return MockLLMClient(delay=0.01)


@pytest.fixture()
def extractor(mock_llm):
    """Create an entity extractor instance"""
    return EntityExtractor(mock_llm)


class TestEntityExtractor:

    @pytest.mark.asyncio()
    async def test_extract_amount_patterns(self, extractor):
        """Test extraction of monetary amounts using patterns"""
        test_cases = [
            ("Send $500 to John", 500.0),
            ("Transfer 1000 dollars", 1000.0),
            ("Pay $1,500.50", 1500.50),
            ("Send $25.99", 25.99),
        ]

        for query, expected_amount in test_cases:
            pattern_entities = extractor._extract_with_patterns(query)
            assert "amount" in pattern_entities
            assert pattern_entities["amount"].value == expected_amount

        # Test standalone number (should not match without context)
        pattern_entities = extractor._extract_with_patterns("Transfer 2500")
        # This might not match without "dollars" - that's okay for pattern-based extraction

    @pytest.mark.asyncio()
    async def test_extract_account_type_patterns(self, extractor):
        """Test extraction of account types using patterns"""
        test_cases = [
            ("Check my checking account", "checking"),
            ("Transfer from savings", "savings"),
            ("Credit card balance", "credit"),
            ("Business account statement", "business")
        ]

        for query, expected_account in test_cases:
            pattern_entities = extractor._extract_with_patterns(query)
            assert "account_type" in pattern_entities
            assert pattern_entities["account_type"].value == expected_account

    @pytest.mark.asyncio()
    async def test_extract_dates_patterns(self, extractor):
        """Test extraction and parsing of dates using patterns"""
        today = datetime.now().date()
        yesterday = today - timedelta(days=1)
        tomorrow = today + timedelta(days=1)

        test_cases = [
            ("Show transactions from today", today.isoformat()),
            ("What did I spend yesterday", yesterday.isoformat()),
            ("Schedule for tomorrow", tomorrow.isoformat())
        ]

        for query, expected_date in test_cases:
            pattern_entities = extractor._extract_with_patterns(query)
            assert "date" in pattern_entities
            assert pattern_entities["date"].value == expected_date

    @pytest.mark.asyncio()
    async def test_full_extraction_with_function_calling(self, extractor):
        """Test full extraction with function calling approach"""
        result = await extractor.extract(
            "Send $500 to John Smith from checking",
            intent_type="transfer",
            use_function_calling=True
        )

        assert "entities" in result
        entities = result["entities"]

        # Should extract key entities
        assert "amount" in entities
        assert entities["amount"]["value"] == 500.0
        assert "recipient" in entities
        assert "John" in entities["recipient"]["value"]
        assert "account_type" in entities
        assert entities["account_type"]["value"] == "checking"

    @pytest.mark.asyncio()
    async def test_full_extraction_with_json_mode(self, extractor):
        """Test full extraction with JSON mode fallback"""
        result = await extractor.extract(
            "Check my savings account balance",
            intent_type="balance",
            use_function_calling=False
        )

        assert "entities" in result
        entities = result["entities"]

        # Should extract account type
        assert "account_type" in entities or len(entities) > 0
        assert result["confidence_score"] >= 0.0

    @pytest.mark.asyncio()
    async def test_validation_rules(self, extractor):
        """Test entity validation against rules"""
        # Test amount validation
        from src.entity_extractor import ExtractedEntity

        rule = extractor.validation_rules[EntityType.AMOUNT]

        # Valid amount
        entity = ExtractedEntity(
            entity_type=EntityType.AMOUNT,
            value=100.0,
            raw_text="$100",
            confidence=0.9,
            source="pattern"
        )
        is_valid, error = extractor._validate_entity(entity, rule)
        assert is_valid
        assert error is None

        # Invalid amount (too low)
        entity.value = 0.0
        is_valid, error = extractor._validate_entity(entity, rule)
        assert not is_valid
        assert "at least" in error

    @pytest.mark.asyncio()
    async def test_required_entities_checking(self, extractor):
        """Test checking for missing required entities"""
        result = await extractor.extract(
            "Send money to John",  # Missing amount
            intent_type="transfer",
            required_entities=["amount", "recipient"]
        )

        assert "missing_required" in result
        assert "amount" in result["missing_required"]
        assert "recipient" not in result["missing_required"]  # Should be extracted

        assert result["follow_up_needed"] is True
        assert len(result["suggestions"]) > 0

    @pytest.mark.asyncio()
    async def test_entity_normalization(self, extractor):
        """Test entity value normalization"""
        # Test date normalization
        normalized = extractor._parse_date("01/15/2024")
        assert normalized == "2024-01-15"

        # Test email normalization
        from src.entity_extractor import ExtractedEntity
        entity = ExtractedEntity(
            entity_type=EntityType.EMAIL,
            value="TEST@EXAMPLE.COM",
            raw_text="TEST@EXAMPLE.COM",
            confidence=0.9,
            source="pattern"
        )
        normalized = extractor._normalize_entity_value(entity)
        assert normalized == "test@example.com"

    @pytest.mark.asyncio()
    async def test_entity_merging(self, extractor):
        """Test merging entities from different sources"""
        from src.entity_extractor import ExtractedEntity

        pattern_entities = {
            "amount": ExtractedEntity(
                entity_type=EntityType.AMOUNT,
                value=500.0,
                raw_text="$500",
                confidence=0.85,
                source="pattern"
            )
        }

        llm_entities = {
            "recipient": ExtractedEntity(
                entity_type=EntityType.RECIPIENT,
                value="John Smith",
                raw_text="John Smith",
                confidence=0.90,
                source="llm"
            ),
            "amount": ExtractedEntity(
                entity_type=EntityType.AMOUNT,
                value=600.0,  # Different value with higher confidence
                raw_text="600",
                confidence=0.95,
                source="llm"
            )
        }

        merged = extractor._merge_entities(pattern_entities, llm_entities)

        # Should prefer higher confidence LLM amount
        assert merged["amount"].value == 600.0
        assert merged["amount"].source == "llm"

        # Should include recipient from LLM
        assert "recipient" in merged
        assert merged["recipient"].value == "John Smith"

    @pytest.mark.asyncio()
    async def test_routing_number_validation(self, extractor):
        """Test routing number validation with checksum"""
        # Valid routing number
        assert extractor._validate_routing_number("021000021") is True

        # Invalid routing number (bad checksum)
        assert extractor._validate_routing_number("123456789") is False

        # Invalid format
        assert extractor._validate_routing_number("12345") is False

    @pytest.mark.asyncio()
    async def test_batch_extraction(self, extractor):
        """Test batch processing of multiple queries"""
        queries = [
            "Send $100 to Alice",
            "Check my balance",
            "Transfer $50 from savings"
        ]

        results = await extractor.extract_batch(queries)

        assert len(results) == 3
        for result in results:
            assert "entities" in result
            assert "confidence_score" in result
            assert isinstance(result["confidence_score"], float)

    @pytest.mark.asyncio()
    async def test_complex_query_extraction(self, extractor):
        """Test extraction from complex, multi-entity queries"""
        query = "Transfer $1,500.50 from my savings account to John Smith tomorrow for rent payment"

        result = await extractor.extract(query, intent_type="transfer")
        entities = result["entities"]

        # Should extract multiple entities
        assert "amount" in entities
        assert entities["amount"]["value"] == 1500.50

        if "recipient" in entities:
            assert "John" in str(entities["recipient"]["value"])

        if "account_type" in entities:
            assert entities["account_type"]["value"] == "savings"

        # Should have reasonable confidence
        assert result["confidence_score"] > 0.0

    @pytest.mark.asyncio()
    async def test_error_handling(self, extractor):
        """Test error handling and graceful degradation"""
        # Test with timeout
        slow_llm = MockLLMClient(delay=5.0)
        slow_extractor = EntityExtractor(slow_llm)

        result = await slow_extractor.extract(
            "Send $500 to John",
            intent_type="transfer"
        )

        # Should still return valid structure even on timeout
        assert "entities" in result
        assert "validation_errors" in result
        assert "confidence_score" in result

    @pytest.mark.asyncio()
    async def test_confidence_scoring(self, extractor):
        """Test confidence score calculation"""
        result = await extractor.extract(
            "Send $500 to John from checking",
            intent_type="transfer"
        )

        confidence = result["confidence_score"]
        assert 0.0 <= confidence <= 1.0

        # More entities should generally have reasonable confidence
        if len(result["entities"]) > 2:
            assert confidence > 0.7

    @pytest.mark.asyncio()
    async def test_suggestion_generation(self, extractor):
        """Test generation of helpful suggestions for missing entities"""
        result = await extractor.extract(
            "Send money",  # Very vague query
            intent_type="transfer",
            required_entities=["amount", "recipient"]
        )

        suggestions = result["suggestions"]
        assert len(suggestions) > 0

        # Should ask for missing information
        suggestion_text = " ".join(suggestions).lower()
        assert "amount" in suggestion_text or "how much" in suggestion_text
        assert "recipient" in suggestion_text or "who" in suggestion_text or "send" in suggestion_text
