from typing import Optional

import redis.asyncio as redis


class RedisCache:
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self.client: Optional[redis.Redis] = None

    async def connect(self):
        self.client = await redis.from_url(
            self.redis_url, decode_responses=True, max_connections=10
        )

    async def disconnect(self):
        if self.client:
            await self.client.close()

    async def get(self, key: str) -> Optional[str]:
        if not self.client:
            return None
        try:
            return await self.client.get(key)
        except Exception as e:
            print(f"Redis GET error: {e}")
            return None

    async def set(self, key: str, value: str, expire: Optional[int] = None) -> bool:
        if not self.client:
            return False
        try:
            if expire:
                return await self.client.setex(key, expire, value)
            else:
                return await self.client.set(key, value)
        except Exception as e:
            print(f"Redis SET error: {e}")
            return False

    async def setex(self, key: str, seconds: int, value: str) -> bool:
        return await self.set(key, value, expire=seconds)

    async def delete(self, key: str) -> bool:
        if not self.client:
            return False
        try:
            result = await self.client.delete(key)
            return result > 0
        except Exception as e:
            print(f"Redis DELETE error: {e}")
            return False

    async def exists(self, key: str) -> bool:
        if not self.client:
            return False
        try:
            return await self.client.exists(key) > 0
        except Exception as e:
            print(f"Redis EXISTS error: {e}")
            return False

    async def hget(self, name: str, key: str) -> Optional[str]:
        if not self.client:
            return None
        try:
            return await self.client.hget(name, key)
        except Exception as e:
            print(f"Redis HGET error: {e}")
            return None

    async def hset(self, name: str, key: str, value: str) -> bool:
        if not self.client:
            return False
        try:
            return await self.client.hset(name, key, value)
        except Exception as e:
            print(f"Redis HSET error: {e}")
            return False

    async def hgetall(self, name: str) -> dict:
        if not self.client:
            return {}
        try:
            return await self.client.hgetall(name)
        except Exception as e:
            print(f"Redis HGETALL error: {e}")
            return {}

    async def expire(self, key: str, seconds: int) -> bool:
        if not self.client:
            return False
        try:
            return await self.client.expire(key, seconds)
        except Exception as e:
            print(f"Redis EXPIRE error: {e}")
            return False

    async def flush_all(self):
        if self.client:
            try:
                await self.client.flushall()
            except Exception as e:
                print(f"Redis FLUSHALL error: {e}")


class MockCache:
    def __init__(self):
        self.data = {}
        self.ttls = {}

    async def connect(self):
        pass

    async def disconnect(self):
        pass

    async def get(self, key: str) -> Optional[str]:
        import time

        if key in self.data:
            if key in self.ttls and self.ttls[key] < time.time():
                del self.data[key]
                del self.ttls[key]
                return None
            return self.data[key]
        return None

    async def set(self, key: str, value: str, expire: Optional[int] = None) -> bool:
        import time

        self.data[key] = value
        if expire:
            self.ttls[key] = time.time() + expire
        return True

    async def setex(self, key: str, seconds: int, value: str) -> bool:
        return await self.set(key, value, expire=seconds)

    async def delete(self, key: str) -> bool:
        if key in self.data:
            del self.data[key]
            if key in self.ttls:
                del self.ttls[key]
            return True
        return False

    async def exists(self, key: str) -> bool:
        return key in self.data

    async def hget(self, name: str, key: str) -> Optional[str]:
        if name in self.data and isinstance(self.data[name], dict):
            return self.data[name].get(key)
        return None

    async def hset(self, name: str, key: str, value: str) -> bool:
        if name not in self.data:
            self.data[name] = {}
        self.data[name][key] = value
        return True

    async def hgetall(self, name: str) -> dict:
        if name in self.data and isinstance(self.data[name], dict):
            return self.data[name]
        return {}

    async def expire(self, key: str, seconds: int) -> bool:
        import time

        if key in self.data:
            self.ttls[key] = time.time() + seconds
            return True
        return False

    async def flush_all(self):
        self.data.clear()
        self.ttls.clear()
