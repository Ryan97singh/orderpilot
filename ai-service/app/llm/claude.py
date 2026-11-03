import anthropic
from anthropic.types.beta import BetaMessageParam, BetaOutputConfigParam
from pydantic import BaseModel

from app.llm.base import (
    TASK_PROFILES,
    ChatMessage,
    Completion,
    LLMProviderError,
    LLMTask,
    normalize_turns,
    strict_json_schema,
)

# Server-side refusal fallback: the API re-routes a declined request within the same call.
_FALLBACK_BETA = "server-side-fallback-2026-07-01"


class ClaudeProvider:
    name = "claude"

    def __init__(self, api_key: str, model: str) -> None:
        if not api_key:
            raise LLMProviderError("ANTHROPIC_API_KEY is not set")
        self.model = model
        self._client = anthropic.AsyncAnthropic(api_key=api_key, max_retries=2, timeout=30.0)

    async def generate(
        self,
        task: LLMTask,
        system: str,
        messages: list[ChatMessage],
        schema: type[BaseModel] | None = None,
    ) -> Completion:
        profile = TASK_PROFILES[task]
        output_config: BetaOutputConfigParam = {"effort": profile.effort}
        if schema is not None:
            output_config["format"] = {"type": "json_schema", "schema": strict_json_schema(schema)}

        try:
            response = await self._client.beta.messages.create(
                model=self.model,
                max_tokens=profile.max_tokens,
                system=system,
                messages=_to_params(messages),
                output_config=output_config,
                betas=[_FALLBACK_BETA],
                fallbacks="default",
            )
        except anthropic.RateLimitError as exc:
            raise LLMProviderError("Claude rate limited") from exc
        except anthropic.AuthenticationError as exc:
            raise LLMProviderError("Claude authentication failed") from exc
        except anthropic.APIStatusError as exc:
            raise LLMProviderError(f"Claude API error {exc.status_code}") from exc
        except anthropic.APIConnectionError as exc:
            raise LLMProviderError("Claude unreachable") from exc

        if response.stop_reason == "refusal":
            raise LLMProviderError("Claude declined the request")
        if response.stop_reason == "max_tokens" and schema is not None:
            raise LLMProviderError("Claude output truncated at max_tokens")

        text = "".join(block.text for block in response.content if block.type == "text")
        return Completion(
            text=text,
            model=self.model,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )


def _to_params(messages: list[ChatMessage]) -> list[BetaMessageParam]:
    params: list[BetaMessageParam] = []
    for m in normalize_turns(messages):
        if m["role"] == "user":
            params.append({"role": "user", "content": m["content"]})
        else:
            params.append({"role": "assistant", "content": m["content"]})
    return params
