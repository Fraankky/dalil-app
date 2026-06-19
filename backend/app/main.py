"""Dalil — Semantic Search for Islamic Texts."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import search, quran, hadith, meta


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
