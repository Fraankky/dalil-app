from unittest.mock import MagicMock


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


def test_rows_missing_embeddings_filters_by_text_hash() -> None:
    from app.services.embedding import text_hash
    from app.tasks.embeddings import _rows_missing_embeddings

    unchanged = text_hash("الحمد لله\nPraise be to God")
    session = _mock_session(
        [
            {
                "source_id": 1,
                "text_arabic": "الحمد لله",
                "text_translation": "Praise be to God",
                "existing_text_hash": unchanged,
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

    assert len(rows) == 2
    assert [row["source_id"] for row in rows] == [2, 3]


def test_upsert_embeddings_uses_safe_vector_cast_and_produces_correct_hash() -> None:
    from app.services.embedding import text_hash
    from app.services.search import _vector_literal
    from app.tasks.embeddings import _upsert_embeddings, build_document_text

    session = _mock_session([])
    rows = [
        {
            "source_id": 7,
            "text_arabic": "الصبر جميل",
            "text_translation": "Patience is beautiful",
        }
    ]

    count = _upsert_embeddings(session, "quran", rows, [[0.1, -0.2, 0.3]])

    assert count == 1
    assert session.commit.called

    delete_args = _exec_args(session, 0)
    insert_args = _exec_args(session, 1)

    document = build_document_text("الصبر جميل", "Patience is beautiful")

    assert "DELETE FROM embeddings" in str(delete_args)
    assert delete_args[1]["source_type"] == "quran"
    assert delete_args[1]["source_id"] == 7

    assert "CAST(:embedding AS vector)" in str(insert_args)
    assert ":embedding::vector" not in str(insert_args)
    assert insert_args[1]["embedding"] == _vector_literal([0.1, -0.2, 0.3])
    assert insert_args[1]["text_hash"] == text_hash(document)


def _mock_session(rows: list[dict]) -> MagicMock:
    session = MagicMock()
    result = MagicMock()
    result.mappings.return_value = rows
    session.execute.return_value = result
    return session


def _exec_args(session: MagicMock, call_index: int) -> tuple:
    return session.execute.call_args_list[call_index][0]
