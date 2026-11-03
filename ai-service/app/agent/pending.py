"""Human-in-the-loop write actions: signed, expiring, bound to the user and session.

The signature makes the confirm step stateless (works across serverless instances) while
preventing a client from editing the order between the proposal and the confirmation.
"""

import hashlib
import hmac
import json
import time

from app.schemas import PendingAction, PlaceOrderPayload

_CONTEXT = b"orderpilot.pending-action.v1"


class PendingActionError(ValueError):
    pass


def _canonical(payload: PlaceOrderPayload) -> str:
    return json.dumps(payload.model_dump(), sort_keys=True, separators=(",", ":"))


def _signature(
    payload: PlaceOrderPayload, expires_at: int, user_sub: str, session_id: str, secret: str
) -> str:
    key = hmac.new(secret.encode(), _CONTEXT, hashlib.sha256).digest()
    message = "|".join(["PLACE_ORDER", _canonical(payload), str(expires_at), user_sub, session_id])
    return hmac.new(key, message.encode(), hashlib.sha256).hexdigest()


def sign_place_order(
    payload: PlaceOrderPayload, user_sub: str, session_id: str, secret: str, ttl_s: int
) -> PendingAction:
    expires_at = int(time.time()) + ttl_s
    return PendingAction(
        payload=payload,
        expires_at=expires_at,
        signature=_signature(payload, expires_at, user_sub, session_id, secret),
    )


def verify(action: PendingAction, user_sub: str, session_id: str, secret: str) -> None:
    expected = _signature(action.payload, action.expires_at, user_sub, session_id, secret)
    if not hmac.compare_digest(expected, action.signature):
        raise PendingActionError("Pending action was modified or belongs to another user/session")
    if action.expires_at < time.time():
        raise PendingActionError("Pending action expired; ask the agent for a fresh quote")


def idempotency_key(session_id: str, action: PendingAction) -> str:
    """Same proposal -> same key (double taps are safe); a new proposal -> a new order."""
    digest = hashlib.sha256(f"{_canonical(action.payload)}|{action.expires_at}".encode()).hexdigest()
    return f"{session_id}-{digest[:24]}"
