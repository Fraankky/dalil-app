from collections.abc import AsyncIterator

from fastapi.testclient import TestClient

from app.api import search as search_api
from app.core.database import get_db
from app.main import app
from app.models.schemas import SearchResponse, SearchResult


async def _override_db() -> AsyncIterator[object]:
    yield object()


def test_search_endpoint_parses_sources_and_returns_results(monkeypatch) -> None:
    captured = {}

    async def fake_semantic_search(db, query, sources, limit, offset, min_score):
        captured.update(
            {
                "db": db,
                "query": query,
                "sources": sources,
                "limit": limit,
                "offset": offset,
                "min_score": min_score,
            }
        )
        return SearchResponse(
            query=query,
            query_lang="en",
            total=1,
            results=[
                SearchResult(
                    type="hadith",
                    source_id=1,
                    score=0.7,
                    relevance=70,
                    collection_slug="muslim",
                    collection_name="Muslim",
                    hadith_number="1",
                    text_arabic="arabic",
                    text_translation="translation",
                )
            ],
            took_ms=0,
            page=1,
            pages=1,
        )

    app.dependency_overrides[get_db] = _override_db
    monkeypatch.setattr(search_api, "semantic_search", fake_semantic_search)

    try:
        response = TestClient(app).get(
            "/api/v1/search",
            params={"q": "prophet", "sources": " quran, muslim ", "limit": 1, "offset": 0},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["query"] == "prophet"
    assert captured["sources"] == ["quran", "muslim"]
    assert captured["limit"] == 1
    assert response.json()["results"][0]["collection_slug"] == "muslim"
