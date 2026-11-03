"""Provider routing with graceful degradation: primary provider -> mock on budget/errors."""

import logging
from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache

from pydantic import BaseModel, ValidationError

from app.config import Settings, get_settings
from app.llm.base import ChatMessage, Completion, LLMProvider, LLMProviderError, LLMTask
from app.llm.budget import DailyBudget
from app.llm.mock import MockProvider

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class LLMResult[V]:
    value: V
    provider: str
    fallback_reason: str | None = None
    cost_usd: float = 0.0


class LLMService:
    def __init__(self, primary: LLMProvider, budget: DailyBudget, init_error: str | None = None):
        self.primary = primary
        self.budget = budget
        self.mock = MockProvider()
        self._init_error = init_error

    @property
    def provider_name(self) -> str:
        return self.primary.name

    async def text(self, task: LLMTask, system: str, messages: list[ChatMessage]) -> LLMResult[str]:
        return await self._run(task, system, messages, schema=None, parse=lambda c: c.text)

    async def structured[T: BaseModel](
        self, task: LLMTask, system: str, messages: list[ChatMessage], schema: type[T]
    ) -> LLMResult[T]:
        return await self._run(
            task, system, messages, schema, parse=lambda c: schema.model_validate_json(c.text)
        )

    async def _run[V](
        self,
        task: LLMTask,
        system: str,
        messages: list[ChatMessage],
        schema: type[BaseModel] | None,
        parse: Callable[[Completion], V],
    ) -> LLMResult[V]:
        reason = self._init_error
        if reason is None and self.primary.name != "mock" and self.budget.exceeded:
            reason = f"daily LLM budget of ${self.budget.limit_usd:.2f} exceeded"

        if reason is None and self.primary.name != "mock":
            try:
                completion: Completion = await self.primary.generate(task, system, messages, schema)
                cost = self.budget.record(completion.model, completion.input_tokens, completion.output_tokens)
                return LLMResult(parse(completion), self.primary.name, cost_usd=cost)
            except LLMProviderError as exc:
                reason = str(exc)
            except (ValidationError, ValueError) as exc:
                reason = f"{self.primary.name} returned invalid output ({type(exc).__name__})"
            except Exception as exc:  # never let a provider bug take the agent down
                log.exception("llm_provider_crash", extra={"task": task.value})
                reason = f"{self.primary.name} failed ({type(exc).__name__})"
            log.warning("llm_fallback", extra={"task": task.value, "reason": reason})

        completion = await self.mock.generate(task, system, messages, schema)
        return LLMResult(parse(completion), "mock", fallback_reason=reason)


def build_llm_service(settings: Settings) -> LLMService:
    budget = DailyBudget(limit_usd=settings.llm_daily_budget_usd)
    try:
        match settings.llm_provider:
            case "claude":
                from app.llm.claude import ClaudeProvider

                return LLMService(ClaudeProvider(settings.anthropic_api_key, settings.claude_model), budget)
            case "azure_openai":
                from app.llm.azure_openai import AzureOpenAIProvider

                return LLMService(
                    AzureOpenAIProvider(
                        settings.azure_openai_endpoint,
                        settings.azure_openai_api_key,
                        settings.azure_openai_deployment,
                        settings.azure_openai_api_version,
                    ),
                    budget,
                )
    except LLMProviderError as exc:
        log.warning("llm_provider_unavailable", extra={"reason": str(exc)})
        return LLMService(_Unavailable(settings.llm_provider), budget, init_error=str(exc))
    return LLMService(MockProvider(), budget)


class _Unavailable:
    """Placeholder primary when the configured provider cannot be constructed."""

    def __init__(self, name: str) -> None:
        self.name = name

    async def generate(self, *args: object, **kwargs: object) -> Completion:
        raise LLMProviderError(f"{self.name} is not configured")


@lru_cache
def get_llm_service() -> LLMService:
    return build_llm_service(get_settings())
