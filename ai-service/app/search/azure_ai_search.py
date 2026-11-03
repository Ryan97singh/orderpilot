from anyio import to_thread
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient

from app.schemas import SearchHit
from app.search.chunking import snippet

# Index schema (see scripts/index_knowledge.py): id (key), doc, title, content (searchable).
_FIELDS = ["id", "doc", "title", "content"]


class AzureAISearch:
    name = "azure_ai_search"

    def __init__(self, endpoint: str, key: str, index: str) -> None:
        if not endpoint or not key:
            raise ValueError("AZURE_SEARCH_ENDPOINT / AZURE_SEARCH_KEY are not set")
        self._client = SearchClient(endpoint, index, AzureKeyCredential(key))

    def _search_sync(self, query: str, top_k: int) -> list[SearchHit]:
        results = self._client.search(search_text=query, top=top_k, select=_FIELDS)
        return [
            SearchHit(
                doc=r["doc"],
                title=r["title"],
                snippet=snippet(r["content"]),
                score=round(float(r["@search.score"]), 3),
            )
            for r in results
        ]

    async def search(self, query: str, top_k: int) -> list[SearchHit]:
        return await to_thread.run_sync(self._search_sync, query, top_k)
