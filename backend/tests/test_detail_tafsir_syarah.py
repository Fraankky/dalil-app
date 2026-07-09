from pathlib import Path

QURAN_API = Path(__file__).resolve().parents[1] / "app" / "api" / "quran.py"
HADITH_API = Path(__file__).resolve().parents[1] / "app" / "api" / "hadith.py"


def test_verse_response_includes_tafsir() -> None:
    source = QURAN_API.read_text()
    assert "tafsir=verse.text_tafsir" in source, (
        "get_verse harus pass tafsir=verse.text_tafsir ke VerseResponse"
    )


def test_hadith_response_includes_text_syarah() -> None:
    source = HADITH_API.read_text()
    assert "text_syarah=hadith.text_syarah" in source, (
        "get_hadith_detail harus pass text_syarah ke HadithResponse"
    )
