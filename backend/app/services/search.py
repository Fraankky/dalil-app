"""Semantic search service using pgvector."""

from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.schemas import SearchResult, SearchResponse
from app.services.embedding import embed_query


SEARCH_QUERY = """
WITH query_embedding AS (
    SELECT :embedding::vector AS vec
),
vector_results AS (
    SELECT
        e.source_type,
        e.source_id,
        1 - (e.embedding <=> qe.vec) AS score
    FROM embeddings e, query_embedding qe
    WHERE (:source_quran OR e.source_type = 'hadith')
      AND (:source_hadith OR e.source_type = 'quran')
      AND 1 - (e.embedding <=> qe.vec) >= :min_score
    ORDER BY e.embedding <=> qe.vec
    LIMIT :candidate_limit
),
quran_results AS (
    SELECT
        'quran' AS type,
        vr.source_id::INT AS source_id,
        vr.score,
        v.id AS verse_id,
        s.name_english AS surah_name,
        s.id AS surah_number,
        v.verse_number,
        v.text_arabic,
        v.text_translation
    FROM vector_results vr
    JOIN verses v ON v.id = vr.source_id
    JOIN surahs s ON s.id = v.surah_id
    WHERE vr.source_type = 'quran'
),
combined AS (
    SELECT
        'hadith' AS type,
        vr.source_id::INT AS source_id,
        vr.score,
        h.id AS hadith_id,
        hc.slug AS collection_slug,
        hc.name_eng AS collection_name,
        hb.name_eng AS book_name,
        h.hadith_number,
        h.chapter_name_eng AS chapter_name,
        h.grade,
        h.text_arabic,
        h.text_english AS text_translation
    FROM vector_results vr
    JOIN hadith h ON h.id = vr.source_id
    JOIN hadith_collections hc ON hc.id = h.collection_id
    LEFT JOIN hadith_books hb ON hb.collection_id = h.collection_id AND hb.book_number = h.chapter_id
    WHERE vr.source_type = 'hadith'

    UNION ALL

    SELECT * FROM quran_results
)
SELECT * FROM combined
ORDER BY score DESC
LIMIT :limit OFFSET :offset
"""

COUNT_QUERY = """
WITH query_embedding AS (
    SELECT :embedding::vector AS vec
)
SELECT COUNT(*) AS total
FROM embeddings e, query_embedding qe
WHERE (:source_quran OR e.source_type = 'hadith')
  AND (:source_hadith OR e.source_type = 'quran')
  AND 1 - (e.embedding <=> qe.vec) >= :min_score
"""


async def semantic_search(
    db: AsyncSession,
    query: str,
    sources: Optional[list[str]] = None,
    limit: int = 10,
    offset: int = 0,
    min_score: float = 0.3,
) -> SearchResponse:
    embedding = embed_query(query)
    embedding_list = embedding.tolist()

    source_quran = sources is None or "quran" in sources
    source_hadith = sources is None or any(s in sources for s in ["bukhari", "muslim", "abudawud", "tirmidhi", "nasai", "ibnmajah", "malik", "nawawi40"])

    candidate_limit = (offset + limit) * 5  # Oversample for accurate pagination

    params = {
        "embedding": embedding_list,
        "source_quran": source_quran,
        "source_hadith": source_hadith,
        "min_score": min_score,
        "candidate_limit": candidate_limit,
        "limit": limit,
        "offset": offset,
    }

    result = await db.execute(text(SEARCH_QUERY), params)
    rows = result.mappings().all()

    results = []
    for row in rows:
        score = row["score"]
        results.append(SearchResult(
            type=row["type"],
            source_id=row["source_id"],
            score=round(score, 4),
            relevance=round(score * 100),
            surah_name=row.get("surah_name"),
            surah_number=row.get("surah_number"),
            verse_number=row.get("verse_number"),
            collection_slug=row.get("collection_slug"),
            collection_name=row.get("collection_name"),
            book_name=row.get("book_name"),
            hadith_number=row.get("hadith_number"),
            chapter_name=row.get("chapter_name"),
            grade=row.get("grade"),
            text_arabic=row["text_arabic"],
            text_translation=row.get("text_translation"),
        ))

    # Count total
    count_result = await db.execute(text(COUNT_QUERY), params)
    total = count_result.scalar() or 0

    return SearchResponse(
        query=query,
        query_lang=_detect_language(query),
        total=total,
        results=results,
        took_ms=0,  # Will be set in API layer
        page=(offset // limit) + 1 if limit > 0 else 1,
        pages=max(1, -(-total // limit)) if limit > 0 else 1,
    )


def _detect_language(text: str) -> str:
    """Simple heuristic language detection."""
    arabic_chars = sum(1 for c in text if '\u0600' <= c <= '\u06ff')
    if arabic_chars > len(text) * 0.3:
        return "ar"
    return "en"
