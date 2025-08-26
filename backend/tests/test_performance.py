"""Performance and load testing for the NLP Banking system"""

import asyncio
import time
from statistics import mean, median

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


class TestPerformance:

    def setup_method(self):
        self.llm_client = MockLLMClient(delay=0.01)  # Minimal delay
        self.cache = MockCache()
        self.classifier = IntentClassifier(self.llm_client, self.cache)
        self.extractor = EntityExtractor(self.llm_client)
        self.banking_service = MockBankingService()
        self.validator = EntityValidator(self.banking_service)
        self.database = MockDatabase()
        self.state_manager = ConversationStateManager(self.cache, self.database)

        self.pipeline = IntentPipeline(
            self.classifier,
            self.extractor,
            self.validator,
            self.state_manager,
            self.banking_service
        )

    @pytest.mark.asyncio()
    async def test_single_query_performance(self):
        """Test single query response time"""
        query = "Check my balance"

        # Warm up
        await self.classifier.classify(query)

        # Measure
        start = time.perf_counter()
        result = await self.classifier.classify(query)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert elapsed_ms < 100, f"Single query took {elapsed_ms:.2f}ms"
        assert result["primary_intent"] == "balance"

    @pytest.mark.asyncio()
    async def test_cached_query_performance(self):
        """Test that cached queries are faster"""
        query = "Transfer $500 to John"

        # First call - not cached
        start1 = time.perf_counter()
        await self.classifier.classify(query)
        time1_ms = (time.perf_counter() - start1) * 1000

        # Second call - should be cached
        start2 = time.perf_counter()
        result2 = await self.classifier.classify(query)
        time2_ms = (time.perf_counter() - start2) * 1000

        assert time2_ms < time1_ms / 2, f"Cached query not faster: {time1_ms:.2f}ms vs {time2_ms:.2f}ms"
        assert result2.get("from_cache") is True

    @pytest.mark.asyncio()
    async def test_batch_classification_performance(self):
        """Test batch classification performance"""
        queries = [
            "Check my balance",
            "Send $100 to Alice",
            "Show recent transactions",
            "Find nearest ATM",
            "Block my card",
            "Pay electricity bill",
            "Set up recurring payment",
            "Check exchange rate",
            "Schedule appointment",
            "Download tax documents"
        ]

        start = time.perf_counter()
        results = await self.classifier.batch_classify(queries)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert elapsed_ms < 500, f"Batch classification took {elapsed_ms:.2f}ms"
        assert len(results) == len(queries)

    @pytest.mark.asyncio()
    async def test_concurrent_requests(self):
        """Test handling concurrent requests"""
        queries = [
            "Check balance",
            "Transfer money",
            "Show history",
            "Find ATM",
            "Block card"
        ] * 10  # 50 total queries

        async def process_query(query):
            start = time.perf_counter()
            await self.classifier.classify(query)
            return (time.perf_counter() - start) * 1000

        # Process all queries concurrently
        start_total = time.perf_counter()
        times = await asyncio.gather(*[process_query(q) for q in queries])
        total_time_ms = (time.perf_counter() - start_total) * 1000

        avg_time = mean(times)
        median_time = median(times)

        assert total_time_ms < 2000, f"50 concurrent queries took {total_time_ms:.2f}ms"
        assert avg_time < 100, f"Average query time: {avg_time:.2f}ms"
        assert median_time < 50, f"Median query time: {median_time:.2f}ms"

    @pytest.mark.asyncio()
    async def test_full_pipeline_performance(self):
        """Test full pipeline processing time"""
        test_queries = [
            ("Check my balance", 300),
            ("Send $500 to John Smith from checking", 400),
            ("Show transactions from last week", 350),
            ("Block my debit card immediately", 300),
            ("Set up $1500 monthly rent payment", 450)
        ]

        session_id = await self.database.create_session()

        for query, max_time_ms in test_queries:
            await self.cache.flush_all()  # Clear cache for fair comparison

            start = time.perf_counter()
            result = await self.pipeline.process(query, session_id)
            elapsed_ms = (time.perf_counter() - start) * 1000

            assert elapsed_ms < max_time_ms, f"'{query}' took {elapsed_ms:.2f}ms (max: {max_time_ms}ms)"
            assert "intent" in result

    @pytest.mark.asyncio()
    async def test_entity_extraction_performance(self):
        """Test entity extraction performance for complex queries"""
        complex_queries = [
            "Transfer $1,234.56 to William Johnson III at account 987654321 with reference 'Invoice #2024-001'",
            "Send $500 to John, $300 to Mary, and $200 to Bob from my savings account",
            "Pay my electricity bill of $125.50, water bill of $45.30, and internet bill of $89.99"
        ]

        for query in complex_queries:
            start = time.perf_counter()
            entities = await self.extractor.extract(query, "transfer")
            elapsed_ms = (time.perf_counter() - start) * 1000

            assert elapsed_ms < 200, f"Complex extraction took {elapsed_ms:.2f}ms"
            assert entities is not None

    @pytest.mark.asyncio()
    async def test_context_resolution_performance(self):
        """Test performance of context resolution"""
        session_id = await self.database.create_session()

        # Build up context
        queries = [
            "Send $100 to Sarah Johnson",
            "Actually make it $150",
            "Send another $200 to her",
            "And $50 more to the same person"
        ]

        times = []
        for query in queries:
            start = time.perf_counter()
            await self.pipeline.process(query, session_id)
            elapsed_ms = (time.perf_counter() - start) * 1000
            times.append(elapsed_ms)

        # Context resolution shouldn't significantly slow down processing
        assert all(t < 400 for t in times), f"Context resolution too slow: {times}"
        assert mean(times) < 300, f"Average time with context: {mean(times):.2f}ms"

    @pytest.mark.asyncio()
    async def test_memory_efficiency(self):
        """Test that the system doesn't leak memory with many requests"""
        # Get initial cache size
        len(self.cache.data)

        # Process many queries
        for i in range(100):
            query = f"Check balance for account {i}"
            await self.classifier.classify(query)

        # Cache should have reasonable size (with TTL management)
        final_cache_size = len(self.cache.data)

        # We cache with md5 hash keys, so we should have ~100 entries
        assert final_cache_size <= 110, f"Cache grew too large: {final_cache_size} entries"

    @pytest.mark.asyncio()
    async def test_rate_limiting_simulation(self):
        """Simulate rate limiting behavior"""
        # This tests that our system can handle rate-limited scenarios
        queries_per_second = 5
        duration_seconds = 2
        total_queries = queries_per_second * duration_seconds

        async def rate_limited_query(delay):
            await asyncio.sleep(delay)
            return await self.classifier.classify("Check balance")

        # Schedule queries with delays
        tasks = []
        for i in range(total_queries):
            delay = i / queries_per_second
            tasks.append(rate_limited_query(delay))

        start = time.perf_counter()
        results = await asyncio.gather(*tasks)
        total_time = time.perf_counter() - start

        assert len(results) == total_queries
        assert total_time < duration_seconds + 1, f"Rate limited test took {total_time:.2f}s"

    def test_performance_summary(self):
        """Print performance summary (not a test, just informational)"""
        print("\n" + "="*60)
        print("PERFORMANCE BENCHMARKS")
        print("="*60)
        print("Single Query:        < 100ms")
        print("Cached Query:        < 50ms")
        print("Batch (10 queries):  < 500ms")
        print("Concurrent (50):     < 2000ms total")
        print("Full Pipeline:       < 400ms")
        print("Complex Extraction:  < 200ms")
        print("Context Resolution:  < 400ms")
        print("="*60)
