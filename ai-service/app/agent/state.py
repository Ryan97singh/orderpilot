import operator
from dataclasses import dataclass
from typing import Annotated, Any, TypedDict

from langchain_core.runnables import RunnableConfig

from app.agent.session import Clarification, OrderDraft, Session
from app.clients.core_api import CoreApiClient
from app.llm.base import ChatMessage
from app.llm.service import LLMResult, LLMService
from app.schemas import Citation, Intent, PendingAction, SearchHit, Step
from app.search.base import SearchService


class AgentState(TypedDict, total=False):
    # input
    user_text: str
    history: list[ChatMessage]
    outlet_id: int | None
    # working memory
    intent: Intent
    draft: OrderDraft
    prior_clarification: Clarification | None
    hits: list[SearchHit]
    question: str
    # output
    reply: str
    quote: dict[str, Any] | None
    pending_action: PendingAction | None
    citations: list[Citation]
    steps: Annotated[list[Step], operator.add]


@dataclass(frozen=True)
class AgentDeps:
    """Per-request collaborators, passed to nodes through the LangGraph run config."""

    llm: LLMService
    search: SearchService
    core_api: CoreApiClient
    session: Session
    session_id: str
    user_sub: str
    signing_secret: str
    pending_ttl_s: int


def deps_from(config: RunnableConfig) -> AgentDeps:
    return config["configurable"]["deps"]


def step(node: str, detail: str) -> Step:
    return Step(node=node, detail=detail)


def llm_steps(node: str, result: LLMResult[Any]) -> list[Step]:
    if result.fallback_reason:
        return [step(node, f"LLM fallback to mock: {result.fallback_reason}")]
    return []
