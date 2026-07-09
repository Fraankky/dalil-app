from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class SearchResult(BaseModel):
    type: Literal["quran", "hadith"]
    source_id: int
    score: float
    relevance: int  # 0-100

    # Qur'an fields
    surah_name: str | None = None
    surah_number: int | None = None
    verse_number: int | None = None

    # Hadith fields
    collection_slug: str | None = None
    collection_name: str | None = None
    book_name: str | None = None
    hadith_number: str | None = None
    chapter_name: str | None = None
    grade: str | None = None

    # Common
    text_arabic: str
    text_translation: str | None = None


class SearchResponse(BaseModel):
    query: str
    query_lang: str
    total: int
    results: list[SearchResult]
    took_ms: int
    page: int
    pages: int


class VerseResponse(BaseModel):
    id: int
    surah_name_arabic: str
    surah_name_english: str
    surah_number: int
    verse_number: int
    text_arabic: str
    text_translation: str | None = None
    juz: int | None = None
    revelation_type: str | None = None
    tafsir: dict[str, Any] | None = None


class HadithResponse(BaseModel):
    id: int
    collection_name: str
    collection_slug: str
    book_name: str | None = None
    hadith_number: str
    chapter_name_eng: str | None = None
    chapter_name_ar: str | None = None
    text_arabic: str
    text_translation: str | None = None
    grade: str | None = None
    text_syarah: str | None = None


class StatsResponse(BaseModel):
    total_verses: int
    total_surahs: int
    total_hadith: int
    total_collections: int
    total_embeddings: int
    quran_embeddings: int
    hadith_embeddings: int
    model_name: str
    model_dim: int


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
