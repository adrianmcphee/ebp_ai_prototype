import json
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Optional

import asyncpg


class MockDatabase:
    """Mock database for testing without PostgreSQL"""

    def __init__(self, database_url: str | None = None):
        self.sessions = {}
        self.interactions = []
        self.connected = False

    async def connect(self):
        self.connected = True

    async def disconnect(self):
        self.connected = False

    async def execute(self, query: str, *args):
        return None

    async def fetchone(self, query: str, *args) -> Optional[dict[str, Any]]:
        return None

    async def fetchall(self, query: str, *args) -> list[dict[str, Any]]:
        return []

    async def create_session(self, metadata: dict[str, Any] | None = None) -> str:
        import uuid

        session_id = str(uuid.uuid4())
        self.sessions[session_id] = {
            "id": session_id,
            "metadata": metadata or {},
            "created_at": datetime.now(),
        }
        return session_id

    async def get_session(self, session_id: str) -> Optional[dict[str, Any]]:
        return self.sessions.get(session_id)

    async def log_interaction(self, **kwargs) -> int:
        interaction_id = len(self.interactions) + 1
        self.interactions.append({**kwargs, "id": interaction_id})
        return interaction_id

    async def get_session_history(
        self, session_id: str, limit: int = 10
    ) -> list[dict[str, Any]]:
        return [i for i in self.interactions if i.get("session_id") == session_id][
            -limit:
        ]

    async def update_analytics(self, *args, **kwargs):
        pass

    async def cleanup_old_sessions(self):
        pass


class Database:
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self):
        self.pool = await asyncpg.create_pool(
            self.database_url, min_size=1, max_size=10, command_timeout=60
        )

    async def disconnect(self):
        if self.pool:
            await self.pool.close()

    @asynccontextmanager
    async def acquire(self):
        async with self.pool.acquire() as connection:
            yield connection

    async def execute(self, query: str, *args):
        async with self.acquire() as conn:
            return await conn.execute(query, *args)

    async def fetchone(self, query: str, *args) -> Optional[dict[str, Any]]:
        async with self.acquire() as conn:
            row = await conn.fetchrow(query, *args)
            return dict(row) if row else None

    async def fetchall(self, query: str, *args) -> list[dict[str, Any]]:
        async with self.acquire() as conn:
            rows = await conn.fetch(query, *args)
            return [dict(row) for row in rows]

    async def create_session(self, metadata: dict[str, Any] | None = None) -> str:
        query = """
            INSERT INTO sessions (metadata)
            VALUES ($1)
            RETURNING id
        """
        metadata_json = json.dumps(metadata or {})

        result = await self.fetchone(query, metadata_json)
        return str(result["id"])

    async def get_session(self, session_id: str) -> Optional[dict[str, Any]]:
        query = """
            SELECT * FROM sessions
            WHERE id = $1
        """
        return await self.fetchone(query, session_id)

    async def log_interaction(
        self,
        session_id: str,
        query: str,
        resolved_query: str,
        intent_type: str,
        confidence: float,
        entities: dict[str, Any],
        validation_result: dict[str, Any],
        action_taken: str,
        response_time_ms: int | None = None,
        error_message: str | None = None,
    ) -> int:
        insert_query = """
            INSERT INTO interactions (
                session_id, query, resolved_query, intent_type, confidence,
                entities, validation_result, action_taken, response_time_ms, error_message
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        """

        result = await self.fetchone(
            insert_query,
            session_id,
            query,
            resolved_query,
            intent_type,
            confidence,
            json.dumps(entities),
            json.dumps(validation_result),
            action_taken,
            response_time_ms,
            error_message,
        )

        return result["id"]

    async def get_session_history(
        self, session_id: str, limit: int = 10
    ) -> list[dict[str, Any]]:
        query = """
            SELECT * FROM interactions
            WHERE session_id = $1
            ORDER BY timestamp DESC
            LIMIT $2
        """
        return await self.fetchall(query, session_id, limit)

    async def update_analytics(
        self, intent_type: str, success: bool, confidence: float, response_time_ms: int
    ):
        query = """
            INSERT INTO analytics (date, intent_type, success_count, failure_count, avg_confidence, avg_response_time_ms)
            VALUES (CURRENT_DATE, $1, $2, $3, $4, $5)
            ON CONFLICT (date, intent_type) DO UPDATE
            SET success_count = analytics.success_count + EXCLUDED.success_count,
                failure_count = analytics.failure_count + EXCLUDED.failure_count,
                avg_confidence = (analytics.avg_confidence * (analytics.success_count + analytics.failure_count) + $4)
                                / (analytics.success_count + analytics.failure_count + 1),
                avg_response_time_ms = (analytics.avg_response_time_ms * (analytics.success_count + analytics.failure_count) + $5)
                                      / (analytics.success_count + analytics.failure_count + 1)
        """

        success_count = 1 if success else 0
        failure_count = 0 if success else 1

        await self.execute(
            query,
            intent_type,
            success_count,
            failure_count,
            confidence,
            response_time_ms,
        )

    async def cleanup_old_sessions(self):
        query = "SELECT cleanup_old_sessions()"
        await self.execute(query)
