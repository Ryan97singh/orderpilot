"""ORDER branch: extract -> resolve -> quote -> propose. It never writes; the rep confirms."""

from collections.abc import Callable
from typing import Any

from langchain_core.runnables import RunnableConfig

from app.agent import replies
from app.agent.pending import sign_place_order
from app.agent.prompts import EXTRACT_ORDER_SYSTEM, tag
from app.agent.resolution import (
    choose,
    outlet_label,
    outlet_text,
    pick_from_candidates,
    product_text,
    search_candidates,
)
from app.agent.session import Clarification, DraftLine, OrderDraft
from app.agent.state import AgentDeps, AgentState, deps_from, llm_steps, step
from app.clients.core_api import CoreApiError
from app.llm.base import ChatMessage, LLMTask
from app.schemas import OrderExtraction, OrderLineInput, PlaceOrderPayload, Step

JsonDict = dict[str, Any]


def ask_or(next_node: str) -> Callable[[AgentState], str]:
    """Conditional edge: stop and ask the rep whenever a node raised a question."""

    def route(state: AgentState) -> str:
        return "ask_user" if state.get("question") else next_node

    route.__name__ = f"ask_or_{next_node}"
    return route


# ---- extract_order ------------------------------------------------------------------------


async def extract_order(state: AgentState, config: RunnableConfig) -> dict[str, Any]:
    deps = deps_from(config)
    latest = ChatMessage(role="user", content=tag("user_message", state["user_text"]))
    result = await deps.llm.structured(
        LLMTask.EXTRACT_ORDER, EXTRACT_ORDER_SYSTEM, [*state["history"][-6:], latest], OrderExtraction
    )
    prior = deps.session.clarification
    draft = _merge(deps.session.draft, prior, result.value, state["user_text"])
    deps.session.draft, deps.session.clarification = draft, None

    lines = ", ".join(f"{line.qty_cases} x '{line.product_ref}'" for line in draft.lines) or "none"
    outlet = draft.outlet_ref or state.get("outlet_id")
    update: dict[str, Any] = {
        "draft": draft,
        "prior_clarification": prior,
        "steps": [
            *llm_steps("extract_order", result),
            step("extract_order", f"outlet={outlet!r}; lines: {lines} ({result.provider})"),
        ],
    }

    missing = []
    if not draft.lines:
        missing.append("which products and how many cases")
    if not (draft.outlet or draft.outlet_ref or state.get("outlet_id")):
        missing.append("which outlet the order is for")
    if missing:
        deps.session.clarification = Clarification(kind="details")
        update["question"] = replies.missing_details(missing)
    return update


def _merge(
    previous: OrderDraft | None, prior: Clarification | None, new: OrderExtraction, text: str
) -> OrderDraft:
    """Fold a follow-up message into the draft that is waiting for clarification."""
    new_lines = [DraftLine(line.product_ref, line.qty_cases) for line in new.lines]
    if previous is None or prior is None:
        return OrderDraft(outlet_ref=new.outlet_ref, lines=new_lines, notes=new.notes)

    draft = previous
    if prior.kind == "outlet":
        draft.outlet, draft.outlet_ref = None, new.outlet_ref or text
    elif new.outlet_ref:
        draft.outlet, draft.outlet_ref = None, new.outlet_ref

    if prior.kind == "product" and prior.line_index is not None:
        line = draft.lines[prior.line_index]
        line.product, line.product_ref = None, new.lines[0].product_ref if new.lines else text
    elif new_lines:
        draft.lines = new_lines

    draft.notes = new.notes or draft.notes
    return draft


# ---- resolve_entities -----------------------------------------------------------------------


async def resolve_entities(state: AgentState, config: RunnableConfig) -> dict[str, Any]:
    deps = deps_from(config)
    draft, prior = state["draft"], state.get("prior_clarification")
    steps: list[Step] = []
    questions: list[tuple[str, Clarification]] = []

    try:
        await _resolve_outlet(deps, state, draft, prior, steps, questions)
        for index, line in enumerate(draft.lines):
            if line.product is None:
                await _resolve_product(deps, state["user_text"], line, index, prior, steps, questions)
    except CoreApiError as exc:
        failure = step("resolve_entities", f"core-api error {exc.status}: {exc.detail}")
        return {"question": replies.core_api_problem(exc), "steps": [*steps, failure]}

    deps.session.draft = draft
    if not questions:
        return {"draft": draft, "steps": steps}
    question, clarification = questions[0]  # one question at a time
    deps.session.clarification = clarification
    return {"draft": draft, "question": question, "steps": steps}


async def _resolve_outlet(
    deps: AgentDeps,
    state: AgentState,
    draft: OrderDraft,
    prior: Clarification | None,
    steps: list[Step],
    questions: list[tuple[str, Clarification]],
) -> None:
    if draft.outlet is None and draft.outlet_ref:
        previous = prior.candidates if prior and prior.kind == "outlet" else []
        draft.outlet = pick_from_candidates(state["user_text"], previous, outlet_text, "code")
        if draft.outlet is None:
            found = await search_candidates(deps.core_api.search_outlets, draft.outlet_ref, "code")
            resolution = choose(draft.outlet_ref, found, outlet_text, "code")
            draft.outlet = resolution.match
            if draft.outlet is None:
                questions.append(
                    (
                        replies.ask_outlet(draft.outlet_ref, resolution.candidates),
                        Clarification(kind="outlet", candidates=resolution.candidates),
                    )
                )
                detail = f"Outlet '{draft.outlet_ref}' is ambiguous ({len(resolution.candidates)} candidates)"
                steps.append(step("resolve_entities", detail))
    elif draft.outlet is None and (outlet_id := state.get("outlet_id")):
        draft.outlet = await deps.core_api.get_outlet(outlet_id)

    if draft.outlet:
        steps.append(step("resolve_entities", f"Outlet -> {outlet_label(draft.outlet)}"))


async def _resolve_product(
    deps: AgentDeps,
    user_text: str,
    line: DraftLine,
    index: int,
    prior: Clarification | None,
    steps: list[Step],
    questions: list[tuple[str, Clarification]],
) -> None:
    asked_about_this = prior and prior.kind == "product" and prior.line_index == index
    previous = prior.candidates if prior and asked_about_this else []
    line.product = pick_from_candidates(user_text, previous, product_text, "sku")
    if line.product is None:
        found = await search_candidates(deps.core_api.search_products, line.product_ref, "sku")
        resolution = choose(line.product_ref, found, product_text, "sku")
        line.product = resolution.match
        if line.product is None:
            questions.append(
                (
                    replies.ask_product(line, resolution.candidates),
                    Clarification(kind="product", candidates=resolution.candidates, line_index=index),
                )
            )
            detail = f"Product '{line.product_ref}' is ambiguous ({len(resolution.candidates)} candidates)"
            steps.append(step("resolve_entities", detail))
            return
    steps.append(step("resolve_entities", f"'{line.product_ref}' -> {line.product.get('sku')}"))


# ---- quote ----------------------------------------------------------------------------------


async def quote(state: AgentState, config: RunnableConfig) -> dict[str, Any]:
    deps = deps_from(config)
    draft = state["draft"]
    assert draft.outlet is not None
    body = {
        "outletId": draft.outlet["id"],
        "lines": [{"sku": ln.product["sku"], "qtyCases": ln.qty_cases} for ln in draft.lines if ln.product],
    }
    try:
        result = await deps.core_api.quote(body)
    except CoreApiError as exc:
        deps.session.draft = None
        failure = step("quote", f"core-api error {exc.status}: {exc.detail}")
        return {"question": replies.core_api_problem(exc), "steps": [failure]}

    detail = (
        f"Total AED {result.get('total')} (discount {result.get('discount')}), "
        f"credit {result.get('creditStatus')}"
    )
    return {"quote": result, "steps": [step("quote", detail)]}


# ---- propose (human-in-the-loop) ------------------------------------------------------------


async def propose(state: AgentState, config: RunnableConfig) -> dict[str, Any]:
    deps = deps_from(config)
    draft, quoted = state["draft"], state.get("quote") or {}
    deps.session.draft = None
    reply = replies.quote_table(quoted, draft)

    blocked = [line for line in quoted.get("lines", []) if line.get("fulfillable") is False]
    if blocked:
        return {
            "reply": reply + replies.stock_shortfall(blocked),
            "pending_action": None,
            "steps": [step("propose", "Stock shortfall; no confirmation offered")],
        }

    assert draft.outlet is not None
    payload = PlaceOrderPayload(
        outletId=int(draft.outlet["id"]),
        lines=[
            OrderLineInput(sku=ln.product["sku"], qtyCases=ln.qty_cases) for ln in draft.lines if ln.product
        ],
        notes=draft.notes,
    )
    action = sign_place_order(
        payload, deps.user_sub, deps.session_id, deps.signing_secret, deps.pending_ttl_s
    )
    if quoted.get("creditStatus") == "NEEDS_APPROVAL":
        reply += replies.NEEDS_APPROVAL
    return {
        "reply": reply + replies.CONFIRM_PROMPT,
        "pending_action": action,
        "steps": [step("propose", "Confirmation card ready; waiting for the rep (nothing placed yet)")],
    }


# ---- ask_user -------------------------------------------------------------------------------


async def ask_user(state: AgentState) -> dict[str, Any]:
    return {
        "reply": state.get("question") or "Could you clarify the order?",
        "steps": [step("ask_user", "Asked the rep a clarifying question instead of guessing")],
    }
