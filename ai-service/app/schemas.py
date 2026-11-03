"""Typed contract: API request/response models and LLM structured-output models."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

Intent = Literal["ORDER", "KNOWLEDGE", "GENERAL"]
Layer = Literal["backend", "frontend", "ai", "fullstack"]


# ---- LLM structured outputs ---------------------------------------------------------------


class IntentResult(BaseModel):
    intent: Intent
    confidence: float = Field(ge=0, le=1)
    reason: str


class ExtractedLine(BaseModel):
    product_ref: str = Field(min_length=1, description="Product as the rep wrote it")
    qty_cases: int = Field(gt=0, le=10_000)


class OrderExtraction(BaseModel):
    outlet_ref: str | None = Field(description="Outlet name/code as written, or null")
    lines: list[ExtractedLine]
    notes: str | None = Field(description="Delivery notes or instructions, or null")
    missing_info: list[str] = Field(description="What the rep still needs to tell us")


class StudioAnalysis(BaseModel):
    actors: list[str]
    entities: list[str]
    rules: list[str]
    open_questions: list[str]


class PromptStudioResult(BaseModel):
    analysis: StudioAnalysis
    prompt: str
    acceptance_criteria: list[str]


# ---- API ------------------------------------------------------------------------------------


class Message(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(max_length=8000)


class Step(BaseModel):
    node: str
    detail: str


class Citation(BaseModel):
    doc: str
    title: str
    snippet: str


class OrderLineInput(BaseModel):
    sku: str
    qtyCases: int = Field(gt=0)


class PlaceOrderPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    outletId: int
    lines: list[OrderLineInput] = Field(min_length=1)
    notes: str | None = None
    source: Literal["AI_AGENT"] = "AI_AGENT"


class PendingAction(BaseModel):
    type: Literal["PLACE_ORDER"] = "PLACE_ORDER"
    payload: PlaceOrderPayload
    expires_at: int = Field(description="Unix seconds; confirm is rejected afterwards")
    signature: str = Field(description="HMAC binding the action to user + session")


class ChatRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    messages: list[Message] = Field(min_length=1)
    outlet_id: int | None = None


class ChatResponse(BaseModel):
    reply: str
    intent: Intent
    quote: dict[str, Any] | None = None
    pending_action: PendingAction | None = None
    order: dict[str, Any] | None = None
    citations: list[Citation] = []
    steps: list[Step] = []


class ConfirmRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    pending_action: PendingAction


class ConfirmResponse(BaseModel):
    reply: str
    order: dict[str, Any]


class KnowledgeSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    top_k: int = Field(default=4, ge=1, le=20)


class SearchHit(BaseModel):
    doc: str
    title: str
    snippet: str
    score: float


class KnowledgeSearchResponse(BaseModel):
    query: str
    provider: str
    hits: list[SearchHit]


class PromptStudioRequest(BaseModel):
    requirement: str = Field(min_length=10, max_length=6000)
    layer: Layer = "fullstack"


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "ai-service"
    version: str
    llm_provider: str
    search_provider: str
    auth_mode: str
