"""Deterministic offline 'model'. It reads the same prompts the real models get and answers
with keyword rules and regex extraction, so the demo and the tests run without any API key."""

import re

from pydantic import BaseModel

from app.llm.base import ChatMessage, Completion, LLMTask
from app.schemas import (
    ExtractedLine,
    IntentResult,
    OrderExtraction,
    PromptStudioResult,
    StudioAnalysis,
)

_QTY_UNIT = r"(?:x\s*)?(?:cases?|cs|ctns?|cartons?)\b"
_HAS_QTY = re.compile(rf"\b\d+\s*{_QTY_UNIT}", re.I)
_ORDER_VERB = re.compile(
    r"^\s*(?:please\s+)?(?:order|quote|book|place|send|add|i need|we need|need|get me)\b", re.I
)
_KNOWLEDGE_WORDS = re.compile(
    r"\b(polic(?:y|ies)|credit|limit|approv\w*|promo\w*|discount|return\w*|damage\w*|expir\w*"
    r"|deliver\w*|cut-?off|schedule|onboard\w*|new outlet|licen[cs]e|pack sizes?|shelf life"
    r"|minimum|warehouse|range|brands?)\b",
    re.I,
)
_QUESTION = re.compile(r"\?\s*$|^\s*(what|when|how|can|do|does|is|are|which|why|who)\b", re.I)
_OUTLET_CODE = re.compile(r"\bOUT-\d+\b", re.I)
_OUTLET_PHRASE = re.compile(
    r"\b(?:for|to|at)\s+(?:outlet\s+)?(?P<outlet>[A-Za-z][^,.;:\n]*?)"
    r"(?=\s+(?:and|with|plus)\s+\d|\s*[,.;:\n]|\s*$)",
    re.I,
)
_LINE = re.compile(
    rf"(?P<qty>\d+)\s*(?:{_QTY_UNIT})?\s*(?:of\s+)?(?P<product>[A-Za-z][A-Za-z0-9 .'\-]*?)"
    rf"(?=\s*(?:,|;|\band\b|\bplus\b|\bfor\b|\bto\b|\bat\b|$|\d+\s*{_QTY_UNIT}))",
    re.I,
)
_NOTES = re.compile(r"\b(deliver(?:y)?\s+(?:before|after|by|on)\s+[^,.;\n]+)", re.I)


def tag_content(text: str, name: str) -> str | None:
    match = re.search(rf"<{name}[^>]*>\s*(.*?)\s*</{name}>", text, re.S)
    return match.group(1) if match else None


class MockProvider:
    name = "mock"
    model = "mock"

    async def generate(
        self,
        task: LLMTask,
        system: str,
        messages: list[ChatMessage],
        schema: type[BaseModel] | None = None,
    ) -> Completion:
        prompt = messages[-1]["content"] if messages else ""
        user_text = tag_content(prompt, "user_message") or prompt
        result: BaseModel | str = match_task(task, prompt, user_text)
        text = result.model_dump_json() if isinstance(result, BaseModel) else result
        return Completion(text=text, model=self.model)


def match_task(task: LLMTask, prompt: str, user_text: str) -> BaseModel | str:
    match task:
        case LLMTask.CLASSIFY_INTENT:
            return classify(user_text, awaiting="awaiting_clarification" in prompt)
        case LLMTask.EXTRACT_ORDER:
            return extract_order(user_text)
        case LLMTask.ANSWER_WITH_CITATIONS:
            return answer_from_documents(prompt)
        case LLMTask.GENERAL_ANSWER:
            return GENERAL_REPLY
        case LLMTask.PROMPT_STUDIO:
            return prompt_studio(
                tag_content(prompt, "requirement") or user_text,
                tag_content(prompt, "layer") or "fullstack",
            )
        case _:
            raise ValueError(f"Unknown task {task}")


def classify(text: str, awaiting: bool = False) -> IntentResult:
    has_qty = bool(_HAS_QTY.search(text))
    if has_qty or (_ORDER_VERB.search(text) and re.search(r"\d", text)):
        return IntentResult(intent="ORDER", confidence=0.9, reason="Quantities or order verb")
    is_knowledge = bool(_KNOWLEDGE_WORDS.search(text))
    if is_knowledge and (_QUESTION.search(text) or not awaiting):
        return IntentResult(intent="KNOWLEDGE", confidence=0.8, reason="Policy keywords")
    if awaiting:
        return IntentResult(intent="ORDER", confidence=0.7, reason="Answers a clarification")
    return IntentResult(intent="GENERAL", confidence=0.6, reason="No order or policy signal")


def extract_order(text: str) -> OrderExtraction:
    outlet_ref: str | None = None
    remainder = text
    if code := _OUTLET_CODE.search(text):
        outlet_ref = code.group(0).upper()
        remainder = text.replace(code.group(0), " ")
    else:
        candidates = [m for m in _OUTLET_PHRASE.finditer(text) if not m["outlet"][0].isdigit()]
        if candidates:
            last = candidates[-1]
            outlet_ref = last["outlet"].strip()
            remainder = text[: last.start()] + text[last.end() :]

    notes_match = _NOTES.search(remainder)
    if notes_match:
        remainder = remainder.replace(notes_match.group(0), " ")

    lines = []
    for match in _LINE.finditer(remainder):
        product = re.sub(r"\s+(please|thanks?)$", "", match["product"].strip(" .-"), flags=re.I)
        if product:
            lines.append(ExtractedLine(product_ref=product, qty_cases=int(match["qty"])))
    return OrderExtraction(
        outlet_ref=outlet_ref,
        lines=lines,
        notes=notes_match.group(1).strip() if notes_match else None,
        missing_info=[] if lines else ["products and quantities"],
    )


def answer_from_documents(prompt: str) -> str:
    docs = re.findall(r'<document index="(\d+)" title="([^"]*)"[^>]*>\s*(.*?)\s*</document>', prompt, re.S)
    if not docs:
        return (
            "I couldn't find that in the knowledge base. Please check with your sales manager "
            "or credit control."
        )
    bullets = [f"- **{title}**: {_first_sentences(body)} [{idx}]" for idx, title, body in docs[:3]]
    return "Here's what the knowledge base says:\n\n" + "\n".join(bullets)


def _first_sentences(body: str, limit: int = 260) -> str:
    flat = re.sub(r"\s+", " ", re.sub(r"[#*|>`]+|(?<!\w)-+|-+(?!\w)", " ", body)).strip()
    return flat if len(flat) <= limit else flat[:limit].rsplit(" ", 1)[0] + "…"


GENERAL_REPLY = (
    "Hi! I'm OrderPilot. I can **build and price orders** (try *\"Order 10 cases FizzUp Cola "
    '330ml for Palm Bay Hotel"*) and **answer policy questions** on credit, promotions, returns, '
    "delivery cut-offs and onboarding. Orders are only placed after you confirm."
)

# ---- Prompt Studio template ------------------------------------------------------------------

_ACTORS = {
    r"\breps?\b|sales ?reps?|salesm[ae]n": "Sales Rep",
    r"\bmanagers?\b|supervisor": "Sales Manager",
    r"\bcustomers?\b|outlet owners?|retailers?": "Outlet / Customer",
    r"warehouse|picker|dispatch": "Warehouse team",
    r"\bdrivers?\b|delivery team": "Delivery driver",
    r"finance|credit control|accounts": "Finance / Credit control",
    r"\badmin\w*": "Administrator",
}
_ENTITIES = (
    "order", "outlet", "product", "promotion", "inventory", "stock", "invoice", "payment",
    "credit limit", "return", "delivery", "route", "visit", "target", "price", "warehouse",
    "discount", "approval", "notification", "photo", "location",
)  # fmt: skip
_RULE_HINT = re.compile(
    r"\b(must|should|only|cannot|can't|never|always|if|when|unless|at least|at most|within"
    r"|before|after|above|below|over|under|more than|less than|need\w*|require\w*|max\w*|min\w*)\b",
    re.I,
)
STACK_BY_LAYER = {
    "backend": "core-api: Java 21, Spring Boot 3, JPA + Flyway migration, Spring Security roles, "
    "RFC 7807 errors, JUnit 5 + MockMvc tests.",
    "frontend": "web: Next.js App Router, TypeScript strict, Tailwind, mobile-first, accessible "
    "forms, loading/empty/error states, no new dependencies without a reason.",
    "ai": "ai-service: FastAPI + LangGraph node(s), pydantic v2 schemas, prompts in "
    "app/agent/prompts.py, mock LLM path for tests, pytest + respx.",
    "fullstack": "core-api (Spring Boot 3, Java 21) for data and rules, ai-service (FastAPI, "
    "LangGraph) only if AI is involved, web (Next.js + TypeScript) for UI; tests in every layer.",
}


def prompt_studio(requirement: str, layer: str) -> PromptStudioResult:
    text = " ".join(requirement.split())
    lowered = text.lower()
    actors = [name for pattern, name in _ACTORS.items() if re.search(pattern, lowered)]
    entities = [e.title() for e in _ENTITIES if re.search(rf"\b{e}s?\b", lowered)]
    sentences = [s.strip() for s in re.split(r"(?<=[.!?;])\s+|\n+", requirement) if s.strip()]
    rules = [s.rstrip(".") for s in sentences if _RULE_HINT.search(s)] or [text.rstrip(".")]

    questions = []
    if not re.search(r"\d", text):
        questions.append("What are the exact thresholds, limits or time windows?")
    if "approv" not in lowered:
        questions.append("Does any step need manager approval or an override path?")
    if not re.search(r"notif|email|alert|push", lowered):
        questions.append("Who must be notified, and through which channel?")
    questions += [
        "Which roles can view or change this data (REP vs MANAGER)?",
        "What should happen offline or when a downstream service is unavailable?",
    ]

    actors = actors or ["Sales Rep"]
    entities = entities or ["Order"]
    criteria = [f"Given the rule \"{r}\", when it is violated, then the API rejects the request "
                "with an RFC 7807 error and nothing is persisted" for r in rules[:4]]  # fmt: skip
    criteria += [
        "Given a valid request from an authorised role, when it is submitted, then the result is "
        "persisted and returned with a 2xx status",
        "Given a user without the required role, when they call the endpoint, then they get 403",
        "Given the feature is shipped, when the test suite runs, then every business rule has a test",
    ]
    stack = STACK_BY_LAYER.get(layer, STACK_BY_LAYER["fullstack"])
    prompt = _render_prompt(text, layer, stack, actors, entities, rules, questions, criteria)
    return PromptStudioResult(
        analysis=StudioAnalysis(actors=actors, entities=entities, rules=rules, open_questions=questions),
        prompt=prompt,
        acceptance_criteria=criteria,
    )


def _bullets(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items)


def _render_prompt(
    requirement: str,
    layer: str,
    stack: str,
    actors: list[str],
    entities: list[str],
    rules: list[str],
    questions: list[str],
    criteria: list[str],
) -> str:
    return f"""## Role
You are a senior engineer on the OrderPilot platform working in the `{layer}` layer.

## Context
OrderPilot is the sales and ordering platform of a UAE beverage distributor (currency AED).
Actors involved: {", ".join(actors)}.

## Goal
{requirement}

## Scope
**In:** the behaviour described in the goal, its validation, persistence and tests.
**Out:** unrelated refactors, new infrastructure, UI redesigns not required by the goal.

## Domain model
{_bullets(entities)}

## Business rules
{_bullets(rules)}

## Technical constraints
- {stack}
- Follow existing package structure and naming; keep modules small and typed.
- Authorisation via existing JWT roles (REP, MANAGER). Log with the request id.

## Deliverables
- Implementation, migration (if schema changes) and tests.
- A short note in the README describing the feature and any new configuration.

## Acceptance criteria
{_bullets(criteria)}

## Working agreement
- Before coding, list your plan and ask about these open questions:
{_bullets(questions)}
- Write a failing test for each business rule first, then implement.
- Keep changes small and reviewable; explain any assumption you had to make.
"""
