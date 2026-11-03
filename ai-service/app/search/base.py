import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

from app.config import Settings, get_settings
from app.schemas import SearchHit
from app.search.local_bm25 import LocalBM25Search

log = logging.getLogger(__name__)


class SearchProvider(Protocol):
    name: str

    async def search(self, query: str, top_k: int) -> list[SearchHit]: ...


@dataclass(frozen=True)
class SearchOutcome:
    hits: list[SearchHit]
    provider: str
    fallback_reason: str | None = None


class SearchService:
    """Primary provider with the local BM25 index as a safety net."""

    def __init__(self, primary: SearchProvider | None, local: LocalBM25Search, init_error: str | None = None):
        self.primary = primary
        self.local = local
        self._init_error = init_error

    @property
    def provider_name(self) -> str:
        return self.primary.name if self.primary else self.local.name

    async def search(self, query: str, top_k: int = 4) -> SearchOutcome:
        reason = self._init_error
        if self.primary is not None:
            try:
                return SearchOutcome(await self.primary.search(query, top_k), self.primary.name)
            except Exception as exc:  # network, auth, missing index...
                reason = f"{self.primary.name} failed ({type(exc).__name__})"
                log.warning("search_fallback", extra={"reason": reason})
        return SearchOutcome(await self.local.search(query, top_k), self.local.name, reason)


def build_search_service(settings: Settings) -> SearchService:
    local = LocalBM25Search(settings.knowledge_dir)
    if settings.search_provider != "azure_ai_search":
        return SearchService(None, local)
    try:
        from app.search.azure_ai_search import AzureAISearch

        azure = AzureAISearch(
            settings.azure_search_endpoint, settings.azure_search_key, settings.azure_search_index
        )
        return SearchService(azure, local)
    except ValueError as exc:
        return SearchService(None, local, init_error=f"azure_ai_search unavailable: {exc}")


@lru_cache
def get_search_service() -> SearchService:
    return build_search_service(get_settings())
