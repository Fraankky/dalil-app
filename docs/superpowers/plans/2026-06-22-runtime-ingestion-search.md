# Runtime Ingestion Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the backend from migration and ingestion through browse APIs, embedding worker execution, and semantic search verification.

**Architecture:** Keep the existing FastAPI, SQLAlchemy, Alembic, Celery, Redis, and pgvector architecture. Make small backend-only fixes that align schema, ingestion, runtime APIs, worker tasks, and search SQL without redesigning the data model.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy 2.0 async, Alembic, PostgreSQL 16 + pgvector, Redis 7, Celery, SentenceTransformers, pytest, Ruff, mypy.

## Global Constraints

- Backend code follows Ruff rules `E, F, W, I, UP, B, C4, SIM, N` and mypy strict mode from `backend/pyproject.toml`.
- API routes keep the `/api/v1/` prefix from `settings.api_prefix`.
- Database schema changes use Alembic migrations only; do not manually edit tables.
- Environment variables stay in `.env` for local use and are never committed.
- Preserve the current schema convention: `hadith.chapter_id` links to `hadith_books.book_number` within the same collection.
- Keep changes backend-focused; do not redesign frontend or production deployment.
- Do not edit or revert unrelated existing worktree changes unless they are required for the task.

---

## File Structure

- Modify: `backend/app/models/schemas.py` to add embedding coverage fields to `StatsResponse`.
- Modify: `backend/app/api/meta.py` to count embeddings and expose coverage.
- Create: `backend/tests/test_stats.py` for stats response behavior using a fake async DB session.
- Modify: `backend/app/api/hadith.py` to remove invalid `Hadith.book_id` use and avoid async lazy-load failures.
- Create: `backend/tests/test_hadith_browse.py` for query construction and response mapping behavior.
- Create: `backend/app/celery_app.py` as the Celery app entrypoint expected by Docker Compose.
- Create: `backend/app/tasks/__init__.py` for task package discovery.
- Create: `backend/app/tasks/embeddings.py` for Quran/Hadith embedding tasks and upsert helpers.
- Create: `backend/tests/test_embedding_tasks.py` for task helper behavior without loading the model.
- Modify: `backend/app/services/search.py` only if real pgvector execution exposes SQL or source-filter runtime bugs.
- Create: `backend/tests/test_search_service.py` for source filtering and vector parameter formatting behavior.

---

### Task 1: Stats Endpoint Embedding Coverage

**Files:**
- Modify: `backend/app/models/schemas.py`
- Modify: `backend/app/api/meta.py`
- Create: `backend/tests/test_stats.py`

**Interfaces:**
- Consumes: `app.models.models.Embedding` SQLAlchemy model.
- Produces: `StatsResponse.total_embeddings: int`, `StatsResponse.quran_embeddings: int`, `StatsResponse.hadith_embeddings: int`.

- [ ] **Step 1: Write failing stats schema test**

Create `backend/tests/test_stats.py`:

```python
from app.models.schemas import StatsResponse


def test_stats_response_includes_embedding_counts() -> None:
    response = StatsResponse(
        total_verses=6236,
        total_surahs=114,
        total_hadith=100,
        total_collections=2,
        total_embeddings=6336,
        quran_embeddings=6236,
        hadith_embeddings=100,
        model_name="intfloat/multilingual-e5-large-instruct",
        model_dim=1024,
    )

    assert response.total_embeddings == 6336
    assert response.quran_embeddings == 6236
    assert response.hadith_embeddings == 100
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/venv/bin/pytest backend/tests/test_stats.py -q`

Expected: FAIL with validation errors or unexpected keyword errors for embedding fields.

- [ ] **Step 3: Add embedding fields to stats schema**

Edit `backend/app/models/schemas.py` so `StatsResponse` is:

```python
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
```

- [ ] **Step 4: Update stats endpoint counts**

Edit imports in `backend/app/api/meta.py`:

```python
from app.models.models import Embedding, Hadith, HadithCollection, Surah, Verse
```

Edit `get_stats` so it computes and returns embedding counts:

```python
@router.get("/stats", response_model=StatsResponse)
async def get_stats(db: AsyncSession = Depends(get_db)):
    total_verses = (await db.execute(select(func.count(Verse.id)))).scalar() or 0
    total_surahs = (await db.execute(select(func.count(Surah.id)))).scalar() or 0
    total_hadith = (await db.execute(select(func.count(Hadith.id)))).scalar() or 0
    total_collections = (await db.execute(select(func.count(HadithCollection.id)))).scalar() or 0
    total_embeddings = (await db.execute(select(func.count(Embedding.id)))).scalar() or 0
    quran_embeddings = (
        await db.execute(select(func.count(Embedding.id)).where(Embedding.source_type == "quran"))
    ).scalar() or 0
    hadith_embeddings = (
        await db.execute(select(func.count(Embedding.id)).where(Embedding.source_type == "hadith"))
    ).scalar() or 0

    return StatsResponse(
        total_verses=total_verses,
        total_surahs=total_surahs,
        total_hadith=total_hadith,
        total_collections=total_collections,
        total_embeddings=total_embeddings,
        quran_embeddings=quran_embeddings,
        hadith_embeddings=hadith_embeddings,
        model_name=settings.embedding_model,
        model_dim=settings.embedding_dim,
    )
```

- [ ] **Step 5: Run stats test**

Run: `backend/venv/bin/pytest backend/tests/test_stats.py -q`

Expected: PASS.

- [ ] **Step 6: Verify migration and ingestion commands**

Run: `docker compose up -d db redis`

Expected: PostgreSQL and Redis containers become healthy.

Run: `cd backend && ../backend/venv/bin/alembic upgrade head`

Expected: Alembic applies `0001` or reports database already at head.

Run: `DATABASE_URL_SYNC=postgresql://postgres:postgres@localhost:5432/dalil backend/venv/bin/python data/scripts/ingest.py all`

Expected: output ends with `INGESTION COMPLETE` and non-zero Quran/Hadith counts.

- [ ] **Step 7: Run quality checks for phase**

Run: `backend/venv/bin/ruff check backend/app backend/tests`

Expected: PASS.

Run: `backend/venv/bin/ruff format --check backend/app backend/tests`

Expected: PASS or a list of files requiring format. If format fails, run `backend/venv/bin/ruff format backend/app backend/tests`, then rerun the check.

- [ ] **Step 8: Commit phase 1 + 2**

Run: `git status --short`

Expected: only intended files from this task plus pre-existing unrelated files are modified.

Run: `git add backend/app/models/schemas.py backend/app/api/meta.py backend/tests/test_stats.py && git commit -m "fix: add embedding coverage stats"`

Expected: commit succeeds.

---

### Task 2: Hadith Browse Runtime Fixes

**Files:**
- Modify: `backend/app/api/hadith.py`
- Create: `backend/tests/test_hadith_browse.py`

**Interfaces:**
- Consumes: `Hadith.chapter_id`, `Hadith.book` relationship, `HadithResponse`.
- Produces: `get_hadith_list(collection_slug: str, page: int, per_page: int, book_id: int | None, db: AsyncSession)` that filters with `Hadith.chapter_id` and eagerly loads `Hadith.book`.

- [ ] **Step 1: Write failing source regression test**

Create `backend/tests/test_hadith_browse.py`:

```python
from pathlib import Path


def test_hadith_api_does_not_reference_missing_book_id() -> None:
    source = Path("backend/app/api/hadith.py").read_text()

    assert "Hadith.book_id" not in source
    assert "Hadith.chapter_id" in source
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/venv/bin/pytest backend/tests/test_hadith_browse.py -q`

Expected: FAIL because `Hadith.book_id` is present.

- [ ] **Step 3: Fix filter and eager loading**

Edit `backend/app/api/hadith.py` imports to keep `selectinload` and remove unused imports after implementation.

In `get_hadith_list`, replace the filter block:

```python
    if book_id:
        query = query.where(Hadith.chapter_id == book_id)
        count_query = count_query.where(Hadith.chapter_id == book_id)
```

Before executing list query, add eager loading and deterministic ordering:

```python
    query = (
        query.options(selectinload(Hadith.book))
        .order_by(Hadith.chapter_id, Hadith.id)
        .offset(offset)
        .limit(per_page)
    )
```

Remove the old line:

```python
    query = query.offset(offset).limit(per_page)
```

- [ ] **Step 4: Run hadith regression test**

Run: `backend/venv/bin/pytest backend/tests/test_hadith_browse.py -q`

Expected: PASS.

- [ ] **Step 5: Smoke test browse endpoints against local API**

Start backend if it is not already running:

Run: `cd backend && ../backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000`

In another shell, run:

```bash
curl -f http://127.0.0.1:8000/api/v1/quran/surahs
curl -f http://127.0.0.1:8000/api/v1/quran/1
curl -f http://127.0.0.1:8000/api/v1/quran/1/1
curl -f http://127.0.0.1:8000/api/v1/hadith/collections
curl -f http://127.0.0.1:8000/api/v1/hadith/bukhari
```

Expected: each command exits 0 and returns JSON.

- [ ] **Step 6: Run quality checks for phase**

Run: `backend/venv/bin/ruff check backend/app backend/tests`

Expected: PASS.

Run: `backend/venv/bin/ruff format --check backend/app backend/tests`

Expected: PASS or format then rerun.

- [ ] **Step 7: Commit phase 3**

Run: `git add backend/app/api/hadith.py backend/tests/test_hadith_browse.py && git commit -m "fix: repair hadith browse filtering"`

Expected: commit succeeds.

---

### Task 3: Embedding Celery Worker

**Files:**
- Create: `backend/app/celery_app.py`
- Create: `backend/app/tasks/__init__.py`
- Create: `backend/app/tasks/embeddings.py`
- Create: `backend/tests/test_embedding_tasks.py`

**Interfaces:**
- Consumes: `settings.celery_broker_url`, `settings.celery_result_backend`, `settings.embedding_model`, `settings.embedding_batch_size`, `embed_documents(texts: list[str], batch_size: int | None) -> np.ndarray`, `text_hash(text: str) -> str`.
- Produces: Celery app object `celery_app`, tasks `embed_quran`, `embed_hadith`, `embed_all`, helper `build_document_text(arabic: str, translation: str | None) -> str`.

- [ ] **Step 1: Write failing helper/import tests**

Create `backend/tests/test_embedding_tasks.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `backend/venv/bin/pytest backend/tests/test_embedding_tasks.py -q`

Expected: FAIL with `ModuleNotFoundError: No module named 'app.celery_app'`.

- [ ] **Step 3: Create Celery app entrypoint**

Create `backend/app/celery_app.py`:

```python
from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "dalil",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.embeddings"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)
```

Create `backend/app/tasks/__init__.py`:

```python
"""Celery task package."""
```

- [ ] **Step 4: Create embedding task module**

Create `backend/app/tasks/embeddings.py`:

```python
from collections.abc import Iterable

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.core.config import settings
from app.services.embedding import embed_documents, text_hash


def build_document_text(arabic: str, translation: str | None) -> str:
    parts = [arabic.strip()]
    if translation and translation.strip():
        parts.append(translation.strip())
    return "\n".join(part for part in parts if part)


def _rows_missing_embeddings(session: Session, source_type: str, limit: int) -> list[dict]:
    if source_type == "quran":
        query = text(
            """
            SELECT v.id AS source_id, v.text_arabic, v.text_translation
            FROM verses v
            LEFT JOIN embeddings e
              ON e.source_type = 'quran'
             AND e.source_id = v.id
             AND e.model_version = :model_version
            WHERE e.id IS NULL
            ORDER BY v.id
            LIMIT :limit
            """
        )
    else:
        query = text(
            """
            SELECT h.id AS source_id, h.text_arabic, h.text_english AS text_translation
            FROM hadith h
            LEFT JOIN embeddings e
              ON e.source_type = 'hadith'
             AND e.source_id = h.id
             AND e.model_version = :model_version
            WHERE e.id IS NULL
            ORDER BY h.id
            LIMIT :limit
            """
        )

    return [
        dict(row)
        for row in session.execute(
            query,
            {"model_version": settings.embedding_model, "limit": limit},
        ).mappings()
    ]


def _upsert_embeddings(session: Session, source_type: str, rows: Iterable[dict], vectors: Iterable[list[float]]) -> int:
    count = 0
    for row, vector in zip(rows, vectors):
        document = build_document_text(row["text_arabic"], row.get("text_translation"))
        session.execute(
            text(
                """
                INSERT INTO embeddings (source_type, source_id, embedding, text_hash, model_version)
                VALUES (:source_type, :source_id, :embedding, :text_hash, :model_version)
                ON CONFLICT DO NOTHING
                """
            ),
            {
                "source_type": source_type,
                "source_id": row["source_id"],
                "embedding": vector,
                "text_hash": text_hash(document),
                "model_version": settings.embedding_model,
            },
        )
        count += 1
    session.commit()
    return count


def _embed_source(source_type: str, batch_size: int | None = None) -> int:
    size = batch_size or settings.embedding_batch_size
    engine = create_engine(settings.database_url_sync)
    with Session(engine) as session:
        rows = _rows_missing_embeddings(session, source_type, size)
        if not rows:
            return 0
        documents = [build_document_text(row["text_arabic"], row.get("text_translation")) for row in rows]
        vectors = embed_documents(documents, batch_size=size).tolist()
        return _upsert_embeddings(session, source_type, rows, vectors)


@celery_app.task(name="app.tasks.embeddings.embed_quran")
def embed_quran(batch_size: int | None = None) -> int:
    return _embed_source("quran", batch_size)


@celery_app.task(name="app.tasks.embeddings.embed_hadith")
def embed_hadith(batch_size: int | None = None) -> int:
    return _embed_source("hadith", batch_size)


@celery_app.task(name="app.tasks.embeddings.embed_all")
def embed_all(batch_size: int | None = None) -> dict[str, int]:
    return {
        "quran": embed_quran.run(batch_size),
        "hadith": embed_hadith.run(batch_size),
    }
```

- [ ] **Step 5: Run embedding task tests**

Run: `backend/venv/bin/pytest backend/tests/test_embedding_tasks.py -q`

Expected: PASS.

- [ ] **Step 6: Verify Celery import and a small task run**

Run: `cd backend && ../backend/venv/bin/python -c "from app.celery_app import celery_app; print(celery_app.main)"`

Expected: prints `dalil`.

Run: `cd backend && ../backend/venv/bin/python -c "from app.tasks.embeddings import embed_quran; print(embed_quran.run(1))"`

Expected: prints `0` if all Quran rows are embedded or `1` after embedding one row. If the model download is unavailable, record the network/model error and continue to static checks.

- [ ] **Step 7: Run quality checks for phase**

Run: `backend/venv/bin/ruff check backend/app backend/tests`

Expected: PASS.

Run: `backend/venv/bin/ruff format --check backend/app backend/tests`

Expected: PASS or format then rerun.

- [ ] **Step 8: Commit phase 4**

Run: `git add backend/app/celery_app.py backend/app/tasks/__init__.py backend/app/tasks/embeddings.py backend/tests/test_embedding_tasks.py && git commit -m "feat: add embedding celery worker"`

Expected: commit succeeds.

---

### Task 4: Semantic Search Runtime Verification

**Files:**
- Modify: `backend/app/services/search.py`
- Create: `backend/tests/test_search_service.py`

**Interfaces:**
- Consumes: `semantic_search(db: AsyncSession, query: str, sources: list[str] | None, limit: int, offset: int, min_score: float) -> SearchResponse`.
- Produces: correct source filter booleans and vector parameter serialization for pgvector execution.

- [ ] **Step 1: Write source filtering regression tests**

Create `backend/tests/test_search_service.py`:

```python
from app.services.search import _source_flags, _vector_literal


def test_source_flags_default_searches_quran_and_hadith() -> None:
    assert _source_flags(None) == (True, True)


def test_source_flags_quran_only() -> None:
    assert _source_flags(["quran"]) == (True, False)


def test_source_flags_hadith_collection_only() -> None:
    assert _source_flags(["bukhari"]) == (False, True)


def test_vector_literal_formats_pgvector_value() -> None:
    assert _vector_literal([0.1, -0.2, 0.3]) == "[0.1,-0.2,0.3]"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `backend/venv/bin/pytest backend/tests/test_search_service.py -q`

Expected: FAIL because `_source_flags` and `_vector_literal` do not exist.

- [ ] **Step 3: Add search helpers and use them**

Edit `backend/app/services/search.py`.

Add constants and helper functions above `semantic_search`:

```python
HADITH_SOURCES = {"bukhari", "muslim", "abudawud", "tirmidhi", "nasai", "ibnmajah", "malik", "nawawi40"}


def _source_flags(sources: list[str] | None) -> tuple[bool, bool]:
    if sources is None:
        return True, True
    source_quran = "quran" in sources
    source_hadith = any(source in HADITH_SOURCES for source in sources)
    return source_quran, source_hadith


def _vector_literal(values: list[float]) -> str:
    return "[" + ",".join(str(float(value)) for value in values) + "]"
```

In `semantic_search`, replace current embedding/source code:

```python
    embedding = embed_query(query)
    embedding_list = embedding.tolist()

    source_quran = sources is None or "quran" in sources
    source_hadith = sources is None or any(s in sources for s in ["bukhari", "muslim", "abudawud", "tirmidhi", "nasai", "ibnmajah", "malik", "nawawi40"])
```

with:

```python
    embedding = embed_query(query)
    embedding_value = _vector_literal(embedding.tolist())
    source_quran, source_hadith = _source_flags(sources)
```

In `params`, replace:

```python
        "embedding": embedding_list,
```

with:

```python
        "embedding": embedding_value,
```

- [ ] **Step 4: Run search helper tests**

Run: `backend/venv/bin/pytest backend/tests/test_search_service.py -q`

Expected: PASS.

- [ ] **Step 5: Run semantic search API smoke tests**

With backend running and at least one embedding row present, run:

```bash
curl -f "http://127.0.0.1:8000/api/v1/search?q=patience&limit=5"
curl -f "http://127.0.0.1:8000/api/v1/search?q=%D8%A7%D9%84%D8%B5%D8%A8%D8%B1&limit=5"
curl -f "http://127.0.0.1:8000/api/v1/search?q=patience&sources=quran&limit=5"
```

Expected: each command exits 0 and returns JSON with `query`, `total`, `results`, `page`, and `pages` fields. If there are no embeddings, generate at least one row by running `cd backend && ../backend/venv/bin/python -c "from app.tasks.embeddings import embed_quran; print(embed_quran.run(1))"`.

- [ ] **Step 6: Run full backend checks**

Run: `backend/venv/bin/pytest backend/tests -q`

Expected: PASS.

Run: `backend/venv/bin/ruff check backend/app backend/tests`

Expected: PASS.

Run: `backend/venv/bin/ruff format --check backend/app backend/tests`

Expected: PASS.

Run: `backend/venv/bin/mypy backend --ignore-missing-imports`

Expected: PASS or report pre-existing mypy issues. Fix issues introduced by this plan.

- [ ] **Step 7: Commit phase 5**

Run: `git add backend/app/services/search.py backend/tests/test_search_service.py && git commit -m "fix: verify semantic search runtime"`

Expected: commit succeeds.

---

## Final Verification

- [ ] Run: `git status --short`
- [ ] Confirm only unrelated pre-existing worktree changes remain.
- [ ] Run: `git log --oneline -5`
- [ ] Confirm commits exist for spec, stats, browse, worker, and search phases.
- [ ] Report any commands that could not be completed, including database, Redis, model download, or mypy failures.

## Self-Review Notes

- Spec coverage: Phase 1+2 is Task 1; Phase 3 is Task 2; Phase 4 is Task 3; Phase 5 is Task 4.
- Placeholder scan: no `TBD`, deferred implementation, or unspecified test steps remain.
- Type consistency: task interfaces consistently use `chapter_id`, `StatsResponse` embedding fields, `celery_app`, and `embed_quran`/`embed_hadith`/`embed_all`.
