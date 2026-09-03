"""Security middleware and API-key dependency.

API-key behaviour
-----------------
When the environment variable ``API_KEY`` is set, all protected routes require
the ``X-API-Key`` request header to match that value exactly.  A missing or
incorrect key returns HTTP 401.

When ``API_KEY`` is **not** set (or is empty), the server runs in documented
open-access mode — no key is required and ``verify_api_key`` returns
``"open_access"``.  This is intentional for local development and demo
deployments.  Do not claim this provides authentication when no key is
configured.
"""
import os

from fastapi import Header, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["240/minute"])

# Read once at import time; restart the server to pick up a new value.
_API_KEY: str | None = os.getenv("API_KEY") or None


async def verify_api_key(x_api_key: str = Header(default=None)) -> str:
    """FastAPI dependency that enforces the optional API-key gate.

    - If API_KEY env var is unset → open access, returns "open_access".
    - If API_KEY is set → require X-API-Key header matching the env value.
      Returns "authenticated" on match; raises HTTP 401 on mismatch/absence.
    """
    if _API_KEY is None:
        return "open_access"
    if x_api_key != _API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key. Set the X-API-Key header.",
        )
    return "authenticated"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response
