import logging
import sys
import time
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Standard formatting
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d - %(message)s"

def setup_logging() -> logging.Logger:
    logger = logging.getLogger("attendance_system")
    logger.setLevel(logging.INFO)
    
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(LOG_FORMAT))
        logger.addHandler(handler)
        
    # Silence overly verbose third-party loggers if needed
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    return logger

logger = setup_logging()

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        client_host = request.client.host if request.client else "unknown"
        method = request.method
        url = request.url.path
        
        logger.info(f"Incoming Request: {method} {url} | Client: {client_host}")
        
        try:
            response = await call_next(request)
            duration_ms = round((time.time() - start_time) * 1000, 2)
            logger.info(
                f"Response: {method} {url} | Status: {response.status_code} | Duration: {duration_ms}ms"
            )
            response.headers["X-Process-Time"] = f"{duration_ms}ms"
            return response
        except Exception as exc:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            logger.error(
                f"Unhandled Exception on {method} {url} | Error: {str(exc)} | Duration: {duration_ms}ms",
                exc_info=True,
            )
            raise exc
