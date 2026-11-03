from fastapi.testclient import TestClient

from tests.conftest import FakeCoreApi, mint_token


def chat(client: TestClient, auth: dict[str, str], text: str, session_id: str = "s-1") -> dict:
    response = client.post(
        "/ai/chat",
        headers=auth,
        json={"session_id": session_id, "messages": [{"role": "user", "content": text}], "outlet_id": None},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_order_quote_then_confirm_places_order_with_idempotency_key(
    client: TestClient, auth: dict[str, str], core_api: FakeCoreApi
) -> None:
    body = chat(
        client,
        auth,
        "Please order 10 cases of FizzUp Cola 330ml and 5 cases of Oasis Orange 1L for Palm Bay Hotel",
    )

    assert body["intent"] == "ORDER"
    assert body["quote"]["total"] == 10 * 42.0 + 5 * 78.0
    assert body["order"] is None
    action = body["pending_action"]
    assert action["type"] == "PLACE_ORDER"
    assert action["payload"] == {
        "outletId": 3,
        "lines": [{"sku": "FZ-COLA-330-24", "qtyCases": 10}, {"sku": "OJ-ORNG-1000-12", "qtyCases": 5}],
        "notes": None,
        "source": "AI_AGENT",
    }
    nodes = [s["node"] for s in body["steps"]]
    assert nodes[:4] == ["classify_intent", "extract_order", "resolve_entities", "resolve_entities"]
    assert nodes[-2:] == ["quote", "propose"]
    assert not core_api.order_requests, "the agent must never place the order itself"

    confirm = client.post(
        "/ai/chat/confirm", headers=auth, json={"session_id": "s-1", "pending_action": action}
    )
    assert confirm.status_code == 200, confirm.text
    assert confirm.json()["order"]["orderNo"] == "SO-2026-00001"
    assert "SO-2026-00001" in confirm.json()["reply"]

    sent = core_api.order_requests[0]
    assert sent.headers["Idempotency-Key"].startswith("s-1-")
    assert sent.headers["Authorization"] == auth["Authorization"]
    assert sent.headers["X-Request-Id"] == "test-req-1"

    # A double tap re-sends the same key, so core-api returns the same order.
    again = client.post(
        "/ai/chat/confirm", headers=auth, json={"session_id": "s-1", "pending_action": action}
    )
    assert again.json()["order"]["orderNo"] == "SO-2026-00001"
    assert core_api.order_requests[1].headers["Idempotency-Key"] == sent.headers["Idempotency-Key"]


def test_confirm_rejects_tampered_or_foreign_actions(
    client: TestClient, auth: dict[str, str], core_api: FakeCoreApi
) -> None:
    action = chat(client, auth, "Order 10 cases FizzUp Cola 330ml for Palm Bay Hotel")["pending_action"]

    tampered = {
        **action,
        "payload": {**action["payload"], "lines": [{"sku": "FZ-COLA-330-24", "qtyCases": 999}]},
    }
    assert (
        client.post(
            "/ai/chat/confirm", headers=auth, json={"session_id": "s-1", "pending_action": tampered}
        ).status_code
        == 400
    )

    other_user = {"Authorization": f"Bearer {mint_token(sub='rep-2')}"}
    assert (
        client.post(
            "/ai/chat/confirm", headers=other_user, json={"session_id": "s-1", "pending_action": action}
        ).status_code
        == 400
    )
    assert not core_api.order_requests


def test_ambiguous_outlet_asks_a_clarifying_question_then_continues(
    client: TestClient, auth: dict[str, str], core_api: FakeCoreApi
) -> None:
    body = chat(client, auth, "Order 10 cases of FizzUp Cola 330ml for Al Noor Grocery", session_id="amb")

    assert body["intent"] == "ORDER"
    assert body["pending_action"] is None and body["quote"] is None
    assert "Al Noor Grocery - Deira" in body["reply"] and "Al Noor Grocery - Dubai Marina" in body["reply"]
    assert body["steps"][-1]["node"] == "ask_user"

    follow_up = chat(client, auth, "the Marina one", session_id="amb")
    assert follow_up["intent"] == "ORDER"
    assert follow_up["pending_action"]["payload"]["outletId"] == 2
    assert follow_up["pending_action"]["payload"]["lines"] == [{"sku": "FZ-COLA-330-24", "qtyCases": 10}]


def test_ambiguous_product_lists_candidates(
    client: TestClient, auth: dict[str, str], core_api: FakeCoreApi
) -> None:
    body = chat(client, auth, "Order 10 cases of FizzUp Cola for Palm Bay Hotel", session_id="prod")
    assert body["pending_action"] is None
    assert "FZ-COLA-330-24" in body["reply"] and "FZ-COLA-1500-6" in body["reply"]

    follow_up = chat(client, auth, "2", session_id="prod")
    assert follow_up["pending_action"]["payload"]["lines"] == [{"sku": "FZ-COLA-1500-6", "qtyCases": 10}]


def test_missing_details_prompts_the_rep(
    client: TestClient, auth: dict[str, str], core_api: FakeCoreApi
) -> None:
    body = chat(client, auth, "Order 10 cases of FizzUp Cola 330ml")
    assert body["pending_action"] is None
    assert "which outlet" in body["reply"]
