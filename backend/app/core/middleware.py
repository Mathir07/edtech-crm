import time
import uuid
import logging
from collections import defaultdict
from typing import Dict, List, Tuple
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from app.core.config import settings

logger = logging.getLogger("crm.access")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [req_id=%(request_id)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Applies production HTTP security headers to all outgoing responses.
    """
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        
        # In production or if request is HTTPS, enforce HSTS
        if settings.ENVIRONMENT == "production" or request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            
        return response


class RequestCorrelationMiddleware(BaseHTTPMiddleware):
    """
    Propagates or generates X-Request-ID and logs structured request timing.
    """
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        
        start_time = time.time()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            logger.error(
                f"{request.method} {request.url.path} - 500 INTERNAL_ERROR ({duration_ms}ms)",
                extra={"request_id": request_id},
            )
            raise

        duration_ms = round((time.time() - start_time) * 1000, 2)
        response.headers["X-Request-ID"] = request_id

        # Skip logging health check polling spam in test/dev
        if not request.url.path.startswith("/api/health"):
            logger.info(
                f"{request.method} {request.url.path} - {response.status_code} ({duration_ms}ms)",
                extra={"request_id": request_id},
            )

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Lightweight, thread-safe in-memory sliding window rate limiter
    specifically guarding authentication, AI chat, and outbound communication endpoints.
    """
    def __init__(self, app):
        super().__init__(app)
        # key -> list of timestamp floats
        self._history: Dict[str, List[float]] = defaultdict(list)
        self._last_cleanup = time.time()

    def _cleanup_old_records(self, now: float):
        if now - self._last_cleanup > 300:  # Cleanup every 5 minutes
            cutoff = now - 60
            keys_to_delete = []
            for key, timestamps in self._history.items():
                self._history[key] = [t for t in timestamps if t > cutoff]
                if not self._history[key]:
                    keys_to_delete.append(key)
            for k in keys_to_delete:
                del self._history[k]
            self._last_cleanup = now

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)

        path = request.url.path
        now = time.time()
        self._cleanup_old_records(now)

        limit = None
        rate_key_prefix = None

        if path.endswith("/auth/login") and request.method == "POST":
            limit = settings.RATE_LIMIT_LOGIN_PER_MINUTE
            rate_key_prefix = "login"
        elif path.startswith("/api/v1/ai/chat") and request.method == "POST":
            limit = settings.RATE_LIMIT_AI_PER_MINUTE
            rate_key_prefix = "ai"
        elif (
            (path.endswith("/communications/send_email") or path.endswith("/communications/send_whatsapp"))
            and request.method == "POST"
        ):
            limit = settings.RATE_LIMIT_COMM_PER_MINUTE
            rate_key_prefix = "comm"

        if limit is not None:
            # Identifier by client IP
            client_ip = request.client.host if request.client else "unknown"
            key = f"{rate_key_prefix}:{client_ip}"
            cutoff = now - 60
            
            # Filter timestamps to last 60 seconds
            valid_timestamps = [t for t in self._history[key] if t > cutoff]
            
            if len(valid_timestamps) >= limit:
                req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": f"Rate limit exceeded. Maximum {limit} requests per minute.",
                        "request_id": req_id,
                    },
                    headers={
                        "Retry-After": "60",
                        "X-Request-ID": req_id,
                    },
                )
            
            valid_timestamps.append(now)
            self._history[key] = valid_timestamps

        return await call_next(request)
