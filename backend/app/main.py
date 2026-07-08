"""Dalil — Semantic Search for Islamic Texts."""

import logging
import time
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import cast

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.types import ExceptionHandler

from app.api import hadith, meta, quran, search
from app.core.config import settings
from app.core.limiter import limiter
from app.models.schemas import ErrorResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.is_prod and "*" in settings.cors_origin_list:
        raise RuntimeError("CORS wildcard not allowed with allow_credentials=True in production")
    from app.services.embedding import get_model

    get_model()
    yield


app = FastAPI(
    title="Dalil API",
    description="Semantic search across Qur'an and Hadith",
    version="0.1.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
app.add_exception_handler(RateLimitExceeded, cast(ExceptionHandler, _rate_limit_exceeded_handler))


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    from fastapi.exceptions import HTTPException as FastAPIHTTPException

    if isinstance(exc, FastAPIHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponse(
                error=exc.detail,
                timestamp=datetime.now(UTC),
            ).model_dump(mode="json"),
        )
    request_id = uuid.uuid4().hex[:8]
    logger.exception("Unhandled error on %s ref=%s", request.url.path, request_id)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="Internal server error",
            detail=f"ref: {request_id}",
            timestamp=datetime.now(UTC),
        ).model_dump(mode="json"),
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["Content-Type", "Accept"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    t0 = time.monotonic()
    response = await call_next(request)
    duration = (time.monotonic() - t0) * 1000
    logger.info("%s %s %d %.0fms", request.method, request.url.path, response.status_code, duration)
    return response


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readyz")
async def readyz() -> JSONResponse:
    return await meta.readiness()


app.include_router(meta.router, prefix=settings.api_prefix)
app.include_router(search.router, prefix=settings.api_prefix)
app.include_router(quran.router, prefix=settings.api_prefix)
app.include_router(hadith.router, prefix=settings.api_prefix)
