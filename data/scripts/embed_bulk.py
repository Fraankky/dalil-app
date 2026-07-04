"""
Bulk embedding script — resumable, per-batch commit.

Usage:
    python data/scripts/embed_bulk.py [--batch 64] [--source quran|hadith|all]

Requires: DB running, model cached, .env configured.
"""

import argparse
import time

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.embedding import get_model, text_hash
from app.services.search import _vector_literal

MODEL = None


def get_model_singleton():
    global MODEL
    if MODEL is None:
        print(f"Loading model: {settings.embedding_model}...")
        t0 = time.monotonic()
        MODEL = get_model()
        print(f"  Loaded in {time.monotonic() - t0:.1f}s")
    return MODEL


def embed_source(source_type: str, batch_size: int) -> int:
    model = get_model_singleton()
    engine = create_engine(settings.database_url_sync)
    total = 0

    while True:
        with Session(engine) as session:
            if source_type == "quran":
                rows = session.execute(
                    text("""SELECT v.id AS sid, v.text_arabic, v.text_translation
                             FROM verses v
                             LEFT JOIN embeddings e
                               ON e.source_type = 'quran'
                              AND e.source_id = v.id
                              AND e.model_version = :mv
                             WHERE e.id IS NULL
                             ORDER BY v.id
                             LIMIT :bs"""),
                    {"mv": settings.embedding_model, "bs": batch_size},
                ).mappings().all()
            else:
                rows = session.execute(
                    text("""SELECT h.id AS sid, h.text_arabic, h.text_translation
                             FROM hadith h
                             LEFT JOIN embeddings e
                               ON e.source_type = 'hadith'
                              AND e.source_id = h.id
                              AND e.model_version = :mv
                             WHERE e.id IS NULL
                             ORDER BY h.id
                             LIMIT :bs"""),
                    {"mv": settings.embedding_model, "bs": batch_size},
                ).mappings().all()

            if not rows:
                break

            docs = []
            for r in rows:
                parts = [r["text_arabic"].strip()]
                if r.get("text_translation") and r["text_translation"].strip():
                    parts.append(r["text_translation"].strip())
                docs.append("\n".join(parts))

            prefixed = [f"passage: {d}" for d in docs]
            vecs = model.encode(prefixed, batch_size=batch_size, normalize_embeddings=True)

            vals = []
            for row, vec in zip(rows, vecs):
                doc = "\n".join(p for p in [row["text_arabic"].strip(), (row.get("text_translation") or "").strip()] if p)
                vals.append({
                    "st": source_type,
                    "sid": row["sid"],
                    "emb": _vector_literal(vec.tolist()),
                    "th": text_hash(doc),
                    "mv": settings.embedding_model,
                })

            session.execute(
                text("""INSERT INTO embeddings (source_type, source_id, embedding, text_hash, model_version)
                         VALUES (:st, :sid, CAST(:emb AS vector), :th, :mv)
                         ON CONFLICT (source_type, source_id, model_version)
                         DO UPDATE SET embedding = EXCLUDED.embedding, text_hash = EXCLUDED.text_hash"""),
                vals,
            )
            session.commit()
            total += len(rows)
            print(f"  +{len(rows)} = {total}", flush=True)

    return total


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int, default=64, help="Batch size")
    parser.add_argument("--source", choices=["quran", "hadith", "all"], default="all")
    args = parser.parse_args()

    print(f"Settings: model={settings.embedding_model}, dim={settings.embedding_dim}")
    print(f"Source: {args.source}, batch: {args.batch}")

    sources = ["quran", "hadith"] if args.source == "all" else [args.source]

    for src in sources:
        print(f"\n=== Embedding {src} ===")
        t0 = time.monotonic()
        n = embed_source(src, args.batch)
        print(f"  Done: {n} rows in {time.monotonic() - t0:.0f}s")

    print("\n=== Complete ===")


if __name__ == "__main__":
    main()
