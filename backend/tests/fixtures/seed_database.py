"""Database seeding script for E2E testing"""
import asyncio
import json
import os
import sys
from datetime import datetime, timedelta

# Add parent directories to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg
from fixtures.test_data import TestDataFixtures

from src.cache import RedisCache
from src.mock_banking import MockBankingService


class TestDatabaseSeeder:
    def __init__(self, database_url: str, redis_url: str):
        self.database_url = database_url
        self.redis_url = redis_url
        self.banking_service = None
        self.cache = None
        self.db = None

    async def connect(self):
        """Connect to database and cache"""
        self.db = await asyncpg.connect(self.database_url)
        self.cache = RedisCache(self.redis_url)
        await self.cache.connect()
        self.banking_service = MockBankingService()

    async def disconnect(self):
        """Disconnect from services"""
        if self.db:
            await self.db.close()
        if self.cache:
            await self.cache.disconnect()

    async def reset_database(self):
        """Clear existing test data"""
        print("🗑️  Clearing existing test data...")

        # Clear tables
        await self.db.execute("DELETE FROM interactions WHERE session_id LIKE 'test_%'")
        await self.db.execute("DELETE FROM sessions WHERE id::text LIKE 'test_%'")
        await self.db.execute("DELETE FROM intent_cache WHERE query LIKE 'TEST:%'")

        # Clear cache
        await self.cache.flush_all()

        print("✅ Database reset complete")

    async def seed_test_users(self):
        """Seed test user accounts"""
        print("👥 Seeding test users...")

        for user in TestDataFixtures.TEST_USERS:
            # Override banking service accounts
            for account in user["accounts"]:
                self.banking_service.accounts[account["id"]] = {
                    "id": account["id"],
                    "name": account["name"],
                    "type": account["type"],
                    "balance": account["balance"],
                    "currency": account["currency"]
                }

            # Add recipients
            for recipient in user["recipients"]:
                if not any(r.id == recipient["id"] for r in self.banking_service.recipients):
                    self.banking_service.recipients.append({
                        "id": recipient["id"],
                        "name": recipient["name"],
                        "account_number": recipient["account"]
                    })

        print(f"✅ Seeded {len(TestDataFixtures.TEST_USERS)} test users")

    async def seed_test_sessions(self):
        """Create test sessions for scenarios"""
        print("🔗 Creating test sessions...")

        for scenario in TestDataFixtures.TEST_SCENARIOS:
            session_id = f"test_{scenario['id']}"

            # Create session
            await self.db.execute("""
                INSERT INTO sessions (id, created_at, metadata)
                VALUES ($1, $2, $3)
                ON CONFLICT (id) DO UPDATE SET last_activity = NOW()
            """, session_id, datetime.now(), json.dumps({
                "scenario": scenario["id"],
                "user": scenario.get("user", "user_001")
            }))

            # Initialize session context in cache
            context = {
                "session_id": session_id,
                "history": [],
                "scenario": scenario["id"],
                "created_at": datetime.now().isoformat()
            }

            await self.cache.setex(
                f"session:{session_id}",
                3600,
                json.dumps(context)
            )

        print(f"✅ Created {len(TestDataFixtures.TEST_SCENARIOS)} test sessions")

    async def seed_transaction_history(self):
        """Seed realistic transaction history"""
        print("💳 Generating transaction history...")

        for user in TestDataFixtures.TEST_USERS:
            for account in user["accounts"]:
                # Generate transactions
                transactions = TestDataFixtures.generate_transaction_history(
                    account["id"],
                    days=30
                )

                # Add to banking service
                for trans in transactions:
                    self.banking_service.transactions.append(trans)

        # Sort by date
        self.banking_service.transactions.sort(
            key=lambda x: x.get("date", ""),
            reverse=True
        )

        print(f"✅ Generated {len(self.banking_service.transactions)} transactions")

    async def seed_intent_cache(self):
        """Pre-cache common intents for faster testing"""
        print("🧠 Pre-caching common intents...")

        common_queries = [
            ("What's my balance?", "balance", 0.95),
            ("Check my checking account", "balance", 0.92),
            ("Send money", "transfer", 0.88),
            ("Transfer $500 to John", "transfer", 0.93),
            ("Show my transactions", "history", 0.90),
            ("Take me to transfers", "navigation", 0.91),
            ("Help", "help", 0.95)
        ]

        for query, intent, confidence in common_queries:
            cache_key = f"intent:TEST:{query}"
            result = {
                "primary_intent": intent,
                "confidence": confidence,
                "alternatives": [],
                "from_cache": True
            }

            await self.cache.setex(cache_key, 3600, json.dumps(result))

        print(f"✅ Pre-cached {len(common_queries)} common intents")

    async def seed_sample_interactions(self):
        """Seed sample interactions for testing history"""
        print("💬 Creating sample interactions...")

        session_id = "test_sample_session"

        # Create session
        await self.db.execute("""
            INSERT INTO sessions (id, created_at)
            VALUES ($1, $2)
            ON CONFLICT (id) DO NOTHING
        """, session_id, datetime.now())

        # Add sample interactions
        interactions = [
            {
                "query": "Check my balance",
                "intent": "balance",
                "confidence": 0.94,
                "entities": {"account": "checking"},
                "completed": True
            },
            {
                "query": "Send $500 to John Smith",
                "intent": "transfer",
                "confidence": 0.91,
                "entities": {
                    "amount": 500.00,
                    "recipient": "John Smith"
                },
                "completed": True
            },
            {
                "query": "Show recent transactions",
                "intent": "history",
                "confidence": 0.89,
                "entities": {},
                "completed": True
            }
        ]

        for i, interaction in enumerate(interactions):
            await self.db.execute("""
                INSERT INTO interactions (
                    session_id, query, intent_type, confidence,
                    entities, completed, timestamp
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
                session_id,
                interaction["query"],
                interaction["intent"],
                interaction["confidence"],
                json.dumps(interaction["entities"]),
                interaction["completed"],
                datetime.now() - timedelta(minutes=30-i*10)
            )

        print(f"✅ Created {len(interactions)} sample interactions")

    async def verify_seeding(self):
        """Verify that seeding was successful"""
        print("\n🔍 Verifying seed data...")

        # Check sessions
        session_count = await self.db.fetchval(
            "SELECT COUNT(*) FROM sessions WHERE id::text LIKE 'test_%'"
        )
        print(f"  Sessions: {session_count}")

        # Check interactions
        interaction_count = await self.db.fetchval(
            "SELECT COUNT(*) FROM interactions WHERE session_id LIKE 'test_%'"
        )
        print(f"  Interactions: {interaction_count}")

        # Check banking service
        print(f"  Accounts: {len(self.banking_service.accounts)}")
        print(f"  Recipients: {len(self.banking_service.recipients)}")
        print(f"  Transactions: {len(self.banking_service.transactions)}")

        # Check cache
        test_key = await self.cache.get("session:test_scenario_001")
        print(f"  Cache working: {test_key is not None}")

        print("\n✅ Seeding verification complete")

    async def seed_all(self):
        """Run all seeding operations"""
        print("🌱 Starting database seeding for E2E tests...\n")

        try:
            await self.connect()
            await self.reset_database()
            await self.seed_test_users()
            await self.seed_test_sessions()
            await self.seed_transaction_history()
            await self.seed_intent_cache()
            await self.seed_sample_interactions()
            await self.verify_seeding()

            print("\n🎉 Database seeding completed successfully!")

        except Exception as e:
            print(f"\n❌ Seeding failed: {e}")
            raise
        finally:
            await self.disconnect()


async def main():
    """Main entry point"""
    import os

    from dotenv import load_dotenv

    load_dotenv()

    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://user:pass@localhost/nlp_banking_test"
    )
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")

    seeder = TestDatabaseSeeder(database_url, redis_url)
    await seeder.seed_all()


if __name__ == "__main__":
    asyncio.run(main())
