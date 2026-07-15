from app.services.search import (
    COUNT_QUERY,
    KEYWORD_COUNT,
    KEYWORD_QUERY,
    SEARCH_QUERY,
    _candidate_limit,
    _keyword_params,
    _semantic_params,
    _source_flags,
    _vector_literal,
)


def test_source_flags_default_searches_quran_and_hadith() -> None:
    assert _source_flags(None) == (True, True)


def test_source_flags_quran_only() -> None:
    assert _source_flags(["quran"]) == (True, False)


def test_source_flags_hadith_collection_only() -> None:
    assert _source_flags(["bukhari"]) == (False, True)


def test_search_query_aligns_quran_and_hadith_union_columns() -> None:
    assert "quran_results AS" in SEARCH_QUERY
    assert "hadith_results AS" in SEARCH_QUERY
    assert "SELECT * FROM hadith_results" in SEARCH_QUERY
    assert "UNION ALL\n\n    SELECT * FROM quran_results" in SEARCH_QUERY

    for nullable_hadith_column in (
        "NULL::TEXT AS collection_slug",
        "NULL::TEXT AS collection_name",
        "NULL::TEXT AS book_name",
        "NULL::TEXT AS hadith_number",
        "NULL::TEXT AS chapter_name",
        "NULL::TEXT AS grade",
    ):
        assert nullable_hadith_column in SEARCH_QUERY

    for nullable_quran_column in (
        "NULL::TEXT AS surah_name",
        "NULL::INT AS surah_number",
        "NULL::INT AS verse_number",
    ):
        assert nullable_quran_column in SEARCH_QUERY


def test_search_queries_cast_embedding_with_safe_bind_param_syntax() -> None:
    for query in (SEARCH_QUERY, COUNT_QUERY):
        assert "SELECT CAST(:embedding AS vector) AS vec" in query
        assert ":embedding::vector" not in query


def test_semantic_params_include_hadith_collection_filter() -> None:
    params = _semantic_params(
        embedding_value="[0.1]",
        sources=["bukhari"],
        min_score=0.3,
        candidate_limit=25,
        limit=10,
        offset=0,
    )

    assert params["source_quran"] is False
    assert params["source_hadith"] is True
    assert params["all_hadith_collections"] is False
    assert params["hadith_collections"] == ["bukhari"]
    assert "hc.slug = ANY(CAST(:hadith_collections AS TEXT[]))" in SEARCH_QUERY
    assert "hc.slug = ANY(CAST(:hadith_collections AS TEXT[]))" in COUNT_QUERY


def test_vector_scan_applies_source_type_filter_before_candidate_limit() -> None:
    assert "AND (:source_quran OR e.source_type != 'quran')" in SEARCH_QUERY
    assert "AND (:source_hadith OR e.source_type != 'hadith')" in SEARCH_QUERY


def test_candidate_limit_oversamples_hadith_collection_filters() -> None:
    assert _candidate_limit(sources=["muslim"], limit=10, offset=0) == 2000


def test_candidate_limit_keeps_default_for_unfiltered_search() -> None:
    assert _candidate_limit(sources=None, limit=10, offset=0) == 500


def test_semantic_params_preserve_all_hadith_behavior() -> None:
    params = _semantic_params(
        embedding_value="[0.1]",
        sources=None,
        min_score=0.3,
        candidate_limit=25,
        limit=10,
        offset=0,
    )

    assert params["source_quran"] is True
    assert params["source_hadith"] is True
    assert params["all_hadith_collections"] is True
    assert params["hadith_collections"] == []


def test_vector_literal_formats_pgvector_value() -> None:
    assert _vector_literal([0.1, -0.2, 0.3]) == "[0.1,-0.2,0.3]"


def test_keyword_query_covers_quran_and_hadith_with_ilike() -> None:
    assert "v.text_translation ILIKE :pattern" in KEYWORD_QUERY
    assert "v.text_arabic ILIKE :pattern" in KEYWORD_QUERY
    assert "h.text_translation ILIKE :pattern" in KEYWORD_QUERY
    assert "h.text_arabic ILIKE :pattern" in KEYWORD_QUERY
    assert "UNION ALL" in KEYWORD_QUERY


def test_keyword_count_matches_keyword_query_scope() -> None:
    assert "v.text_translation ILIKE :pattern" in KEYWORD_COUNT
    assert "h.text_translation ILIKE :pattern" in KEYWORD_COUNT
    assert "UNION ALL" in KEYWORD_COUNT


def test_keyword_params_builds_pattern_with_wildcards() -> None:
    params = _keyword_params(query="nikah", sources=None, limit=20, offset=0)
    assert params["pattern"] == "%nikah%"
    assert params["source_quran"] is True
    assert params["source_hadith"] is True
    assert params["all_hadith_collections"] is True


def test_keyword_params_filters_hadith_collections() -> None:
    params = _keyword_params(query="nikah", sources=["bukhari"], limit=20, offset=0)
    assert params["source_quran"] is False
    assert params["source_hadith"] is True
    assert params["all_hadith_collections"] is False
    assert params["hadith_collections"] == ["bukhari"]
