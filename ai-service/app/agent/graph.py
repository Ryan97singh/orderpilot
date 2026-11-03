from functools import lru_cache

from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.agent.nodes.knowledge import answer_with_citations, retrieve
from app.agent.nodes.order import ask_or, ask_user, extract_order, propose, quote, resolve_entities
from app.agent.nodes.routing import classify_intent, general_answer, route_by_intent
from app.agent.state import AgentDeps, AgentState


def build_graph() -> CompiledStateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("classify_intent", classify_intent)
    graph.add_node("extract_order", extract_order)
    graph.add_node("resolve_entities", resolve_entities)
    graph.add_node("quote", quote)
    graph.add_node("propose", propose)
    graph.add_node("ask_user", ask_user)
    graph.add_node("retrieve", retrieve)
    graph.add_node("answer_with_citations", answer_with_citations)
    graph.add_node("general_answer", general_answer)

    graph.add_edge(START, "classify_intent")
    graph.add_conditional_edges(
        "classify_intent",
        route_by_intent,
        ["extract_order", "retrieve", "general_answer"],
    )
    graph.add_conditional_edges("extract_order", ask_or("resolve_entities"), ["resolve_entities", "ask_user"])
    graph.add_conditional_edges("resolve_entities", ask_or("quote"), ["quote", "ask_user"])
    graph.add_conditional_edges("quote", ask_or("propose"), ["propose", "ask_user"])
    graph.add_edge("retrieve", "answer_with_citations")
    for terminal in ("propose", "ask_user", "answer_with_citations", "general_answer"):
        graph.add_edge(terminal, END)

    return graph.compile()


@lru_cache
def get_graph() -> CompiledStateGraph:
    return build_graph()


async def run_agent(deps: AgentDeps, initial: AgentState) -> AgentState:
    config: RunnableConfig = {"configurable": {"deps": deps}, "recursion_limit": 20}
    result = await get_graph().ainvoke({**initial, "steps": []}, config=config)
    return AgentState(**result)  # type: ignore[typeddict-item]
