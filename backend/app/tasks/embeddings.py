from collections.abc import Iterable
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.core.config import settings
from app.services.embedding import embed_documents, text_hash
from app.services.search import _vector_literal


def build_document_text(arabic: str, translation: str | None) -> str:
    parts = [arabic.strip()]
    if translation and translation.strip():
        parts.append(translation.strip())
    return "\n".join(part for part in parts if part)


def _rows_missing_embeddings(
    session: Session,
    source_type: str,
    limit: int,
) -> list[dict[str, Any]]:
    fetch_limit = limit * 3
    if source_type == "quran":
        query = text(
            """
            SELECT
                v.id AS source_id,
                v.text_arabic,
                v.text_translation,
                e.text_hash AS existing_text_hash
            FROM verses v
            LEFT JOIN embeddings e
              ON e.source_type = 'quran'
             AND e.source_id = v.id
             AND e.model_version = :model_version
            WHERE e.id IS NULL OR e.text_hash IS NOT NULL
            ORDER BY v.id
            LIMIT :fetch_limit
            """
        )
    else:
        query = text(
            """
            SELECT
                h.id AS source_id,
                h.text_arabic,
                h.text_translation,
                e.text_hash AS existing_text_hash
            FROM hadith h
            LEFT JOIN embeddings e
              ON e.source_type = 'hadith'
             AND e.source_id = h.id
             AND e.model_version = :model_version
            WHERE e.id IS NULL OR e.text_hash IS NOT NULL
            ORDER BY h.id
            LIMIT :fetch_limit
            """
        )

    rows: list[dict[str, Any]] = []
    for row in session.execute(
        query,
        {"model_version": settings.embedding_model, "fetch_limit": fetch_limit},
    ).mappings():
        row_dict = dict(row)
        document = build_document_text(row_dict["text_arabic"], row_dict.get("text_translation"))
        if row_dict.get("existing_text_hash") == text_hash(document):
            continue
        rows.append(row_dict)
        if len(rows) == limit:
            break
    return rows


def _upsert_embeddings(
    session: Session,
    source_type: str,
    rows: Iterable[dict[str, Any]],
    vectors: Iterable[list[float]],
) -> int:
    count = 0
    for row, vector in zip(rows, vectors, strict=True):
        document = build_document_text(row["text_arabic"], row.get("text_translation"))
        session.execute(
            text(
                """
                INSERT INTO embeddings (source_type, source_id, embedding, text_hash, model_version)
                VALUES (
                    :source_type, :source_id, CAST(:embedding AS vector), :text_hash, :model_version
                )
                ON CONFLICT (source_type, source_id, model_version)
                DO UPDATE SET embedding = EXCLUDED.embedding, text_hash = EXCLUDED.text_hash
                """
            ),
            {
                "source_type": source_type,
                "source_id": row["source_id"],
                "embedding": _vector_literal(vector),
                "text_hash": text_hash(document),
                "model_version": settings.embedding_model,
            },
        )
        count += 1
    session.commit()
    return count


_engine = None


def _get_engine():
    global _engine
    if _engine is None:
        _engine = create_engine(settings.database_url_sync)
    return _engine


def _embed_source(source_type: str, batch_size: int | None = None) -> int:
    size = batch_size or settings.embedding_batch_size
    with Session(_get_engine()) as session:
        rows = _rows_missing_embeddings(session, source_type, size)
        if not rows:
            return 0
        documents = [
            build_document_text(row["text_arabic"], row.get("text_translation")) for row in rows
        ]
        vectors = embed_documents(documents, batch_size=size).tolist()
        return _upsert_embeddings(session, source_type, rows, vectors)


@celery_app.task(name="app.tasks.embeddings.embed_quran")  # type: ignore[untyped-decorator]
def embed_quran(batch_size: int | None = None) -> int:
    return _embed_source("quran", batch_size)


@celery_app.task(name="app.tasks.embeddings.embed_hadith")  # type: ignore[untyped-decorator]
def embed_hadith(batch_size: int | None = None) -> int:
    return _embed_source("hadith", batch_size)


@celery_app.task(name="app.tasks.embeddings.embed_all")  # type: ignore[untyped-decorator]
def embed_all(batch_size: int | None = None) -> dict[str, str]:
    return {
        "quran": embed_quran.delay(batch_size).id,
        "hadith": embed_hadith.delay(batch_size).id,
    }
