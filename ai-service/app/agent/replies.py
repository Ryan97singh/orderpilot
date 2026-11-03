"""User-facing markdown produced by the ORDER branch."""

from typing import Any

from app.agent.resolution import outlet_label, product_label
from app.agent.session import DraftLine, OrderDraft
from app.clients.core_api import CoreApiError

JsonDict = dict[str, Any]


def numbered(items: list[str]) -> str:
    return "\n".join(f"{i}. {item}" for i, item in enumerate(items, 1))


def missing_details(missing: list[str]) -> str:
    return f"Happy to build that order. Could you tell me {' and '.join(missing)}?"


def ask_outlet(ref: str, candidates: list[JsonDict]) -> str:
    if not candidates:
        return (
            f"I couldn't find an outlet matching **{ref}**. "
            "Could you give the outlet code (e.g. OUT-1001) or its full name?"
        )
    options = numbered([outlet_label(c) for c in candidates])
    return (
        f"I found more than one outlet for **{ref}**. Which one did you mean?\n\n"
        f"{options}\n\nReply with the number or the code."
    )


def ask_product(line: DraftLine, candidates: list[JsonDict]) -> str:
    if not candidates:
        return (
            f"I couldn't find a product matching **{line.product_ref}**. "
            "Could you give the SKU, or the brand, flavour and pack size?"
        )
    options = numbered([product_label(c) for c in candidates])
    return (
        f"Which product did you mean by **{line.product_ref}** ({line.qty_cases} cases)?\n\n"
        f"{options}\n\nReply with the number or the SKU."
    )


def core_api_problem(exc: CoreApiError) -> str:
    if exc.status in (401, 403):
        return "The order system rejected this request for your account. Please sign in again."
    if exc.status == 503:
        return "I can't reach the order system right now (it may be waking up). Try again shortly."
    return f"The order system returned an error: {exc.detail}"


def stock_shortfall(blocked: list[JsonDict]) -> str:
    rows = "\n".join(
        f"- {line.get('productName')}: {line.get('qtyCases')} requested, {line.get('available')} available"
        for line in blocked
    )
    return (
        f"\n\n**Not enough stock** in the outlet's warehouse:\n{rows}\n\n"
        "Tell me the new quantities and I'll re-quote."
    )


NEEDS_APPROVAL = (
    "\n\nThis order exceeds the outlet's available credit, so it will be created as "
    "**PENDING_APPROVAL** for a manager to approve."
)
CONFIRM_PROMPT = "\n\nTap **Confirm** to place this order, or tell me what to change."


def money(value: Any) -> str:
    try:
        return f"{float(value):,.2f}"
    except (TypeError, ValueError):
        return str(value)


def _promo(line: JsonDict) -> str:
    promo, pct = line.get("promotion"), line.get("discountPct") or 0
    if not promo and not pct:
        return "-"
    label = promo.get("description") if isinstance(promo, dict) else promo
    return f"{pct}% {label or ''}".strip()


def quote_table(quoted: JsonDict, draft: OrderDraft) -> str:
    outlet = quoted.get("outlet") or draft.outlet or {}
    rows = "\n".join(
        f"| {line.get('productName', line.get('sku'))} | {line.get('qtyCases')} "
        f"| {money(line.get('unitPrice'))} | {_promo(line)} | {money(line.get('lineTotal'))} |"
        for line in quoted.get("lines", [])
    )
    warnings = "".join(f"\n> ⚠️ {w}" for w in quoted.get("warnings", []))
    where = f"{outlet.get('code', '')}, {outlet.get('city', '')}"
    return (
        f"**Quote for {outlet.get('name', 'outlet')}** ({where})\n\n"
        "| Product | Cases | Unit AED | Promo | Line AED |\n|---|---:|---:|---|---:|\n"
        f"{rows}\n\n"
        f"Subtotal **AED {money(quoted.get('subtotal'))}** · "
        f"Discount AED {money(quoted.get('discount'))} · "
        f"Total **AED {money(quoted.get('total'))}**{warnings}"
    )
