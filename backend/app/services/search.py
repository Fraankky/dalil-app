"""Semantic search service using pgvector."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import SearchResponse, SearchResult
from app.services.embedding import embed_query

_VECTOR_JOIN = """
    FROM embeddings e
    CROSS JOIN query_embedding qe
    LEFT JOIN hadith h ON h.id = e.source_id
    LEFT JOIN hadith_collections hc ON hc.id = h.collection_id
    WHERE (:source_quran OR e.source_type = 'hadith')
      AND (:source_hadith OR e.source_type = 'quran')
      AND 1 - (e.embedding <=> qe.vec) >= :min_score
      AND (
          e.source_type != 'hadith'
          OR :all_hadith_collections
          OR hc.slug = ANY(CAST(:hadith_collections AS TEXT[]))
      )
"""

SEARCH_QUERY = f"""
WITH query_embedding AS (
    SELECT CAST(:embedding AS vector) AS vec
),
vector_results AS (
    SELECT
        e.source_type,
        e.source_id,
        1 - (e.embedding <=> qe.vec) AS score
{_VECTOR_JOIN}
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
        NULL::TEXT AS collection_slug,
        NULL::TEXT AS collection_name,
        NULL::TEXT AS book_name,
        NULL::TEXT AS hadith_number,
        NULL::TEXT AS chapter_name,
        NULL::TEXT AS grade,
        v.text_arabic,
        v.text_translation
    FROM vector_results vr
    JOIN verses v ON v.id = vr.source_id
    JOIN surahs s ON s.id = v.surah_id
    WHERE vr.source_type = 'quran'
),
hadith_results AS (
    SELECT
        'hadith' AS type,
        vr.source_id::INT AS source_id,
        vr.score,
        NULL::INT AS verse_id,
        NULL::TEXT AS surah_name,
        NULL::INT AS surah_number,
        NULL::INT AS verse_number,
        hc.slug AS collection_slug,
        hc.name_eng AS collection_name,
        hb.name_eng AS book_name,
        h.hadith_number::TEXT AS hadith_number,
        h.chapter_name_eng AS chapter_name,
        h.grade,
        h.text_arabic,
        h.text_translation
    FROM vector_results vr
    JOIN hadith h ON h.id = vr.source_id
    JOIN hadith_collections hc ON hc.id = h.collection_id
    LEFT JOIN hadith_books hb
        ON hb.collection_id = h.collection_id AND hb.book_number = h.chapter_id
    WHERE vr.source_type = 'hadith'
),
combined AS (
    SELECT * FROM hadith_results

    UNION ALL

    SELECT * FROM quran_results
)
SELECT * FROM combined
ORDER BY score DESC
LIMIT :limit OFFSET :offset
"""

COUNT_QUERY = f"""
WITH query_embedding AS (
    SELECT CAST(:embedding AS vector) AS vec
)
SELECT COUNT(*) AS total
{_VECTOR_JOIN}
"""

HADITH_SOURCES = {
    "abudawud",
    "ahmad",
    "bukhari",
    "darimi",
    "ibnmajah",
    "malik",
    "muslim",
    "nasai",
    "tirmidhi",
}


def _source_flags(sources: list[str] | None) -> tuple[bool, bool]:
    if sources is None:
        return True, True
    source_quran = "quran" in sources
    source_hadith = any(source in HADITH_SOURCES for source in sources)
    return source_quran, source_hadith


def _vector_literal(values: list[float]) -> str:
    return "[" + ",".join(str(float(value)) for value in values) + "]"


def _search_params(
    embedding_value: str,
    sources: list[str] | None,
    min_score: float,
    candidate_limit: int,
    limit: int,
    offset: int,
) -> dict[str, object]:
    source_quran, source_hadith = _source_flags(sources)
    hadith_collections = [source for source in (sources or []) if source in HADITH_SOURCES]

    return {
        "embedding": embedding_value,
        "source_quran": source_quran,
        "source_hadith": source_hadith,
        "all_hadith_collections": not hadith_collections,
        "hadith_collections": hadith_collections,
        "min_score": min_score,
        "candidate_limit": candidate_limit,
        "limit": limit,
        "offset": offset,
    }


async def semantic_search(
    db: AsyncSession,
    query: str,
    sources: list[str] | None = None,
    limit: int = 10,
    offset: int = 0,
    min_score: float = 0.3,
) -> SearchResponse:
    embedding = embed_query(query)
    embedding_value = _vector_literal(embedding.tolist())

    candidate_limit = (offset + limit) * 5  # Oversample for accurate pagination
    params = _search_params(
        embedding_value=embedding_value,
        sources=sources,
        min_score=min_score,
        candidate_limit=candidate_limit,
        limit=limit,
        offset=offset,
    )

    result = await db.execute(text(SEARCH_QUERY), params)
    rows = result.mappings().all()

    results = []
    for row in rows:
        score = row["score"]
        results.append(
            SearchResult(
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
            )
        )

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
    arabic_chars = sum(1 for c in text if "\u0600" <= c <= "\u06ff")
    if arabic_chars > len(text) * 0.3:
        return "ar"
    return "en"
