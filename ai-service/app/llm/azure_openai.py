import openai
from openai.types.chat import ChatCompletionMessageParam
from openai.types.shared_params import ResponseFormatJSONSchema
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


class AzureOpenAIProvider:
    name = "azure_openai"

    def __init__(self, endpoint: str, api_key: str, deployment: str, api_version: str) -> None:
        if not endpoint or not api_key:
            raise LLMProviderError("AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY are not set")
        self.model = deployment
        self._client = openai.AsyncAzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=api_version,
            max_retries=2,
            timeout=30.0,
        )

    async def generate(
        self,
        task: LLMTask,
        system: str,
        messages: list[ChatMessage],
        schema: type[BaseModel] | None = None,
    ) -> Completion:
        response_format: ResponseFormatJSONSchema | openai.Omit = openai.omit
        if schema is not None:
            response_format = {
                "type": "json_schema",
                "json_schema": {
                    "name": schema.__name__,
                    "schema": strict_json_schema(schema),
                    "strict": True,
                },
            }

        try:
            response = await self._client.chat.completions.create(
                model=self.model,
                messages=self._messages(system, messages),
                max_completion_tokens=TASK_PROFILES[task].max_tokens,
                response_format=response_format,
            )
        except openai.RateLimitError as exc:
            raise LLMProviderError("Azure OpenAI rate limited") from exc
        except openai.APIStatusError as exc:
            raise LLMProviderError(f"Azure OpenAI error {exc.status_code}") from exc
        except openai.APIConnectionError as exc:
            raise LLMProviderError("Azure OpenAI unreachable") from exc

        choice = response.choices[0]
        if choice.finish_reason == "content_filter":
            raise LLMProviderError("Azure OpenAI content filter triggered")
        usage = response.usage
        return Completion(
            text=choice.message.content or "",
            model=self.model,
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
        )

    @staticmethod
    def _messages(system: str, messages: list[ChatMessage]) -> list[ChatCompletionMessageParam]:
        converted: list[ChatCompletionMessageParam] = [{"role": "system", "content": system}]
        for m in normalize_turns(messages):
            if m["role"] == "user":
                converted.append({"role": "user", "content": m["content"]})
            else:
                converted.append({"role": "assistant", "content": m["content"]})
        return converted
