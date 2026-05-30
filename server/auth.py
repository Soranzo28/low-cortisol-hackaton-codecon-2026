from __future__ import annotations

import os
import time

import httpx
from fastapi import HTTPException

_jwks_cache: tuple[dict, float] | None = None
_JWKS_TTL = 3600.0


async def _get_jwks() -> dict:
    global _jwks_cache
    now = time.monotonic()
    if _jwks_cache and now - _jwks_cache[1] < _JWKS_TTL:
        return _jwks_cache[0]
    secret = os.environ.get("CLERK_SECRET_KEY", "")
    if not secret:
        return {}
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://api.clerk.com/v1/jwks",
            headers={"Authorization": f"Bearer {secret}"},
        )
        r.raise_for_status()
        jwks = r.json()
    _jwks_cache = (jwks, now)
    return jwks


async def verify_clerk_token(token: str) -> str:
    from jose import jwt as jose_jwt, JWTError

    if not os.environ.get("CLERK_SECRET_KEY"):
        raise ValueError("Clerk not configured")
    jwks = await _get_jwks()
    header = jose_jwt.get_unverified_header(token)
    key = next(
        (k for k in jwks.get("keys", []) if k.get("kid") == header.get("kid")),
        None,
    )
    if not key:
        global _jwks_cache
        _jwks_cache = None
        raise ValueError("JWKS key not found")
    try:
        claims = jose_jwt.decode(
            token, key, algorithms=["RS256"], options={"verify_aud": False}
        )
        return claims["sub"]
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")


def require_auth(authorization: str | None) -> str:
    """Extract Bearer token or raise 401."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    return authorization[len("Bearer "):]
