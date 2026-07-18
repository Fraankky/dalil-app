"""Search API endpoints."""

import time

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.limiter import limiter
from app.models.schemas import SearchResponse
from app.services.search import search as search_service

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchResponse)
@limiter.limit("60/minute")
async def search(
    request: Request,
    q: str = Query(..., min_length=1, max_length=200, pattern=r"\S", description="Search query"),
    sources: str | None = Query(None, description="Comma-separated sources: quran,bukhari,muslim"),
    limit: int = Query(settings.search_default_limit, le=settings.search_max_limit),
    offset: int = Query(0, ge=0, le=1000),
    min_score: float = Query(settings.search_min_score, ge=0, le=1.0),
    db: AsyncSession = Depends(get_db),
) -> SearchResponse:
    t0 = time.monotonic()

    source_list = None
    if sources:
        source_list = [s.strip().lower() for s in sources.split(",") if s.strip()]

    response = await search_service(
        db=db,
        query=q,
        sources=source_list,
        limit=limit,
        offset=offset,
        min_score=min_score,
    )
    response.took_ms = round((time.monotonic() - t0) * 1000)
    return response
