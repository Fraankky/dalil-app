from typing import Any


class FakeMappings:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def __iter__(self):
        return iter(self.rows)


class FakeResult:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def mappings(self) -> FakeMappings:
        return FakeMappings(self.rows)


class FakeSession:
    def __init__(self, rows: list[dict[str, Any]] | None = None) -> None:
        self.rows = rows or []
        self.executions: list[tuple[str, dict[str, Any]]] = []
        self.committed = False

    def execute(self, query: Any, params: dict[str, Any]) -> FakeResult:
        self.executions.append((str(query), params))
        return FakeResult(self.rows)

    def commit(self) -> None:
        self.committed = True


def test_celery_app_imports() -> None:
    from app.celery_app import celery_app

    assert celery_app.main == "dalil"


def test_build_document_text_prefers_arabic_and_appends_translation() -> None:
    from app.tasks.embeddings import build_document_text

    text = build_document_text("الصبر جميل", "Patience is beautiful")

    assert text == "الصبر جميل\nPatience is beautiful"


def test_build_document_text_omits_empty_translation() -> None:
    from app.tasks.embeddings import build_document_text

    text = build_document_text("الحمد لله", "")

    assert text == "الحمد لله"


def test_rows_missing_embeddings_selects_missing_or_stale_hashes() -> None:
    from app.services.embedding import text_hash
    from app.tasks.embeddings import _rows_missing_embeddings

    unchanged_text = "الحمد لله\nPraise be to God"
    session = FakeSession(
        [
            {
                "source_id": 1,
                "text_arabic": "الحمد لله",
                "text_translation": "Praise be to God",
                "existing_text_hash": text_hash(unchanged_text),
            },
            {
                "source_id": 2,
                "text_arabic": "الصبر جميل",
                "text_translation": "Patience is beautiful",
                "existing_text_hash": "stale",
            },
            {
                "source_id": 3,
                "text_arabic": "الله أكبر",
                "text_translation": None,
                "existing_text_hash": None,
            },
        ]
    )

    rows = _rows_missing_embeddings(session, "quran", 10)

    query, _params = session.executions[0]
    assert "e.text_hash AS existing_text_hash" in query
    assert "LIMIT" not in query
    assert [row["source_id"] for row in rows] == [2, 3]


def test_upsert_embeddings_casts_pgvector_literal_and_replaces_stale_rows() -> None:
    from app.services.embedding import text_hash
    from app.services.search import _vector_literal
    from app.tasks.embeddings import _upsert_embeddings, build_document_text

    session = FakeSession()
    rows = [
        {
            "source_id": 7,
            "text_arabic": "الصبر جميل",
            "text_translation": "Patience is beautiful",
        }
    ]

    count = _upsert_embeddings(session, "quran", rows, [[0.1, -0.2, 0.3]])

    assert count == 1
    assert session.committed is True
    delete_query, delete_params = session.executions[0]
    insert_query, insert_params = session.executions[1]
    document = build_document_text("الصبر جميل", "Patience is beautiful")
    assert "DELETE FROM embeddings" in delete_query
    assert delete_params["source_type"] == "quran"
    assert delete_params["source_id"] == 7
    assert "VALUES (:source_type, :source_id, :embedding::vector" in insert_query
    assert insert_params["embedding"] == _vector_literal([0.1, -0.2, 0.3])
    assert insert_params["text_hash"] == text_hash(document)
