"""Per-process daily LLM spend guard, estimated from token usage."""

from dataclasses import dataclass, field
from datetime import UTC, date, datetime

# USD per 1M tokens (input, output).
PRICES_PER_MTOK: dict[str, tuple[float, float]] = {
    "claude-sonnet-5-5": (2.00, 10.00),
    "claude-opus-5-5": (4.00, 20.00),
    "claude-haiku-5-5": (0.10, 0.50),
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "mock": (0.0, 0.0),
}
UNKNOWN_MODEL_PRICE = (5.00, 25.00)  # deliberately pessimistic


def estimate_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    price_in, price_out = PRICES_PER_MTOK.get(model, UNKNOWN_MODEL_PRICE)
    return (input_tokens * price_in + output_tokens * price_out) / 1_000_000


def _today() -> date:
    return datetime.now(UTC).date()


@dataclass
class DailyBudget:
    limit_usd: float
    spent_usd: float = 0.0
    day: date = field(default_factory=_today)

    def _roll(self) -> None:
        if (today := _today()) != self.day:
            self.day, self.spent_usd = today, 0.0

    @property
    def exceeded(self) -> bool:
        self._roll()
        return self.spent_usd >= self.limit_usd

    def record(self, model: str, input_tokens: int, output_tokens: int) -> float:
        self._roll()
        cost = estimate_cost_usd(model, input_tokens, output_tokens)
        self.spent_usd += cost
        return cost
