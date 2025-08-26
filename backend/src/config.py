import os

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Primary LLM Configuration
    llm_provider: str = os.getenv("LLM_PROVIDER", "mock")  # mock, openai, anthropic
    llm_api_key: str = os.getenv("LLM_API_KEY", "")
    llm_model: str = os.getenv("LLM_MODEL", "")  # Auto-selects if empty
    llm_temperature_intent: float = 0.3
    llm_temperature_entity: float = 0.0
    llm_timeout: int = 5
    llm_max_tokens: int = 500

    # Fallback LLM Configuration
    llm_fallback_provider: str = os.getenv("LLM_FALLBACK_PROVIDER", "")
    llm_fallback_model: str = os.getenv("LLM_FALLBACK_MODEL", "")

    # Provider-specific API Keys
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")

    # Default models per provider
    openai_default_model: str = "gpt-4o-mini"
    anthropic_default_model: str = "claude-3-haiku-20240307"

    # Observability Configuration (LangFuse)
    langfuse_enabled: bool = os.getenv("LANGFUSE_ENABLED", "false").lower() == "true"
    langfuse_public_key: str = os.getenv("LANGFUSE_PUBLIC_KEY", "")
    langfuse_secret_key: str = os.getenv("LANGFUSE_SECRET_KEY", "")
    langfuse_host: str = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")
    environment: str = os.getenv("ENVIRONMENT", "development")

    # Infrastructure (defaults to mock for prototype)
    redis_url: str = os.getenv("REDIS_URL", "mock")  # Use "mock" for testing
    database_url: str = os.getenv("DATABASE_URL", "mock")  # Use "mock" for testing

    # API Settings
    rate_limit_per_minute: int = 30
    session_ttl_seconds: int = 3600
    cors_allowed_origins: list = ["http://localhost:3000"]

    # Security
    secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    algorithm: str = "HS256"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
