from app.services.search import (
    COUNT_QUERY,
    SEARCH_QUERY,
    _candidate_limit,
    _search_params,
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


def test_search_params_include_hadith_collection_filter() -> None:
    params = _search_params(
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


def test_search_params_preserve_all_hadith_behavior() -> None:
    params = _search_params(
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
