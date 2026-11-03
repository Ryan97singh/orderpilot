from typing import Any

from langchain_core.runnables import RunnableConfig

from app.agent.prompts import CLASSIFY_INTENT_SYSTEM, GENERAL_ANSWER_SYSTEM, tag
from app.agent.state import AgentState, deps_from, llm_steps, step
from app.llm.base import ChatMessage, LLMTask
from app.schemas import IntentResult


async def classify_intent(state: AgentState, config: RunnableConfig) -> dict[str, Any]:
    deps = deps_from(config)
    pending = deps.session.clarification
    context = tag("conversation_state", f"awaiting_clarification={pending.kind}") if pending else ""
    message: ChatMessage = {
        "role": "user",
        "content": f"{context}\n{tag('user_message', state['user_text'])}".strip(),
    }
    result = await deps.llm.structured(
        LLMTask.CLASSIFY_INTENT, CLASSIFY_INTENT_SYSTEM, [message], IntentResult
    )
    decision = result.value
    detail = f"{decision.intent} ({decision.confidence:.2f}, {result.provider}): {decision.reason}"
    return {
        "intent": decision.intent,
        "steps": [*llm_steps("classify_intent", result), step("classify_intent", detail)],
    }


def route_by_intent(state: AgentState) -> str:
    return {"ORDER": "extract_order", "KNOWLEDGE": "retrieve"}.get(state["intent"], "general_answer")


async def general_answer(state: AgentState, config: RunnableConfig) -> dict[str, Any]:
    deps = deps_from(config)
    messages = [*state["history"], ChatMessage(role="user", content=state["user_text"])]
    result = await deps.llm.text(LLMTask.GENERAL_ANSWER, GENERAL_ANSWER_SYSTEM, messages)
    return {
        "reply": result.value,
        "steps": [
            *llm_steps("general_answer", result),
            step("general_answer", f"Answered directly ({result.provider})"),
        ],
    }
