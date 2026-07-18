# Hybrid Search: Keyword-First, Semantic-Fallback

## Problem

1. **Bug**: Search "nikah" → UI shows "69 hasil" but 0 results displayed. `COUNT_QUERY` (seq scan) returns 69, `SEARCH_QUERY` (HNSW index scan with `ORDER BY embedding <=> vec`) returns 0. Root cause: HNSW filtered search with `ef_search=40` (default) fails when graph is dominated by one source_type (38k hadith vs 6k quran).

2. **Quality**: Semantic search returns irrelevant results for common keywords. "nikah" → "Dan sungguh, aku khawatir terhadap kerabatku" (score 0.47). User wants exact keyword matches first.

## Solution

Two-part fix in `backend/app/services/search.py`:

### Part 1: Keyword search (ILIKE) — primary path

Add `KEYWORD_QUERY` and `KEYWORD_COUNT` SQL constants. Search `text_translation` + `text_arabic` with `ILIKE '%{query}%'`.

### Part 2: Semantic search — fallback only

If keyword returns 0, fall back to existing semantic search with `SET LOCAL hnsw.ef_search = 500` fix.

## Files to modify

| File | Changes |
|---|---|
| `backend/app/services/search.py` | Add keyword SQL, modify `semantic_search()` to try keyword first, add `ef_search` fix |
| `backend/app/models/schemas.py` | Add `search_type: str` field to `SearchResponse` (optional: "keyword" or "semantic") |

No frontend changes needed — existing `SearchResponse` shape is compatible. `search_type` is informational.

## Implementation detail

### 1. Keyword SQL constants

```python
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
WHERE (v.text_translation ILIKE :pattern OR v.text_arabic ILIKE :pattern)
  AND (:source_quran)

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
WHERE (h.text_translation ILIKE :pattern OR h.text_arabic ILIKE :pattern)
  AND (:source_hadith)
  AND (:all_hadith_collections OR hc.slug = ANY(CAST(:hadith_collections AS TEXT[])))

ORDER BY type, source_id
LIMIT :limit OFFSET :offset
"""

KEYWORD_COUNT = """
SELECT count(*) FROM (
    SELECT 1 FROM verses v
    WHERE (v.text_translation ILIKE :pattern OR v.text_arabic ILIKE :pattern)
      AND (:source_quran)
    UNION ALL
    SELECT 1 FROM hadith h
    JOIN hadith_collections hc ON hc.id = h.collection_id
    WHERE (h.text_translation ILIKE :pattern OR h.text_arabic ILIKE :pattern)
      AND (:source_hadith)
      AND (:all_hadith_collections OR hc.slug = ANY(CAST(:hadith_collections AS TEXT[])))
) AS all_matches
"""
```

### 2. Modified `semantic_search()` → `search()`

```python
async def search(
    db: AsyncSession,
    query: str,
    sources: list[str] | None = None,
    limit: int = 10,
    offset: int = 0,
    min_score: float = 0.3,
) -> SearchResponse:
    source_quran, source_hadith = _source_flags(sources)
    hadith_collections = [s for s in (sources or []) if s in HADITH_SOURCES]
    pattern = f"%{query}%"

    keyword_params = {
        "pattern": pattern,
        "source_quran": source_quran,
        "source_hadith": source_hadith,
        "all_hadith_collections": not hadith_collections,
        "hadith_collections": hadith_collections,
        "limit": limit,
        "offset": offset,
    }

    # Try keyword search first
    rows = (await db.execute(text(KEYWORD_QUERY), keyword_params)).mappings().all()

    if rows:
        total = (await db.execute(text(KEYWORD_COUNT), keyword_params)).scalar() or 0
        results = [_build_result(row) for row in rows]
        return _build_response(query, total, results, limit, offset, search_type="keyword")

    # Fallback: semantic search with ef_search fix
    await db.execute(text("SET LOCAL hnsw.ef_search = 500"))
    embedding = await embed_query_async(query)
    # ... existing semantic search logic ...
    return _build_response(query, total, results, limit, offset, search_type="semantic")
```

### 3. Helper functions

Extract `_build_result(row) -> SearchResult` and `_build_response(...)` from existing code to avoid duplication between keyword and semantic paths.

### 4. Schema change

```python
class SearchResponse(BaseModel):
    query: str
    query_lang: str
    total: int
    results: list[SearchResult]
    took_ms: int
    page: int
    pages: int
    search_type: str = "keyword"  # "keyword" or "semantic"
```

### 5. API layer

Rename `semantic_search` call to `search` in `backend/app/api/search.py`. Or keep function name `semantic_search` for backward compat — minimal diff.

## Edge cases

- **SQL injection**: `pattern = f"%{query}%"` — query comes from API with `pattern=r"\S"` validation and `max_length=1024`. ILIKE pattern uses `%` and `_` as wildcards. User input containing `%` or `_` could match more than intended. Fix: escape `%` and `_` in query, or accept the broader match (ponytail: broader match is acceptable for a search app).
- **Empty keyword results**: If keyword finds 0, semantic runs. Semantic also needs `ef_search=500` fix.
- **Arabic keyword**: ILIKE works with Arabic text. `text_arabic ILIKE '%صلاة%'` matches verses containing that substring.
- **Performance**: ILIKE without trigram index = full scan on 44k rows. Tested: < 30ms. No index needed. Add `pg_trgm` + GIN index only if performance degrades.

## Verification

1. Search "nikah" → keyword results (5 quran + 1038 hadith), `search_type="keyword"`
2. Search "kindness to parents" → 0 keyword results → semantic fallback, `search_type="semantic"`
3. Search "صلاة" → keyword results (verses containing "صلاة"), `search_type="keyword"`
4. Search "sabar" → keyword results if any translation contains "sabar", else semantic
5. Verify `total` matches `results.length` on page 1 (no more "69 hasil tapi 0 ditampilkan")
6. Run `ruff check backend/ && ruff format --check backend/ && mypy backend/ --ignore-missing-imports`

## Out of scope

- Trigram index for ILIKE performance (YAGNI for 44k rows)
- BM25 scoring / ts_rank (keyword results all score 1.0, ordered by source_id)
- Frontend changes (search_type field is informational, UI doesn't need to show it)
- Hybrid merge (keyword + semantic combined) — user explicitly chose fallback-only
