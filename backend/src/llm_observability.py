"""LLM Observability with LangFuse integration"""

import asyncio
import os
import time
from contextlib import asynccontextmanager
from functools import wraps
from typing import Any, Optional

# Optional LangFuse import
try:
    from langfuse import Langfuse
    from langfuse.decorators import langfuse_context, observe

    LANGFUSE_AVAILABLE = True
except ImportError:
    LANGFUSE_AVAILABLE = False
    print("LangFuse not installed. Install with: pip install langfuse")


class LLMObservability:
    """Centralized observability for LLM calls"""

    def __init__(
        self,
        enabled: bool = True,
        langfuse_public_key: Optional[str] = None,
        langfuse_secret_key: Optional[str] = None,
        langfuse_host: Optional[str] = None,
        environment: str = "development",
    ):
        self.enabled = enabled and LANGFUSE_AVAILABLE
        self.environment = environment
        self.metrics = {
            "total_calls": 0,
            "total_tokens": 0,
            "total_cost": 0.0,
            "total_latency_ms": 0,
            "errors": 0,
            "cache_hits": 0,
            "cache_misses": 0,
        }

        # Initialize LangFuse if available and configured
        self.langfuse = None
        if self.enabled:
            try:
                # Use environment variables if not provided
                public_key = langfuse_public_key or os.getenv("LANGFUSE_PUBLIC_KEY")
                secret_key = langfuse_secret_key or os.getenv("LANGFUSE_SECRET_KEY")
                host = langfuse_host or os.getenv(
                    "LANGFUSE_HOST", "https://cloud.langfuse.com"
                )

                if public_key and secret_key:
                    self.langfuse = Langfuse(
                        public_key=public_key,
                        secret_key=secret_key,
                        host=host,
                        release=environment,
                    )
                    print(f"LangFuse initialized for {environment} environment")
                else:
                    print("LangFuse keys not configured. Observability disabled.")
                    self.enabled = False
            except Exception as e:
                print(f"Failed to initialize LangFuse: {e}")
                self.enabled = False

    @asynccontextmanager
    async def trace_llm_call(
        self,
        name: str,
        provider: str,
        model: str,
        input_data: dict[str, Any],
        metadata: Optional[dict[str, Any]] = None,
    ):
        """Context manager to trace LLM calls"""
        start_time = time.time()
        trace = None
        generation = None

        if self.enabled and self.langfuse:
            # Start trace
            trace = self.langfuse.trace(
                name=name,
                metadata={
                    "provider": provider,
                    "model": model,
                    "environment": self.environment,
                    **(metadata or {}),
                },
            )

            # Start generation span
            generation = trace.generation(
                name=f"{provider}_{model}", model=model, input=input_data
            )

        try:
            yield {"trace": trace, "generation": generation, "start_time": start_time}

        except Exception as e:
            self.metrics["errors"] += 1
            if generation:
                generation.end(level="ERROR", status_message=str(e))
            raise

        finally:
            latency_ms = (time.time() - start_time) * 1000
            self.metrics["total_calls"] += 1
            self.metrics["total_latency_ms"] += latency_ms

    def record_completion(
        self,
        trace_context: dict[str, Any],
        output: Any,
        tokens: Optional[dict[str, int]] = None,
        cost: Optional[float] = None,
    ):
        """Record successful completion"""
        if not self.enabled:
            return

        generation = trace_context.get("generation")
        if generation:
            generation.end(
                output=output, usage=tokens, metadata={"cost": cost} if cost else None
            )

        # Update metrics
        if tokens:
            total = tokens.get("input", 0) + tokens.get("output", 0)
            self.metrics["total_tokens"] += total

        if cost:
            self.metrics["total_cost"] += cost

    def record_cache_hit(self, query: str):
        """Record a cache hit"""
        self.metrics["cache_hits"] += 1

        if self.enabled and self.langfuse:
            self.langfuse.event(
                name="cache_hit",
                input={"query": query},
                metadata={"environment": self.environment},
            )

    def record_cache_miss(self, query: str):
        """Record a cache miss"""
        self.metrics["cache_misses"] += 1

        if self.enabled and self.langfuse:
            self.langfuse.event(
                name="cache_miss",
                input={"query": query},
                metadata={"environment": self.environment},
            )

    def get_metrics(self) -> dict[str, Any]:
        """Get current metrics"""
        metrics = self.metrics.copy()

        # Calculate averages
        if metrics["total_calls"] > 0:
            metrics["avg_latency_ms"] = (
                metrics["total_latency_ms"] / metrics["total_calls"]
            )
            metrics["avg_cost"] = metrics["total_cost"] / metrics["total_calls"]
            metrics["avg_tokens"] = metrics["total_tokens"] / metrics["total_calls"]
            metrics["cache_hit_rate"] = (
                metrics["cache_hits"]
                / (metrics["cache_hits"] + metrics["cache_misses"])
                if (metrics["cache_hits"] + metrics["cache_misses"]) > 0
                else 0
            )
        else:
            metrics["avg_latency_ms"] = 0
            metrics["avg_cost"] = 0
            metrics["avg_tokens"] = 0
            metrics["cache_hit_rate"] = 0

        return metrics

    def flush(self):
        """Flush any pending data to LangFuse"""
        if self.enabled and self.langfuse:
            self.langfuse.flush()

    def shutdown(self):
        """Shutdown observability"""
        self.flush()
        if self.langfuse:
            self.langfuse.shutdown()


# Decorator for observing functions (if LangFuse is available)
def observe_llm(name: str | None = None):
    """Decorator to observe LLM functions"""

    def decorator(func):
        if not LANGFUSE_AVAILABLE:
            return func

        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Use LangFuse's observe decorator if available
            if LANGFUSE_AVAILABLE:
                return await observe(name=name or func.__name__)(func)(*args, **kwargs)
            return await func(*args, **kwargs)

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            if LANGFUSE_AVAILABLE:
                return observe(name=name or func.__name__)(func)(*args, **kwargs)
            return func(*args, **kwargs)

        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper

    return decorator


# Global observability instance (can be initialized in app startup)
_observability: Optional[LLMObservability] = None


def init_observability(enabled: bool = True, **kwargs) -> LLMObservability:
    """Initialize global observability"""
    global _observability
    _observability = LLMObservability(enabled=enabled, **kwargs)
    return _observability


def get_observability() -> Optional[LLMObservability]:
    """Get global observability instance"""
    return _observability
