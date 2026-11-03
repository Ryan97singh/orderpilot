import asyncio

from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.llm.base import ChatMessage, Completion, LLMProviderError, LLMTask
from app.llm.budget import DailyBudget, estimate_cost_usd
from app.llm.service import LLMService, get_llm_service
from app.main import app
from app.schemas import IntentResult


class ExpensiveProvider:
    """Pretends to be a paid model: always answers GENERAL and reports heavy token usage."""

    name = "claude"

    def __init__(self) -> None:
        self.calls = 0

    async def generate(
        self, task: LLMTask, system: str, messages: list[ChatMessage], schema: type[BaseModel] | None = None
    ) -> Completion:
        self.calls += 1
        text = IntentResult(intent="GENERAL", confidence=0.9, reason="paid model").model_dump_json()
        return Completion(text=text, model="claude-sonnet-5-5", input_tokens=200_000, output_tokens=60_000)


class BrokenProvider:
    name = "azure_openai"

    async def generate(self, *args: object, **kwargs: object) -> Completion:
        raise LLMProviderError("Azure OpenAI error 500")


MESSAGE: list[ChatMessage] = [
    {"role": "user", "content": "<user_message>Order 10 cases FizzUp Cola for Palm Bay Hotel</user_message>"}
]


def test_cost_estimate_uses_model_prices() -> None:
    assert estimate_cost_usd("claude-sonnet-5-5", 1_000_000, 1_000_000) == 12.0


def test_budget_exceeded_falls_back_to_mock() -> None:
    primary = ExpensiveProvider()
    service = LLMService(primary, DailyBudget(limit_usd=1.0))

    first = asyncio.run(service.structured(LLMTask.CLASSIFY_INTENT, "sys", MESSAGE, IntentResult))
    assert first.provider == "claude" and first.cost_usd == 1.0  # 0.4 + 0.6

    second = asyncio.run(service.structured(LLMTask.CLASSIFY_INTENT, "sys", MESSAGE, IntentResult))
    assert second.provider == "mock"
    assert "budget" in (second.fallback_reason or "")
    assert second.value.intent == "ORDER"
    assert primary.calls == 1


def test_provider_error_falls_back_to_mock() -> None:
    service = LLMService(BrokenProvider(), DailyBudget(limit_usd=1.0))
    result = asyncio.run(service.text(LLMTask.GENERAL_ANSWER, "sys", MESSAGE))
    assert result.provider == "mock"
    assert result.fallback_reason == "Azure OpenAI error 500"


def test_budget_fallback_is_visible_in_agent_steps(client: TestClient, auth: dict[str, str]) -> None:
    service = LLMService(ExpensiveProvider(), DailyBudget(limit_usd=0.0))
    app.dependency_overrides[get_llm_service] = lambda: service

    response = client.post(
        "/ai/chat", headers=auth, json={"session_id": "b", "messages": [{"role": "user", "content": "hello"}]}
    )

    steps = response.json()["steps"]
    assert response.status_code == 200
    assert steps[0] == {
        "node": "classify_intent",
        "detail": "LLM fallback to mock: daily LLM budget of $0.00 exceeded",
    }


def test_misconfigured_provider_degrades_to_mock(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setenv("LLM_PROVIDER", "claude")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    from app.config import get_settings

    get_settings.cache_clear()
    service = get_llm_service()
    result = asyncio.run(service.text(LLMTask.GENERAL_ANSWER, "sys", MESSAGE))
    assert service.provider_name == "claude"
    assert result.provider == "mock"
    assert "ANTHROPIC_API_KEY" in (result.fallback_reason or "")
