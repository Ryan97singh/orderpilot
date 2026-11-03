from fastapi.testclient import TestClient


def test_knowledge_question_returns_cited_answer(client: TestClient, auth: dict[str, str]) -> None:
    response = client.post(
        "/ai/chat",
        headers=auth,
        json={
            "session_id": "k-1",
            "messages": [{"role": "user", "content": "What is the order cut-off time for Abu Dhabi?"}],
        },
    )
    body = response.json()

    assert response.status_code == 200
    assert body["intent"] == "KNOWLEDGE"
    assert body["citations"], "knowledge answers must cite sources"
    assert body["citations"][0]["doc"] == "delivery-schedule"
    assert {"doc", "title", "snippet"} <= set(body["citations"][0])
    assert "[1]" in body["reply"]
    assert [s["node"] for s in body["steps"]] == ["classify_intent", "retrieve", "answer_with_citations"]


def test_knowledge_search_endpoint(client: TestClient, auth: dict[str, str]) -> None:
    response = client.post(
        "/ai/knowledge/search", headers=auth, json={"query": "order over credit limit approval", "top_k": 3}
    )
    body = response.json()

    assert response.status_code == 200
    assert body["provider"] == "local"
    assert 0 < len(body["hits"]) <= 3
    assert body["hits"][0]["doc"] == "credit-policy"
    assert {"doc", "title", "snippet", "score"} == set(body["hits"][0])


def test_general_message(client: TestClient, auth: dict[str, str]) -> None:
    response = client.post(
        "/ai/chat",
        headers=auth,
        json={"session_id": "g", "messages": [{"role": "user", "content": "hello!"}]},
    )
    assert response.json()["intent"] == "GENERAL"
    assert "OrderPilot" in response.json()["reply"]


def test_prompt_studio_builds_structured_prompt(client: TestClient, auth: dict[str, str]) -> None:
    requirement = (
        "Managers want reps to log outlet visits. A visit must have a GPS location and at least one photo. "
        "Reps can only edit a visit within 24 hours."
    )
    response = client.post(
        "/ai/prompt-studio", headers=auth, json={"requirement": requirement, "layer": "backend"}
    )
    body = response.json()

    assert response.status_code == 200
    assert response.headers["X-LLM-Provider"] == "mock"
    assert {"Sales Rep", "Sales Manager"} <= set(body["analysis"]["actors"])
    assert "Visit" in body["analysis"]["entities"]
    assert any("24 hours" in rule for rule in body["analysis"]["rules"])
    assert body["analysis"]["open_questions"]
    for section in ("## Role", "## Business rules", "## Technical constraints", "## Acceptance criteria"):
        assert section in body["prompt"]
    assert "Spring Boot" in body["prompt"]
    assert body["acceptance_criteria"]
