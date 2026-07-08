"""Stats and health API."""

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import engine, get_db
from app.models.models import Embedding, Hadith, HadithCollection, Surah, Verse
from app.models.schemas import StatsResponse

router = APIRouter(tags=["meta"])


@router.get("/stats", response_model=StatsResponse)
async def get_stats(db: AsyncSession = Depends(get_db)):
    total_verses = (await db.execute(select(func.count(Verse.id)))).scalar() or 0
    total_surahs = (await db.execute(select(func.count(Surah.id)))).scalar() or 0
    total_hadith = (await db.execute(select(func.count(Hadith.id)))).scalar() or 0
    total_collections = (await db.execute(select(func.count(HadithCollection.id)))).scalar() or 0
    total_embeddings = (await db.execute(select(func.count(Embedding.id)))).scalar() or 0
    quran_embeddings = (
        await db.execute(select(func.count(Embedding.id)).where(Embedding.source_type == "quran"))
    ).scalar() or 0
    hadith_embeddings = (
        await db.execute(select(func.count(Embedding.id)).where(Embedding.source_type == "hadith"))
    ).scalar() or 0

    return StatsResponse(
        total_verses=total_verses,
        total_surahs=total_surahs,
        total_hadith=total_hadith,
        total_collections=total_collections,
        total_embeddings=total_embeddings,
        quran_embeddings=quran_embeddings,
        hadith_embeddings=hadith_embeddings,
        model_name=settings.embedding_model,
        model_dim=settings.embedding_dim,
    )


@router.get("/health")
async def health():
    return {"status": "ok"}


async def readiness() -> JSONResponse:
    db_ok = False
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    redis_ok = False
    client = aioredis.from_url(settings.redis_url)
    try:
        redis_ok = await client.ping()
    except Exception:
        pass
    finally:
        await client.aclose()

    ok = db_ok and redis_ok
    return JSONResponse(
        status_code=200 if ok else 503,
        content={"status": "ready" if ok else "degraded", "db": db_ok, "redis": redis_ok},
    )
