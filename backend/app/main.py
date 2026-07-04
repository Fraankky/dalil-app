"""Dalil — Semantic Search for Islamic Texts."""

from contextlib import asynccontextmanager

from datetime import UTC, datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import hadith, meta, quran, search
from app.core.config import settings
from app.models.schemas import ErrorResponse


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


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
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

app.include_router(meta.router, prefix=settings.api_prefix)
app.include_router(search.router, prefix=settings.api_prefix)
app.include_router(quran.router, prefix=settings.api_prefix)
app.include_router(hadith.router, prefix=settings.api_prefix)
