from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings

WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE_URL = f"sqlite+aiosqlite:///{(BACKEND_DIR / 'resume_agent.db').as_posix()}"
DEFAULT_UPLOAD_DIR = BACKEND_DIR / "uploads"
DEFAULT_EXPORT_DIR = BACKEND_DIR / "exports"
DEFAULT_CONSTITUTION_DIR = BACKEND_DIR / "constitution"
DEFAULT_KNOWLEDGE_DIR = BACKEND_DIR / "knowledge"
DEFAULT_TEMPLATES_DIR = DEFAULT_KNOWLEDGE_DIR / "templates"
COMMON_SETTINGS_CONFIG = {
    "env_file": (
        str(WORKSPACE_ROOT / ".env"),
        str(PROJECT_ROOT / ".env"),
        str(BACKEND_DIR / ".env"),
    ),
    "env_file_encoding": "utf-8",
    "extra": "ignore",
}


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

    model_config = {**COMMON_SETTINGS_CONFIG, "env_prefix": "LLM_"}


class DatabaseConfig(BaseSettings):
    """Database configuration."""

    url: str = Field(DEFAULT_DATABASE_URL, alias="DATABASE_URL")
    echo: bool = False

    model_config = COMMON_SETTINGS_CONFIG


class StorageConfig(BaseSettings):
    """Storage configuration."""

    upload_dir: Path = DEFAULT_UPLOAD_DIR
    export_dir: Path = DEFAULT_EXPORT_DIR
    max_file_size_mb: int = 10
    allowed_extensions: list[str] = [".pdf", ".docx", ".doc", ".txt", ".md"]

    model_config = {**COMMON_SETTINGS_CONFIG, "env_prefix": "STORAGE_"}


class PrivacyConfig(BaseSettings):
    """Privacy and retention configuration."""

    upload_ttl_days: int = 7
    profile_ttl_days: int = 30
    version_ttl_days: int = 90
    log_ttl_days: int = 180
    anonymize_llm_input: bool = True
    encrypt_pii: bool = True

    model_config = {**COMMON_SETTINGS_CONFIG, "env_prefix": "PRIVACY_"}


class Settings(BaseSettings):
    """Global application settings."""

    app_name: str = "Resume Agent System"
    version: str = "0.1.0"
    # Use APP_DEBUG to avoid collision with global DEBUG=release.
    debug: bool = Field(True, alias="APP_DEBUG")
    host: str = "0.0.0.0"
    port: int = Field(8000, alias="PORT")
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

    workspace_dir: Path = WORKSPACE_ROOT
    repo_dir: Path = PROJECT_ROOT
    base_dir: Path = BACKEND_DIR
    constitution_dir: Path = DEFAULT_CONSTITUTION_DIR
    knowledge_dir: Path = DEFAULT_KNOWLEDGE_DIR
    templates_dir: Path = DEFAULT_TEMPLATES_DIR

    model_config = COMMON_SETTINGS_CONFIG


settings = Settings()
