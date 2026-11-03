import re
from typing import Any

from langchain_core.runnables import RunnableConfig

from app.agent.prompts import ANSWER_WITH_CITATIONS_SYSTEM, tag
from app.agent.state import AgentState, deps_from, llm_steps, step
from app.llm.base import ChatMessage, LLMTask
from app.schemas import Citation

NO_ANSWER = (
    "I couldn't find that in the knowledge base. Please check with your sales manager or credit control."
)


async def retrieve(state: AgentState, config: RunnableConfig) -> dict[str, Any]:
    deps = deps_from(config)
    outcome = await deps.search.search(state["user_text"], top_k=4)
    steps = []
    if outcome.fallback_reason:
        steps.append(step("retrieve", f"Search fallback to local BM25: {outcome.fallback_reason}"))
    titles = "; ".join(h.title for h in outcome.hits) or "no matches"
    steps.append(step("retrieve", f"{len(outcome.hits)} passages via {outcome.provider}: {titles}"))
    return {"hits": outcome.hits, "steps": steps}


async def answer_with_citations(state: AgentState, config: RunnableConfig) -> dict[str, Any]:
    hits = state.get("hits") or []
    if not hits:
        return {
            "reply": NO_ANSWER,
            "citations": [],
            "steps": [step("answer_with_citations", "No passages; declined to answer")],
        }

    deps = deps_from(config)
    documents = "\n".join(
        tag("document", h.snippet, index=i, title=h.title, doc=h.doc) for i, h in enumerate(hits, 1)
    )
    message = ChatMessage(
        role="user",
        content=f"{tag('documents', documents)}\n{tag('question', state['user_text'])}",
    )
    result = await deps.llm.text(LLMTask.ANSWER_WITH_CITATIONS, ANSWER_WITH_CITATIONS_SYSTEM, [message])

    cited = {int(n) for n in re.findall(r"\[(\d+)\]", result.value)}
    used = [h for i, h in enumerate(hits, 1) if i in cited] or hits
    citations = [Citation(doc=h.doc, title=h.title, snippet=h.snippet) for h in used]
    return {
        "reply": result.value,
        "citations": citations,
        "steps": [
            *llm_steps("answer_with_citations", result),
            step(
                "answer_with_citations",
                f"Grounded answer with {len(citations)} citation(s) ({result.provider})",
            ),
        ],
    }
