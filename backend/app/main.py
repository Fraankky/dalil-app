"""Dalil — Semantic Search for Islamic Texts."""

import logging
import time
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import cast

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.types import ExceptionHandler

from app.api import hadith, meta, quran, search
from app.core.config import settings
from app.core.limiter import limiter
from app.models.schemas import ErrorResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-load embedding model on startup
    from app.services.embedding import get_model

    get_model()
    yield


app = FastAPI(
    title="Dalil API",
    description="Semantic search across Qur'an and Hadith",
    version="0.1.0",
    docs_url="/docs",
    lifespan=lifespan,
)

app.state.limiter = limiter
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
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="Internal server error",
            detail=str(exc) if settings.debug else None,
            timestamp=datetime.now(UTC),
        ).model_dump(mode="json"),
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    t0 = time.monotonic()
    response = await call_next(request)
    duration = (time.monotonic() - t0) * 1000
    logger.info("%s %s %d %.0fms", request.method, request.url.path, response.status_code, duration)
    return response


app.include_router(meta.router, prefix=settings.api_prefix)
app.include_router(search.router, prefix=settings.api_prefix)
app.include_router(quran.router, prefix=settings.api_prefix)
app.include_router(hadith.router, prefix=settings.api_prefix)
