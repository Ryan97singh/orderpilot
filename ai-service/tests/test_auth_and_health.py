import pytest
from fastapi.testclient import TestClient

from tests.conftest import mint_token

SEARCH = {"query": "returns", "top_k": 2}


def test_health_is_public(client: TestClient) -> None:
    response = client.get("/ai/health", headers={"X-Request-Id": "abc"})
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["llm_provider"] == "mock"
    assert response.json()["search_provider"] == "local"
    assert response.headers["X-Request-Id"] == "abc"


def test_missing_token_is_401(client: TestClient) -> None:
    assert client.post("/ai/knowledge/search", json=SEARCH).status_code == 401
    assert (
        client.post(
            "/ai/chat", json={"session_id": "x", "messages": [{"role": "user", "content": "hi"}]}
        ).status_code
        == 401
    )


@pytest.mark.parametrize(
    "token",
    [
        mint_token(secret="wrong-secret-wrong-secret-wrong-secret"),
        mint_token(exp_offset=-60),
        "not-a-jwt",
    ],
    ids=["bad-signature", "expired", "garbage"],
)
def test_invalid_token_is_401(client: TestClient, token: str) -> None:
    response = client.post("/ai/knowledge/search", json=SEARCH, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_valid_demo_token_is_200(client: TestClient) -> None:
    response = client.post(
        "/ai/knowledge/search",
        json=SEARCH,
        headers={"Authorization": f"Bearer {mint_token(roles=['MANAGER'])}"},
    )
    assert response.status_code == 200
    assert response.headers["X-Request-Id"]


def test_cors_preflight(client: TestClient) -> None:
    response = client.options(
        "/ai/chat",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
