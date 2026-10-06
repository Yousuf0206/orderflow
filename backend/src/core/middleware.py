import logging
import time
import uuid

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("orderflow")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("request_id=%s unhandled error on %s %s", request_id, request.method, request.url.path)
            return JSONResponse(
                status_code=500,
                content={"error": {"code": "internal_error", "message": "Internal server error"}},
            )
        duration_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "request_id=%s %s %s -> %s (%.1fms)",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        response.headers["X-Request-ID"] = request_id
        return response
