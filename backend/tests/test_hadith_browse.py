from pathlib import Path


def test_hadith_api_does_not_reference_missing_book_id() -> None:
    source = Path("backend/app/api/hadith.py").read_text()

    assert "Hadith.book_id" not in source
    assert "Hadith.chapter_id" in source
