from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.agent.graph import run_agent
from app.agent.pending import PendingActionError, idempotency_key, verify
from app.agent.session import SessionStore, get_session_store
from app.agent.state import AgentDeps, AgentState
from app.clients.core_api import CoreApiClient, CoreApiError
from app.config import Settings, get_settings
from app.llm.base import ChatMessage
from app.llm.service import LLMService, get_llm_service
from app.schemas import ChatRequest, ChatResponse, ConfirmRequest, ConfirmResponse
from app.search.base import SearchService, get_search_service
from app.security import CurrentUser

router = APIRouter(prefix="/ai/chat", tags=["chat"])


def _history(request: ChatRequest, stored: list[ChatMessage], limit: int) -> list[ChatMessage]:
    """Client-sent history wins (stateless clients); otherwise use the server-side session."""
    turns = request.messages[:-1] if len(request.messages) > 1 else []
    sent = [
        ChatMessage(role="user" if m.role == "user" else "assistant", content=m.content)
        for m in turns
        if m.role != "system"
    ]
    return (sent or stored)[-limit:]


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    user: CurrentUser,
    settings: Annotated[Settings, Depends(get_settings)],
    llm: Annotated[LLMService, Depends(get_llm_service)],
    search: Annotated[SearchService, Depends(get_search_service)],
    sessions: Annotated[SessionStore, Depends(get_session_store)],
) -> ChatResponse:
    latest = request.messages[-1]
    if latest.role != "user" or not latest.content.strip():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Last message must be a non-empty user message"
        )

    session = sessions.get(user.sub, request.session_id)
    async with CoreApiClient(settings.core_api_url, user.token, settings.core_api_timeout_s) as core_api:
        deps = AgentDeps(
            llm=llm,
            search=search,
            core_api=core_api,
            session=session,
            session_id=request.session_id,
            user_sub=user.sub,
            signing_secret=settings.jwt_secret,
            pending_ttl_s=settings.pending_action_ttl_s,
        )
        state = await run_agent(
            deps,
            AgentState(
                user_text=latest.content.strip(),
                history=_history(request, list(session.messages), settings.session_max_messages),
                outlet_id=request.outlet_id,
            ),
        )

    reply = state.get("reply", "")
    session.messages.append(ChatMessage(role="user", content=latest.content))
    session.messages.append(ChatMessage(role="assistant", content=reply))
    return ChatResponse(
        reply=reply,
        intent=state.get("intent", "GENERAL"),
        quote=state.get("quote"),
        pending_action=state.get("pending_action"),
        citations=state.get("citations", []),
        steps=state.get("steps", []),
    )


@router.post("/confirm", response_model=ConfirmResponse)
async def confirm(
    request: ConfirmRequest,
    user: CurrentUser,
    settings: Annotated[Settings, Depends(get_settings)],
) -> ConfirmResponse:
    action = request.pending_action
    try:
        verify(action, user.sub, request.session_id, settings.jwt_secret)
    except PendingActionError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    key = idempotency_key(request.session_id, action)
    async with CoreApiClient(settings.core_api_url, user.token, settings.core_api_timeout_s) as core_api:
        try:
            order = await core_api.create_order(action.payload.model_dump(), key)
        except CoreApiError as exc:
            code = exc.status if 400 <= exc.status < 500 else status.HTTP_502_BAD_GATEWAY
            raise HTTPException(code, f"core-api: {exc.detail}") from exc

    order_no = order.get("orderNo", "the order")
    if order.get("status") == "PENDING_APPROVAL":
        reply = f"Order **{order_no}** was created and is **waiting for manager approval** (credit limit)."
    else:
        state = order.get("status", "CONFIRMED")
        reply = f"Order **{order_no}** is placed and **{state.lower()}**. Total AED {float(order.get('total') or 0):,.2f}."
    return ConfirmResponse(reply=reply, order=order)
