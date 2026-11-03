from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Literal, Protocol, TypedDict

from pydantic import BaseModel


class LLMTask(StrEnum):
    CLASSIFY_INTENT = "classify_intent"
    EXTRACT_ORDER = "extract_order"
    ANSWER_WITH_CITATIONS = "answer_with_citations"
    GENERAL_ANSWER = "general_answer"
    PROMPT_STUDIO = "prompt_studio"


@dataclass(frozen=True)
class TaskProfile:
    max_tokens: int
    effort: Literal["low", "medium", "high"]


# Classification/extraction are cheap and latency-sensitive; generation gets more room.
TASK_PROFILES: dict[LLMTask, TaskProfile] = {
    LLMTask.CLASSIFY_INTENT: TaskProfile(max_tokens=1024, effort="low"),
    LLMTask.EXTRACT_ORDER: TaskProfile(max_tokens=2048, effort="low"),
    LLMTask.ANSWER_WITH_CITATIONS: TaskProfile(max_tokens=2048, effort="medium"),
    LLMTask.GENERAL_ANSWER: TaskProfile(max_tokens=1024, effort="low"),
    LLMTask.PROMPT_STUDIO: TaskProfile(max_tokens=8000, effort="medium"),
}


class ChatMessage(TypedDict):
    role: Literal["user", "assistant"]
    content: str


@dataclass(frozen=True)
class Completion:
    text: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0


def normalize_turns(messages: list[ChatMessage]) -> list[ChatMessage]:
    """Start with a user turn and merge consecutive same-role turns (provider requirement)."""
    turns: list[ChatMessage] = []
    for message in messages:
        if not turns and message["role"] != "user":
            continue
        if turns and turns[-1]["role"] == message["role"]:
            turns[-1] = ChatMessage(
                role=message["role"], content=f"{turns[-1]['content']}\n\n{message['content']}"
            )
        else:
            turns.append(message)
    return turns


class LLMProviderError(Exception):
    """Raised by providers for any failure; the LLM service falls back to mock."""


class LLMProvider(Protocol):
    name: str

    async def generate(
        self,
        task: LLMTask,
        system: str,
        messages: list[ChatMessage],
        schema: type[BaseModel] | None = None,
    ) -> Completion:
        """Return text, or a JSON document matching `schema` when one is given."""
        ...


_UNSUPPORTED_KEYWORDS = {
    "title", "default", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum",
    "minLength", "maxLength", "minItems", "maxItems", "pattern", "format",
}  # fmt: skip


def strict_json_schema(model: type[BaseModel]) -> dict[str, Any]:
    """Pydantic schema -> strict structured-output schema (closed objects, all keys required).

    Value constraints are dropped from the wire schema; pydantic re-validates the output.
    """

    def walk(node: Any) -> Any:
        if isinstance(node, dict):
            out = {k: walk(v) for k, v in node.items() if k not in _UNSUPPORTED_KEYWORDS}
            if out.get("type") == "object" and "properties" in out:
                out["additionalProperties"] = False
                out["required"] = list(out["properties"])
            return out
        if isinstance(node, list):
            return [walk(v) for v in node]
        return node

    schema = walk(model.model_json_schema())
    if "$defs" in schema:
        schema["$defs"] = {k: walk(v) for k, v in schema["$defs"].items()}
    return schema
