"""Match free-text outlet/product references to core-api records without guessing."""

import asyncio
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

JsonDict = dict[str, Any]
SearchFn = Callable[[str], Awaitable[list[JsonDict]]]

_NOISE = frozenset("the of a an and one branch outlet please pack x".split())
_ORDINAL = re.compile(r"^\s*(?:#|no\.?|number|option)?\s*(\d{1,2})\s*$", re.I)


def tokens(text: str) -> set[str]:
    text = re.sub(r"(\d+(?:\.\d+)?)\s*(ml|l|ltr|litre|liter)\b", r"\1\2", text.lower())
    out = set()
    for raw in re.findall(r"[a-z0-9]+(?:[.\-][a-z0-9]+)*", text):
        if raw in _NOISE:
            continue
        out.add(raw[:-1] if len(raw) > 3 and raw.endswith("s") and not raw[-2].isdigit() else raw)
    return out


def outlet_text(outlet: JsonDict) -> str:
    return " ".join(str(outlet.get(k, "")) for k in ("code", "name", "city", "channel"))


def product_text(product: JsonDict) -> str:
    return " ".join(str(product.get(k, "")) for k in ("sku", "name", "brand", "packSize", "category"))


def outlet_label(outlet: JsonDict) -> str:
    return f"{outlet.get('name')} ({outlet.get('code')}, {outlet.get('city')})"


def product_label(product: JsonDict) -> str:
    pack = f", {product['packSize']}" if product.get("packSize") else ""
    return f"{product.get('name')} ({product.get('sku')}{pack})"


@dataclass(frozen=True)
class Resolution:
    match: JsonDict | None
    candidates: list[JsonDict] = field(default_factory=list)


def choose(ref: str, candidates: list[JsonDict], text_of: Callable[[JsonDict], str], key: str) -> Resolution:
    """Pick a candidate only if the reference fully and uniquely identifies it."""
    if not candidates:
        return Resolution(None)
    ref_lower = ref.strip().lower()
    for c in candidates:
        if str(c.get(key, "")).lower() == ref_lower or str(c.get("name", "")).lower() == ref_lower:
            return Resolution(c, [c])

    ref_tokens = tokens(ref) or {ref_lower}
    scored = sorted(
        ((len(ref_tokens & tokens(text_of(c))) / len(ref_tokens), c) for c in candidates),
        key=lambda pair: pair[0],
        reverse=True,
    )
    full = [c for score, c in scored if score == 1.0]
    if len(full) == 1:
        return Resolution(full[0], full)
    shortlist = full or [c for score, c in scored if score > 0]
    return Resolution(None, shortlist[:5])


def pick_from_candidates(
    answer: str, candidates: list[JsonDict], text_of: Callable[[JsonDict], str], key: str
) -> JsonDict | None:
    """Interpret a reply to a clarifying question: '2', a code/SKU, or distinguishing words."""
    if not candidates:
        return None
    if (m := _ORDINAL.match(answer)) and 1 <= int(m.group(1)) <= len(candidates):
        return candidates[int(m.group(1)) - 1]
    for c in candidates:
        if str(c.get(key, "")).lower() and str(c.get(key, "")).lower() in answer.lower():
            return c
    answer_tokens = tokens(answer)
    if not answer_tokens:
        return None
    scores = sorted(
        ((len(answer_tokens & tokens(text_of(c))), c) for c in candidates),
        key=lambda pair: pair[0],
        reverse=True,
    )
    best, runner_up = scores[0][0], scores[1][0] if len(scores) > 1 else 0
    return scores[0][1] if best > 0 and best > runner_up else None


async def search_candidates(search: SearchFn, ref: str, key: str) -> list[JsonDict]:
    """Search the full reference; if nothing matches, widen to individual distinctive words."""
    results = await search(ref)
    if results:
        return results
    words = [t for t in tokens(ref) if len(t) >= 3 and not re.fullmatch(r"[\d.]+(ml|l)?", t)][:4]
    batches = await asyncio.gather(*(search(w) for w in words))
    merged: dict[str, JsonDict] = {}
    for batch in batches:
        for item in batch:
            merged.setdefault(str(item.get(key) or item.get("id")), item)
    return list(merged.values())
