from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class LLMConfig(BaseSettings):
    """LLM provider configuration."""

    default_provider: str = Field("openai", description="Default LLM provider")
    openai_api_key: Optional[str] = Field(None, alias="OPENAI_API_KEY")
    openai_model: str = "gpt-4o"
    anthropic_api_key: Optional[str] = Field(None, alias="ANTHROPIC_API_KEY")
    anthropic_model: str = "claude-sonnet-4-20250514"
    deepseek_api_key: Optional[str] = Field(None, alias="DEEPSEEK_API_KEY")
    deepseek_model: str = "deepseek-chat"

    # Fallback order for provider downgrade.
    fallback_order: list[str] = ["openai", "anthropic", "deepseek"]
    max_retries: int = 3
    timeout: int = 60

    model_config = {"env_prefix": "LLM_", "extra": "ignore"}


class DatabaseConfig(BaseSettings):
    """Database configuration."""

    url: str = Field("sqlite+aiosqlite:///./resume_agent.db", alias="DATABASE_URL")
    echo: bool = False

    model_config = {"extra": "ignore"}


class StorageConfig(BaseSettings):
    """Storage configuration."""

    upload_dir: Path = Path("./uploads")
    export_dir: Path = Path("./exports")
    max_file_size_mb: int = 10
    allowed_extensions: list[str] = [".pdf", ".docx", ".doc", ".txt", ".md"]

    model_config = {"env_prefix": "STORAGE_", "extra": "ignore"}


class PrivacyConfig(BaseSettings):
    """Privacy and retention configuration."""

    upload_ttl_days: int = 7
    profile_ttl_days: int = 30
    version_ttl_days: int = 90
    log_ttl_days: int = 180
    anonymize_llm_input: bool = True
    encrypt_pii: bool = True

    model_config = {"env_prefix": "PRIVACY_", "extra": "ignore"}


class Settings(BaseSettings):
    """Global application settings."""

    app_name: str = "Resume Agent System"
    version: str = "0.1.0"
    # Use APP_DEBUG to avoid collision with global DEBUG=release.
    debug: bool = Field(True, alias="APP_DEBUG")
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    llm: LLMConfig = LLMConfig()
    database: DatabaseConfig = DatabaseConfig()
    storage: StorageConfig = StorageConfig()
    privacy: PrivacyConfig = PrivacyConfig()

    base_dir: Path = Path(__file__).parent.parent.parent
    constitution_dir: Path = base_dir / "constitution"
    knowledge_dir: Path = base_dir / "knowledge"
    templates_dir: Path = base_dir / "knowledge" / "templates"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
