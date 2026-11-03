"""Async client for the Java core-api. Calls are made on behalf of the user (token forwarded)."""

from types import TracebackType
from typing import Any, Self

import httpx

from app.observability import REQUEST_ID_HEADER, request_id_var

JsonDict = dict[str, Any]


class CoreApiError(Exception):
    def __init__(self, status: int, title: str, detail: str) -> None:
        super().__init__(f"{status} {title}: {detail}")
        self.status = status
        self.title = title
        self.detail = detail


class CoreApiClient:
    def __init__(self, base_url: str, token: str, timeout_s: float = 15.0) -> None:
        self._http = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=timeout_s,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
                REQUEST_ID_HEADER: request_id_var.get(),
            },
        )

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self._http.aclose()

    async def search_outlets(self, q: str) -> list[JsonDict]:
        return _as_list(await self._request("GET", "/api/outlets", params={"q": q}))

    async def get_outlet(self, outlet_id: int) -> JsonDict:
        return await self._request("GET", f"/api/outlets/{outlet_id}")

    async def search_products(self, q: str) -> list[JsonDict]:
        return _as_list(await self._request("GET", "/api/products", params={"q": q}))

    async def quote(self, body: JsonDict) -> JsonDict:
        return await self._request("POST", "/api/orders/quote", json=body)

    async def create_order(self, body: JsonDict, idempotency_key: str) -> JsonDict:
        return await self._request(
            "POST", "/api/orders", json=body, headers={"Idempotency-Key": idempotency_key}
        )

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        try:
            response = await self._http.request(method, path, **kwargs)
        except httpx.HTTPError as exc:
            raise CoreApiError(503, "core-api unreachable", str(exc)) from exc
        if response.is_success:
            return response.json() if response.content else {}
        raise _problem(response)


def _as_list(data: Any) -> list[JsonDict]:
    """Accept a bare array or a Spring-style page (`content`) / `items` wrapper."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("content", "items", "data"):
            if isinstance(data.get(key), list):
                return data[key]
    return []


def _problem(response: httpx.Response) -> CoreApiError:
    try:
        body = response.json()
    except ValueError:
        body = {}
    if not isinstance(body, dict):
        body = {}
    return CoreApiError(
        status=response.status_code,
        title=str(body.get("title") or response.reason_phrase),
        detail=str(body.get("detail") or body.get("message") or response.text[:300]),
    )
