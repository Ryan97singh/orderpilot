import os
import time
from collections.abc import Iterator
from typing import Any

os.environ.update(
    {
        "LLM_PROVIDER": "mock",
        "SEARCH_PROVIDER": "local",
        "AUTH_MODE": "demo",
        "JWT_SECRET": "test-secret-for-pytest-only-0123456789abcdef",
        "CORE_API_URL": "http://core-api.test",
        "LLM_DAILY_BUDGET_USD": "1",
    }
)

import httpx  # noqa: E402
import jwt  # noqa: E402
import pytest  # noqa: E402
import respx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.agent.graph import get_graph  # noqa: E402
from app.agent.session import get_session_store  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.llm.service import get_llm_service  # noqa: E402
from app.main import app  # noqa: E402
from app.search.base import get_search_service  # noqa: E402

CORE = "http://core-api.test"

OUTLETS: list[dict[str, Any]] = [
    {
        "id": 1,
        "code": "OUT-1001",
        "name": "Al Noor Grocery - Deira",
        "channel": "GROCERY",
        "city": "Dubai",
        "creditLimit": 30000,
        "outstandingBalance": 12000,
    },
    {
        "id": 2,
        "code": "OUT-1002",
        "name": "Al Noor Grocery - Dubai Marina",
        "channel": "GROCERY",
        "city": "Dubai",
        "creditLimit": 30000,
        "outstandingBalance": 5000,
    },
    {
        "id": 3,
        "code": "OUT-1003",
        "name": "Palm Bay Hotel",
        "channel": "HORECA",
        "city": "Dubai",
        "creditLimit": 60000,
        "outstandingBalance": 20000,
    },
]
PRODUCTS: list[dict[str, Any]] = [
    {
        "sku": "FZ-COLA-330-24",
        "name": "FizzUp Cola 330ml Can",
        "brand": "FizzUp",
        "category": "CARBONATED",
        "packSize": "24 x 330ml can",
        "casePrice": 42.0,
    },
    {
        "sku": "FZ-COLA-1500-6",
        "name": "FizzUp Cola 1.5L",
        "brand": "FizzUp",
        "category": "CARBONATED",
        "packSize": "6 x 1.5L PET",
        "casePrice": 33.0,
    },
    {
        "sku": "OJ-ORNG-1000-12",
        "name": "Oasis Juice Orange 1L",
        "brand": "Oasis Juice",
        "category": "JUICE",
        "packSize": "12 x 1L carton",
        "casePrice": 78.0,
    },
]


def mint_token(
    sub: str = "rep-1", roles: list[str] | None = None, secret: str | None = None, exp_offset: int = 3600
) -> str:
    claims = {
        "sub": sub,
        "name": "Rania Rep",
        "roles": roles or ["REP"],
        "iss": "orderpilot-demo",
        "exp": int(time.time()) + exp_offset,
    }
    return jwt.encode(claims, secret or os.environ["JWT_SECRET"], algorithm="HS256")


class FakeCoreApi:
    """Just enough of core-api to exercise the agent: search, quote, idempotent order create."""

    def __init__(self) -> None:
        self.orders: dict[str, dict[str, Any]] = {}
        self.order_requests: list[httpx.Request] = []

    @staticmethod
    def _search(items: list[dict[str, Any]], q: str, fields: tuple[str, ...]) -> list[dict[str, Any]]:
        q = q.lower()
        return [i for i in items if any(q in str(i[f]).lower() for f in fields)]

    def outlets(self, request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json=self._search(OUTLETS, request.url.params.get("q", ""), ("name", "code", "city"))
        )

    def products(self, request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json=self._search(PRODUCTS, request.url.params.get("q", ""), ("name", "brand", "sku"))
        )

    def quote(self, request: httpx.Request) -> httpx.Response:
        body = httpx.Response(200, content=request.content).json()
        outlet = next(o for o in OUTLETS if o["id"] == body["outletId"])
        lines = []
        for line in body["lines"]:
            product = next((p for p in PRODUCTS if p["sku"] == line["sku"]), None)
            if product is None:
                return httpx.Response(
                    422, json={"title": "Unknown SKU", "status": 422, "detail": f"Unknown SKU {line['sku']}"}
                )
            lines.append(
                {
                    "sku": product["sku"],
                    "productName": product["name"],
                    "qtyCases": line["qtyCases"],
                    "unitPrice": product["casePrice"],
                    "discountPct": 0,
                    "promotion": None,
                    "lineTotal": product["casePrice"] * line["qtyCases"],
                    "available": 500,
                    "fulfillable": True,
                }
            )
        total = sum(line["lineTotal"] for line in lines)
        credit = "OK" if outlet["outstandingBalance"] + total <= outlet["creditLimit"] else "NEEDS_APPROVAL"
        return httpx.Response(
            200,
            json={
                "outlet": outlet,
                "lines": lines,
                "subtotal": total,
                "discount": 0,
                "total": total,
                "creditStatus": credit,
                "warnings": [],
            },
        )

    def create_order(self, request: httpx.Request) -> httpx.Response:
        self.order_requests.append(request)
        key = request.headers.get("Idempotency-Key", "")
        if key not in self.orders:
            self.orders[key] = {
                "id": len(self.orders) + 1,
                "orderNo": f"SO-2026-{len(self.orders) + 1:05d}",
                "status": "CONFIRMED",
                "total": 670.0,
                "source": "AI_AGENT",
            }
        return httpx.Response(201, json=self.orders[key])


@pytest.fixture(autouse=True)
def _reset_singletons() -> Iterator[None]:
    for cached in (get_settings, get_llm_service, get_search_service, get_session_store, get_graph):
        cached.cache_clear()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {mint_token()}", "X-Request-Id": "test-req-1"}


@pytest.fixture
def core_api() -> Iterator[FakeCoreApi]:
    fake = FakeCoreApi()
    with respx.mock(base_url=CORE, assert_all_called=False) as router:
        router.get("/api/outlets").mock(side_effect=fake.outlets)
        router.get("/api/products").mock(side_effect=fake.products)
        router.post("/api/orders/quote").mock(side_effect=fake.quote)
        router.post("/api/orders").mock(side_effect=fake.create_order)
        yield fake
