"""Stats and health API."""

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.models.models import Verse, Surah, Hadith, HadithCollection
from app.models.schemas import StatsResponse

router = APIRouter(tags=["meta"])


@router.get("/stats", response_model=StatsResponse)
async def get_stats(db: AsyncSession = Depends(get_db)):
    total_verses = (await db.execute(select(func.count(Verse.id)))).scalar() or 0
    total_surahs = (await db.execute(select(func.count(Surah.id)))).scalar() or 0
    total_hadith = (await db.execute(select(func.count(Hadith.id)))).scalar() or 0
    total_collections = (await db.execute(select(func.count(HadithCollection.id)))).scalar() or 0

    return StatsResponse(
        total_verses=total_verses,
        total_surahs=total_surahs,
        total_hadith=total_hadith,
        total_collections=total_collections,
        model_name=settings.embedding_model,
        model_dim=settings.embedding_dim,
    )


@router.get("/health")
async def health():
    return {"status": "ok"}
