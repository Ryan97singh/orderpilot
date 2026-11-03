from typing import Annotated

from fastapi import APIRouter, Depends

from app.schemas import KnowledgeSearchRequest, KnowledgeSearchResponse
from app.search.base import SearchService, get_search_service
from app.security import CurrentUser

router = APIRouter(prefix="/ai/knowledge", tags=["knowledge"])


@router.post("/search", response_model=KnowledgeSearchResponse)
async def search_knowledge(
    request: KnowledgeSearchRequest,
    _: CurrentUser,
    search: Annotated[SearchService, Depends(get_search_service)],
) -> KnowledgeSearchResponse:
    outcome = await search.search(request.query, request.top_k)
    return KnowledgeSearchResponse(query=request.query, provider=outcome.provider, hits=outcome.hits)
