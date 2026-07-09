"""Qur'an browse API."""

from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import Surah, Verse
from app.models.schemas import VerseResponse

router = APIRouter(prefix="/quran", tags=["quran"])


@router.get("/surahs")
async def list_surahs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Surah).order_by(Surah.id))
    surahs = result.scalars().all()
    return [
        {
            "id": s.id,
            "name_arabic": s.name_arabic,
            "name_english": s.name_english,
            "revelation_type": s.revelation_type,
            "verses_count": s.verses_count,
        }
        for s in surahs
    ]


@router.get("/{surah_number}")
async def get_surah(
    surah_number: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, le=286),
    db: AsyncSession = Depends(get_db),
):
    surah_result = await db.execute(select(Surah).where(Surah.id == surah_number))
    surah = cast(Any, surah_result.scalar_one_or_none())
    if not surah:
        raise HTTPException(status_code=404, detail="Surah not found")

    offset = (page - 1) * per_page
    verses_result = await db.execute(
        select(Verse)
        .where(Verse.surah_id == surah_number)
        .order_by(Verse.verse_number)
        .offset(offset)
        .limit(per_page)
    )
    verses = cast(list[Any], verses_result.scalars().all())

    total = surah.verses_count
    return {
        "surah": {
            "id": surah.id,
            "name_arabic": surah.name_arabic,
            "name_english": surah.name_english,
            "revelation_type": surah.revelation_type,
            "verses_count": surah.verses_count,
        },
        "verses": [
            {
                "id": v.id,
                "verse_number": v.verse_number,
                "text_arabic": v.text_arabic,
                "text_translation": v.text_translation,
                "juz": v.juz,
            }
            for v in verses
        ],
        "page": page,
        "per_page": per_page,
        "total_verses": total,
        "total_pages": max(1, -(-total // per_page)),
    }


@router.get("/{surah_number}/{verse_number}")
async def get_verse(
    surah_number: int,
    verse_number: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Verse)
        .join(Surah)
        .where(Verse.surah_id == surah_number, Verse.verse_number == verse_number)
    )
    verse = cast(Any, result.scalar_one_or_none())
    if not verse:
        raise HTTPException(status_code=404, detail="Verse not found")

    surah_result = await db.execute(select(Surah).where(Surah.id == surah_number))
    surah = cast(Any, surah_result.scalar_one())

    return VerseResponse(
        id=verse.id,
        surah_name_arabic=surah.name_arabic,
        surah_name_english=surah.name_english,
        surah_number=surah.id,
        verse_number=verse.verse_number,
        text_arabic=verse.text_arabic,
        text_translation=verse.text_translation,
        juz=verse.juz,
        revelation_type=surah.revelation_type,
        tafsir=verse.text_tafsir,
    )
