from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.agent.prompts import PROMPT_STUDIO_SYSTEM, tag
from app.llm.base import ChatMessage, LLMTask
from app.llm.service import LLMService, get_llm_service
from app.schemas import PromptStudioRequest, PromptStudioResult
from app.security import CurrentUser

router = APIRouter(prefix="/ai", tags=["prompt-studio"])


@router.post("/prompt-studio", response_model=PromptStudioResult)
async def prompt_studio(
    request: PromptStudioRequest,
    response: Response,
    _: CurrentUser,
    llm: Annotated[LLMService, Depends(get_llm_service)],
) -> PromptStudioResult:
    message = ChatMessage(
        role="user",
        content=f"{tag('requirement', request.requirement)}\n{tag('layer', request.layer)}",
    )
    result = await llm.structured(LLMTask.PROMPT_STUDIO, PROMPT_STUDIO_SYSTEM, [message], PromptStudioResult)
    response.headers["X-LLM-Provider"] = result.provider
    if result.fallback_reason:
        response.headers["X-LLM-Fallback"] = result.fallback_reason[:200]
    return result.value
