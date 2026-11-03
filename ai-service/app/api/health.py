from typing import Annotated

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.schemas import HealthResponse

router = APIRouter(prefix="/ai", tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(settings: Annotated[Settings, Depends(get_settings)]) -> HealthResponse:
    return HealthResponse(
        version=settings.version,
        llm_provider=settings.llm_provider,
        search_provider=settings.search_provider,
        auth_mode=settings.auth_mode,
    )
