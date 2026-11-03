import re
from pathlib import Path

from rank_bm25 import BM25Okapi

from app.schemas import SearchHit
from app.search.chunking import Chunk, load_chunks, snippet

_STOPWORDS = frozenset(
    "a an and are as at be by can do does for from how i if in is it of on or our the to "
    "we what when where which who why will with you your".split()
)


def tokenize(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)*", text.lower()) if t not in _STOPWORDS]


class LocalBM25Search:
    """In-process BM25 over the markdown knowledge base. Index is built lazily on first query."""

    name = "local"

    def __init__(self, knowledge_dir: Path) -> None:
        self._dir = knowledge_dir
        self._chunks: list[Chunk] | None = None
        self._bm25: BM25Okapi | None = None

    def _ensure_index(self) -> tuple[list[Chunk], BM25Okapi]:
        if self._chunks is None or self._bm25 is None:
            self._chunks = load_chunks(self._dir)
            if not self._chunks:
                raise RuntimeError(f"No knowledge documents found in {self._dir}")
            self._bm25 = BM25Okapi([tokenize(f"{c.title} {c.content}") for c in self._chunks])
        return self._chunks, self._bm25

    async def search(self, query: str, top_k: int) -> list[SearchHit]:
        chunks, bm25 = self._ensure_index()
        terms = tokenize(query)
        if not terms:
            return []
        scores = bm25.get_scores(terms)
        ranked = sorted(zip(chunks, scores, strict=True), key=lambda pair: pair[1], reverse=True)
        return [
            SearchHit(doc=c.doc, title=c.title, snippet=snippet(c.content), score=round(float(s), 3))
            for c, s in ranked[:top_k]
            if s > 0
        ]
