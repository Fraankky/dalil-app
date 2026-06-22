from app.services.search import _source_flags, _vector_literal


def test_source_flags_default_searches_quran_and_hadith() -> None:
    assert _source_flags(None) == (True, True)


def test_source_flags_quran_only() -> None:
    assert _source_flags(["quran"]) == (True, False)


def test_source_flags_hadith_collection_only() -> None:
    assert _source_flags(["bukhari"]) == (False, True)


def test_vector_literal_formats_pgvector_value() -> None:
    assert _vector_literal([0.1, -0.2, 0.3]) == "[0.1,-0.2,0.3]"
