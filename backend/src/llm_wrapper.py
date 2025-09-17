"""Enhanced LLM client wrapper with provider switching and observability"""

import os
import logging
from enum import Enum
from typing import Any, Optional
import json

from .llm_client import AnthropicClient, LLMClient, MockLLMClient, OpenAIClient
from .llm_observability import get_observability

# Configure logger for LLM interactions
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class LLMProvider(str, Enum):
    """Supported LLM providers"""

    MOCK = "mock"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    LLAMA = "llama"
    AZURE_OPENAI = "azure_openai"  # Future support
    BEDROCK = "bedrock"  # Future support


class LLMModel(str, Enum):
    """Common model names across providers"""

    # Mock models
    MOCK = "mock"

    # OpenAI models
    GPT_4O_MINI = "gpt-4o-mini"
    GPT_4O = "gpt-4o"
    GPT_4_TURBO = "gpt-4-turbo"
    GPT_35_TURBO = "gpt-3.5-turbo"

    # Anthropic models
    CLAUDE_3_HAIKU = "claude-3-haiku-20240307"
    CLAUDE_3_SONNET = "claude-3-sonnet-20240229"
    CLAUDE_3_OPUS = "claude-3-opus-20240229"
    CLAUDE_35_SONNET = "claude-3-5-sonnet-20241022"

    # Llama models (common Ollama models)
    LLAMA_3_2_3B = "llama3.2:3b"
    LLAMA_3_2_1B = "llama3.2:1b"
    LLAMA_3_2_LATEST = "llama3.2:latest"
    LLAMA_3_1_8B = "llama3.1:8b"
    LLAMA_3_1_70B = "llama3.1:70b"
    CODELLAMA_7B = "codellama:7b"
    CODELLAMA_13B = "codellama:13b"
    MISTRAL_7B = "mistral:7b"
    MIXTRAL_8X7B = "mixtral:8x7b"


class EnhancedLLMClient:
    """Enhanced LLM client with observability and provider management"""

    def __init__(
        self,
        provider: LLMProvider = LLMProvider.MOCK,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        observability_enabled: bool = True,
        cache_enabled: bool = True,
        fallback_provider: Optional[LLMProvider] = None,
        fallback_model: Optional[str] = None,
    ):
        """Initialize enhanced LLM client

        Args:
        ----
            provider: Primary LLM provider
            model: Model to use (defaults based on provider)
            api_key: API key (can also use environment variables)
            observability_enabled: Enable LangFuse tracking
            cache_enabled: Enable response caching
            fallback_provider: Fallback provider if primary fails
            fallback_model: Model for fallback provider
        """
        self.provider = provider
        self.model = model or self._get_default_model(provider)
        self.api_key = api_key or self._get_api_key(provider)
        self.observability_enabled = observability_enabled
        self.cache_enabled = cache_enabled

        # Initialize primary client
        self.client = self._create_client(provider, self.model, self.api_key)

        # Initialize fallback client if configured
        self.fallback_client = None
        if fallback_provider:
            fallback_key = self._get_api_key(fallback_provider)
            fallback_model = fallback_model or self._get_default_model(
                fallback_provider
            )
            self.fallback_client = self._create_client(
                fallback_provider, fallback_model, fallback_key
            )

        # Get observability instance
        self.observability = get_observability() if observability_enabled else None

        # Metrics
        self.total_calls = 0
        self.fallback_used = 0
        self.errors = 0

    def _get_default_model(self, provider: LLMProvider) -> str:
        """Get default model for provider"""
        defaults = {
            LLMProvider.MOCK: "mock",
            LLMProvider.OPENAI: LLMModel.GPT_4O_MINI,
            LLMProvider.ANTHROPIC: LLMModel.CLAUDE_3_HAIKU,
            LLMProvider.LLAMA: LLMModel.LLAMA_3_2_LATEST,
        }
        return defaults.get(provider, "default")

    def _get_api_key(self, provider: LLMProvider) -> Optional[str]:
        """Get API key from environment (or base URL for Llama)"""
        if provider == LLMProvider.MOCK:
            return None

        env_keys = {
            LLMProvider.OPENAI: "OPENAI_API_KEY",
            LLMProvider.ANTHROPIC: "ANTHROPIC_API_KEY",
            LLMProvider.LLAMA: "LLAMA_BASE_URL",  # For Llama, this is the base URL
        }

        env_key = env_keys.get(provider)
        return os.getenv(env_key) if env_key else None

    def _create_client(
        self, provider: LLMProvider, model: str, api_key: Optional[str]
    ) -> LLMClient:
        """Create LLM client instance"""
        if provider == LLMProvider.MOCK:
            return MockLLMClient()
        elif provider == LLMProvider.OPENAI:
            if not api_key:
                raise ValueError("OpenAI API key required")
            return OpenAIClient(api_key, model)
        elif provider == LLMProvider.ANTHROPIC:
            if not api_key:
                raise ValueError("Anthropic API key required")
            return AnthropicClient(api_key, model)
        elif provider == LLMProvider.LLAMA:
            # For Llama, api_key is the base_url
            base_url = api_key if api_key else "http://localhost:11434"
            return LlamaClient(base_url, model)
        else:
            raise ValueError(f"Unsupported provider: {provider}")

    async def complete(
        self,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 500,
        timeout: float = 5.0,
        response_format: Optional[dict[str, str]] = None,
        use_cache: Optional[bool] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Complete a prompt with automatic fallback and observability

        Args:
        ----
            prompt: The prompt to complete
            temperature: Sampling temperature (0.0-1.0)
            max_tokens: Maximum tokens to generate
            timeout: Request timeout in seconds
            response_format: Format specification (e.g., {"type": "json_object"})
            use_cache: Override cache setting for this request
            metadata: Additional metadata for observability

        Returns:
        -------
            Dict with response and metadata
        """
        self.total_calls += 1

        # Prepare observability context
        obs_context = None
        if self.observability:
            async with self.observability.trace_llm_call(
                name="complete",
                provider=str(self.provider),
                model=self.model,
                input_data={"prompt": prompt[:500]},  # Truncate for logging
                metadata=metadata,
            ) as ctx:
                obs_context = ctx

        try:
            # Log LLM request details
            logger.info(f"🤖 LLM Request to {self.provider.value} ({self.model})")
            logger.debug(f"📝 Prompt: {prompt[:500]}..." if len(prompt) > 500 else f"📝 Prompt: {prompt}")
            logger.debug(f"⚙️  Parameters: temp={temperature}, max_tokens={max_tokens}, format={response_format}")

            # Try primary client
            result = await self.client.complete(
                prompt=prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout,
                response_format=response_format,
            )

            # Log LLM response
            logger.info(f"✅ LLM Response received from {self.provider.value}")
            logger.debug(f"📤 Response: {str(result)[:500]}..." if len(str(result)) > 500 else f"📤 Response: {result}")

            # Record success in observability
            if obs_context and self.observability:
                tokens = None
                cost = None

                # Extract metrics if available
                if hasattr(self.client, "total_tokens"):
                    tokens = {
                        "input": getattr(self.client, "input_tokens", 0),
                        "output": getattr(self.client, "output_tokens", 0),
                        "total": self.client.total_tokens,
                    }

                if hasattr(self.client, "total_cost"):
                    cost = self.client.total_cost

                self.observability.record_completion(
                    obs_context, output=result, tokens=tokens, cost=cost
                )

            # Add metadata to result
            result["_metadata"] = {
                "provider": str(self.provider),
                "model": self.model,
                "cached": False,
                "fallback": False,
            }

            return result

        except Exception as primary_error:
            self.errors += 1

            # Try fallback if available
            if self.fallback_client:
                try:
                    self.fallback_used += 1

                    result = await self.fallback_client.complete(
                        prompt=prompt,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        timeout=timeout,
                        response_format=response_format,
                    )

                    # Add fallback metadata
                    result["_metadata"] = {
                        "provider": "fallback",
                        "model": self.fallback_client.model
                        if hasattr(self.fallback_client, "model")
                        else "unknown",
                        "cached": False,
                        "fallback": True,
                        "primary_error": str(primary_error),
                    }

                    return result

                except Exception as fallback_error:
                    # Both failed
                    raise Exception(
                        f"Primary provider failed: {primary_error}\n"
                        f"Fallback provider failed: {fallback_error}"
                    )
            else:
                # No fallback available
                raise

    def get_metrics(self) -> dict[str, Any]:
        """Get client metrics"""
        metrics = {
            "total_calls": self.total_calls,
            "errors": self.errors,
            "fallback_used": self.fallback_used,
            "error_rate": self.errors / self.total_calls if self.total_calls > 0 else 0,
            "fallback_rate": self.fallback_used / self.total_calls
            if self.total_calls > 0
            else 0,
        }

        # Add client-specific metrics
        if hasattr(self.client, "total_tokens"):
            metrics["total_tokens"] = self.client.total_tokens

        if hasattr(self.client, "total_cost"):
            metrics["total_cost"] = self.client.total_cost

        # Add observability metrics if available
        if self.observability:
            metrics["observability"] = self.observability.get_metrics()

        return metrics

    def switch_provider(
        self,
        provider: LLMProvider,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
    ):
        """Switch to a different provider"""
        self.provider = provider
        self.model = model or self._get_default_model(provider)
        self.api_key = api_key or self._get_api_key(provider)
        self.client = self._create_client(provider, self.model, self.api_key)

    def __str__(self):
        return f"EnhancedLLMClient(provider={self.provider}, model={self.model})"


# Factory function for easy initialization
def create_enhanced_llm_client(
    provider: Optional[str] = None, **kwargs
) -> EnhancedLLMClient:
    """Create an enhanced LLM client with environment-based configuration

    Environment variables:
        LLM_PROVIDER: Provider to use (mock, openai, anthropic, llama)
        LLM_MODEL: Model to use
        OPENAI_API_KEY: OpenAI API key
        ANTHROPIC_API_KEY: Anthropic API key
        LLAMA_BASE_URL: Base URL for local Llama server (default: http://localhost:11434)
        LLM_FALLBACK_PROVIDER: Fallback provider
        LLM_FALLBACK_MODEL: Fallback model
        LANGFUSE_PUBLIC_KEY: LangFuse public key
        LANGFUSE_SECRET_KEY: LangFuse secret key
    """
    # Get provider from environment if not specified
    provider = provider or os.getenv("LLM_PROVIDER", "mock")

    # Convert string to enum
    if isinstance(provider, str):
        provider = LLMProvider(provider.lower())

    # Get other settings from environment
    model = kwargs.pop("model", None) or os.getenv("LLM_MODEL")
    fallback_provider = os.getenv("LLM_FALLBACK_PROVIDER")
    fallback_model = os.getenv("LLM_FALLBACK_MODEL")

    # Create client
    return EnhancedLLMClient(
        provider=provider,
        model=model,
        fallback_provider=LLMProvider(fallback_provider) if fallback_provider else None,
        fallback_model=fallback_model,
        **kwargs,
    )
