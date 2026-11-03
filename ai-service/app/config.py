from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    version: str = "0.1.0"
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:3000"

    # Auth
    auth_mode: Literal["demo", "entra"] = "demo"
    jwt_secret: str = "orderpilot-dev-secret-change-me-please-32b"
    jwt_issuer: str = "orderpilot-demo"
    entra_tenant_id: str = ""
    entra_audience: str = ""

    # Downstream Java API
    core_api_url: str = "http://localhost:8080"
    core_api_timeout_s: float = 15.0

    # LLM
    llm_provider: Literal["claude", "azure_openai", "mock"] = "mock"
    llm_daily_budget_usd: float = 1.0
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-5-5"
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_openai_deployment: str = "gpt-4o-mini"
    azure_openai_api_version: str = "2024-10-21"

    # Retrieval
    search_provider: Literal["azure_ai_search", "local"] = "local"
    azure_search_endpoint: str = ""
    azure_search_key: str = ""
    azure_search_index: str = "orderpilot-knowledge"
    knowledge_dir: Path = SERVICE_ROOT / "knowledge"

    # Agent
    session_max_messages: int = Field(default=20, ge=2)
    session_max_count: int = 1000
    pending_action_ttl_s: int = 900

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
