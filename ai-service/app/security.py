"""Bearer-token validation: HS256 demo tokens or Microsoft Entra ID access tokens."""

from functools import lru_cache
from typing import Annotated, Any

import jwt
from anyio import to_thread
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.config import Settings, get_settings

KNOWN_ROLES = ("REP", "MANAGER")

_bearer = HTTPBearer(auto_error=False)


class User(BaseModel):
    sub: str
    name: str
    roles: list[str]
    token: str


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _normalize_roles(raw: Any) -> list[str]:
    """Map token roles (e.g. `REP`, `OrderPilot.Manager`) onto the app's REP/MANAGER."""
    values = raw if isinstance(raw, list) else [raw] if raw else []
    roles = {r for v in values for r in KNOWN_ROLES if r in str(v).upper()}
    return sorted(roles)


def _decode_demo(token: str, settings: Settings) -> dict[str, Any]:
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=["HS256"],
        issuer=settings.jwt_issuer,
        options={"require": ["exp", "sub"]},
    )


@lru_cache
def _jwks_client(tenant_id: str) -> jwt.PyJWKClient:
    url = f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600)


async def _decode_entra(token: str, settings: Settings) -> dict[str, Any]:
    if not settings.entra_tenant_id or not settings.entra_audience:
        raise _unauthorized("Entra auth is not configured")
    jwks = _jwks_client(settings.entra_tenant_id)
    signing_key = await to_thread.run_sync(jwks.get_signing_key_from_jwt, token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=settings.entra_audience,
        issuer=f"https://login.microsoftonline.com/{settings.entra_tenant_id}/v2.0",
        options={"require": ["exp", "iss", "aud"]},
    )


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized("Missing bearer token")
    token = credentials.credentials
    try:
        if settings.auth_mode == "entra":
            claims = await _decode_entra(token, settings)
        else:
            claims = _decode_demo(token, settings)
    except (jwt.PyJWTError, jwt.PyJWKClientError) as exc:
        raise _unauthorized(f"Invalid token: {exc}") from exc

    return User(
        sub=str(claims.get("oid") or claims["sub"]),
        name=str(claims.get("name") or claims.get("preferred_username") or claims["sub"]),
        roles=_normalize_roles(claims.get("roles")),
        token=token,
    )


CurrentUser = Annotated[User, Depends(get_current_user)]
