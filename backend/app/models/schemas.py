from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class SearchResult(BaseModel):
    type: Literal["quran", "hadith"]
    source_id: int
    score: float
    relevance: int  # 0-100

    # Qur'an fields
    surah_name: Optional[str] = None
    surah_number: Optional[int] = None
    verse_number: Optional[int] = None

    # Hadith fields
    collection_slug: Optional[str] = None
    collection_name: Optional[str] = None
    book_name: Optional[str] = None
    hadith_number: Optional[str] = None
    chapter_name: Optional[str] = None
    grade: Optional[str] = None

    # Common
    text_arabic: str
    text_translation: Optional[str] = None


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
    text_translation: Optional[str] = None
    juz: Optional[int] = None
    revelation_type: Optional[str] = None


class HadithResponse(BaseModel):
    id: int
    collection_name: str
    collection_slug: str
    book_name: Optional[str] = None
    hadith_number: str
    chapter_name_eng: Optional[str] = None
    chapter_name_ar: Optional[str] = None
    text_arabic: str
    text_english: Optional[str] = None
    grade: Optional[str] = None


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
    detail: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
