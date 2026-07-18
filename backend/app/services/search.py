"""Hybrid search service: keyword-first, semantic-fallback using pgvector."""

from typing import Any, Literal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import SearchResponse, SearchResult
from app.services.embedding import embed_query_async

_VECTOR_SCAN = """
    FROM embeddings e
    CROSS JOIN query_embedding qe
    WHERE 1 - (e.embedding <=> qe.vec) >= :min_score
      AND (:source_quran OR e.source_type != 'quran')
      AND (:source_hadith OR e.source_type != 'hadith')
"""

_COUNT_JOIN = """
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
{_VECTOR_SCAN}
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
      AND :source_quran
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
      AND :source_hadith
      AND (:all_hadith_collections OR hc.slug = ANY(CAST(:hadith_collections AS TEXT[])))
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
{_COUNT_JOIN}
"""

KEYWORD_QUERY = """
SELECT
    'quran' AS type,
    v.id AS source_id,
    1.0 AS score,
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
FROM verses v
JOIN surahs s ON s.id = v.surah_id
WHERE (v.text_translation ILIKE :pattern ESCAPE '\' OR v.text_arabic ILIKE :pattern ESCAPE '\')
  AND :source_quran

UNION ALL

SELECT
    'hadith' AS type,
    h.id AS source_id,
    1.0 AS score,
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
FROM hadith h
JOIN hadith_collections hc ON hc.id = h.collection_id
LEFT JOIN hadith_books hb
    ON hb.collection_id = h.collection_id AND hb.book_number = h.chapter_id
WHERE (h.text_translation ILIKE :pattern ESCAPE '\' OR h.text_arabic ILIKE :pattern ESCAPE '\')
  AND :source_hadith
  AND (:all_hadith_collections OR hc.slug = ANY(CAST(:hadith_collections AS TEXT[])))

ORDER BY type, source_id
LIMIT :limit OFFSET :offset
"""

KEYWORD_COUNT = """
SELECT count(*) FROM (
    SELECT 1 FROM verses v
    WHERE (v.text_translation ILIKE :pattern ESCAPE '\' OR v.text_arabic ILIKE :pattern ESCAPE '\')
      AND :source_quran
    UNION ALL
    SELECT 1 FROM hadith h
    JOIN hadith_collections hc ON hc.id = h.collection_id
    WHERE (h.text_translation ILIKE :pattern ESCAPE '\' OR h.text_arabic ILIKE :pattern ESCAPE '\')
      AND :source_hadith
      AND (:all_hadith_collections OR hc.slug = ANY(CAST(:hadith_collections AS TEXT[])))
) AS all_matches
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


def _hadith_collections(sources: list[str] | None) -> list[str]:
    return [source for source in (sources or []) if source in HADITH_SOURCES]


def _escape_ilike(query: str) -> str:
    return query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _keyword_params(
    query: str,
    sources: list[str] | None,
    limit: int,
    offset: int,
) -> dict[str, object]:
    source_quran, source_hadith = _source_flags(sources)
    collections = _hadith_collections(sources)
    return {
        "pattern": f"%{_escape_ilike(query)}%",
        "source_quran": source_quran,
        "source_hadith": source_hadith,
        "all_hadith_collections": not collections,
        "hadith_collections": collections,
        "limit": limit,
        "offset": offset,
    }


def _semantic_params(
    embedding_value: str,
    sources: list[str] | None,
    min_score: float,
    candidate_limit: int,
    limit: int,
    offset: int,
) -> dict[str, object]:
    source_quran, source_hadith = _source_flags(sources)
    collections = _hadith_collections(sources)
    return {
        "embedding": embedding_value,
        "source_quran": source_quran,
        "source_hadith": source_hadith,
        "all_hadith_collections": not collections,
        "hadith_collections": collections,
        "min_score": min_score,
        "candidate_limit": candidate_limit,
        "limit": limit,
        "offset": offset,
    }


def _candidate_limit(sources: list[str] | None, limit: int, offset: int) -> int:
    hadith_collections = [s for s in (sources or []) if s in HADITH_SOURCES]
    candidate_limit = max(500, (offset + limit) * 20)
    if hadith_collections:
        candidate_limit *= 4
    return candidate_limit


def _build_result(row: Any) -> SearchResult:
    score = float(row["score"])
    return SearchResult(
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


def _build_response(
    query: str,
    total: int,
    results: list[SearchResult],
    limit: int,
    offset: int,
    search_type: Literal["keyword", "semantic"],
) -> SearchResponse:
    return SearchResponse(
        query=query,
        query_lang=_detect_language(query),
        total=total,
        results=results,
        took_ms=0,
        page=(offset // limit) + 1 if limit > 0 else 1,
        pages=max(1, -(-total // limit)) if limit > 0 else 1,
        search_type=search_type,
    )


async def search(
    db: AsyncSession,
    query: str,
    sources: list[str] | None = None,
    limit: int = 10,
    offset: int = 0,
    min_score: float = 0.3,
) -> SearchResponse:
    kw_params = _keyword_params(query, sources, limit, offset)

    rows = (await db.execute(text(KEYWORD_QUERY), kw_params)).mappings().all()
    if rows:
        total = (await db.execute(text(KEYWORD_COUNT), kw_params)).scalar() or 0
        results = [_build_result(row) for row in rows]
        return _build_response(query, total, results, limit, offset, "keyword")

    await db.execute(text("SET LOCAL hnsw.ef_search = 500"))
    embedding = await embed_query_async(query)
    embedding_value = _vector_literal(embedding.tolist())

    candidate_limit = _candidate_limit(sources=sources, limit=limit, offset=offset)
    sem_params = _semantic_params(
        embedding_value=embedding_value,
        sources=sources,
        min_score=min_score,
        candidate_limit=candidate_limit,
        limit=limit,
        offset=offset,
    )

    sem_rows = (await db.execute(text(SEARCH_QUERY), sem_params)).mappings().all()
    total = (await db.execute(text(COUNT_QUERY), sem_params)).scalar() or 0
    results = [_build_result(row) for row in sem_rows]
    return _build_response(query, total, results, limit, offset, "semantic")


async def semantic_search(
    db: AsyncSession,
    query: str,
    sources: list[str] | None = None,
    limit: int = 10,
    offset: int = 0,
    min_score: float = 0.3,
) -> SearchResponse:
    return await search(db, query, sources, limit, offset, min_score)


def _detect_language(text: str) -> str:
    """Simple heuristic language detection."""
    arabic_chars = sum(1 for c in text if "\u0600" <= c <= "\u06ff")
    if arabic_chars > len(text) * 0.3:
        return "ar"
    return "en"
