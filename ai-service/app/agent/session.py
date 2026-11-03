"""In-memory conversation state. Production would use Redis or Cosmos DB (TTL per session)."""

import time
from collections import OrderedDict, deque
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any, Literal

from app.config import get_settings
from app.llm.base import ChatMessage

JsonDict = dict[str, Any]


@dataclass
class DraftLine:
    product_ref: str
    qty_cases: int
    product: JsonDict | None = None


@dataclass
class OrderDraft:
    outlet_ref: str | None
    lines: list[DraftLine]
    notes: str | None = None
    outlet: JsonDict | None = None


@dataclass
class Clarification:
    kind: Literal["outlet", "product", "details"]
    candidates: list[JsonDict] = field(default_factory=list)
    line_index: int | None = None


@dataclass
class Session:
    key: str
    messages: deque[ChatMessage]
    draft: OrderDraft | None = None
    clarification: Clarification | None = None
    updated_at: float = field(default_factory=time.time)


class SessionStore:
    def __init__(self, max_messages: int, max_sessions: int) -> None:
        self._max_messages = max_messages
        self._max_sessions = max_sessions
        self._sessions: OrderedDict[str, Session] = OrderedDict()

    def get(self, user_sub: str, session_id: str) -> Session:
        # Keyed by user too, so one rep can never read or continue another rep's session.
        key = f"{user_sub}:{session_id}"
        session = self._sessions.get(key)
        if session is None:
            session = Session(key=key, messages=deque(maxlen=self._max_messages))
            self._sessions[key] = session
            while len(self._sessions) > self._max_sessions:
                self._sessions.popitem(last=False)
        self._sessions.move_to_end(key)
        session.updated_at = time.time()
        return session


@lru_cache
def get_session_store() -> SessionStore:
    settings = get_settings()
    return SessionStore(settings.session_max_messages, settings.session_max_count)
