from data.scripts.ingest import _extract_hadith_book, _load_quran_tafsir, _prepare_hadith_row


def test_extract_hadith_book_reads_common_book_fields() -> None:
    row = {"book_number": 7, "book_name": "Prayer", "book_name_ar": "الصلاة"}

    book = _extract_hadith_book(row)

    assert book == {"book_number": 7, "name_eng": "Prayer", "name_ar": "الصلاة"}


def test_extract_hadith_book_returns_none_when_metadata_missing() -> None:
    assert _extract_hadith_book({"number": 1, "arab": "...", "id": "..."}) is None


def test_prepare_hadith_row_uses_book_number_as_chapter_id_when_available() -> None:
    meta = {"collection_id": 3}
    row = {
        "number": 10,
        "arab": "arabic",
        "id": "translation",
        "book_number": 2,
        "book_name": "Faith",
    }

    prepared = _prepare_hadith_row(meta, row)

    assert prepared["collection_id"] == 3
    assert prepared["chapter_id"] == 2
    assert prepared["hadith_number"] == "10"
    assert prepared["text_arabic"] == "arabic"
    assert prepared["text_translation"] == "translation"


def test_prepare_hadith_row_preserves_null_chapter_without_metadata() -> None:
    prepared = _prepare_hadith_row(
        {"collection_id": 3},
        {"number": 10, "arab": "arabic", "id": "translation"},
    )

    assert prepared["chapter_id"] is None


def test_prepare_hadith_row_includes_text_syarah_when_present() -> None:
    prepared = _prepare_hadith_row(
        {"collection_id": 10},
        {"number": 1, "arab": "arabic", "id": "translation", "syarah": "syarah text"},
    )

    assert prepared["text_syarah"] == "syarah text"


def test_prepare_hadith_row_text_syarah_none_when_missing() -> None:
    prepared = _prepare_hadith_row(
        {"collection_id": 10},
        {"number": 1, "arab": "arabic", "id": "translation"},
    )

    assert prepared["text_syarah"] is None


def test_prepare_hadith_row_preserves_null_chapter_without_metadata_nawawi() -> None:
    prepared = _prepare_hadith_row(
        {"collection_id": 10},
        {"number": 1, "arab": "arabic", "id": "translation"},
    )

    assert prepared["chapter_id"] is None
