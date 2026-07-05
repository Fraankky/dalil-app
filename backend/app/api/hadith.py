"""Hadith browse API."""

from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import Hadith, HadithCollection
from app.models.schemas import HadithResponse

router = APIRouter(prefix="/hadith", tags=["hadith"])


@router.get("/collections")
async def list_collections(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(HadithCollection).order_by(HadithCollection.id))
    collections = result.scalars().all()
    return [
        {
            "id": c.id,
            "name_eng": c.name_eng,
            "name_ar": c.name_ar,
            "slug": c.slug,
        }
        for c in collections
    ]


@router.get("/{collection_slug}")
async def get_hadith_list(
    collection_slug: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, le=100),
    book_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    coll_result = await db.execute(
        select(HadithCollection).where(HadithCollection.slug == collection_slug)
    )
    collection = cast(Any, coll_result.scalar_one_or_none())
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    offset = (page - 1) * per_page

    query = select(Hadith).where(Hadith.collection_id == collection.id)
    count_query = select(func.count(Hadith.id)).where(Hadith.collection_id == collection.id)

    if book_id:
        query = query.where(Hadith.chapter_id == book_id)
        count_query = count_query.where(Hadith.chapter_id == book_id)

    query = (
        query.options(selectinload(Hadith.book))
        .order_by(Hadith.chapter_id, Hadith.id)
        .offset(offset)
        .limit(per_page)
    )

    result = await db.execute(query)
    hadith_list = cast(list[Any], result.scalars().all())

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    return {
        "collection": {
            "id": collection.id,
            "name_eng": collection.name_eng,
            "name_ar": collection.name_ar,
            "slug": collection.slug,
        },
        "hadiths": [
            HadithResponse(
                id=h.id,
                collection_name=collection.name_eng,
                collection_slug=collection.slug,
                book_name=h.book.name_eng if h.book else None,
                hadith_number=h.hadith_number,
                chapter_name_eng=h.chapter_name_eng,
                chapter_name_ar=h.chapter_name_ar,
                text_arabic=h.text_arabic,
                text_translation=h.text_translation,
                grade=h.grade,
            )
            for h in hadith_list
        ],
        "page": page,
        "per_page": per_page,
        "total": total,
        "total_pages": max(1, -(-total // per_page)),
    }


@router.get("/{collection_slug}/{hadith_id}", response_model=HadithResponse)
async def get_hadith_detail(
    collection_slug: str,
    hadith_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Hadith)
        .join(HadithCollection)
        .where(HadithCollection.slug == collection_slug, Hadith.id == hadith_id)
        .options(selectinload(Hadith.book), selectinload(Hadith.collection))
    )
    hadith = cast(Any, result.scalar_one_or_none())
    if not hadith:
        raise HTTPException(status_code=404, detail="Hadith not found")

    return HadithResponse(
        id=hadith.id,
        collection_name=hadith.collection.name_eng,
        collection_slug=hadith.collection.slug,
        book_name=hadith.book.name_eng if hadith.book else None,
        hadith_number=hadith.hadith_number,
        chapter_name_eng=hadith.chapter_name_eng,
        chapter_name_ar=hadith.chapter_name_ar,
        text_arabic=hadith.text_arabic,
        text_translation=hadith.text_translation,
        grade=hadith.grade,
    )
