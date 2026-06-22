# Runtime, Ingestion, and Semantic Search Stabilization Design

## Goal

Stabilize the local backend runtime from database migration through ingestion, browse APIs, embedding generation, and semantic search verification. Work proceeds in small committed phases so each milestone can be tested and rolled back independently.

## Current Context

The backend already includes FastAPI routers, SQLAlchemy models, an Alembic initial schema, an ingestion script, an embedding service, and a pgvector search service. Docker Compose includes PostgreSQL with pgvector, Redis, the backend, frontend, and a Celery worker command.

Observed blockers:

- `docker-compose.yml` expects `app.celery_app`, but no Celery app module exists yet.
- `backend/app/api/hadith.py` filters on `Hadith.book_id`, but the model and ingestion use `chapter_id`.
- Hadith browse responses access `h.book`, which may trigger async lazy-loading problems unless the relationship is eagerly loaded or avoided.
- `/api/v1/stats` counts text data but not embedding coverage.
- Semantic search depends on populated `embeddings` rows and may need runtime fixes after real pgvector execution.

## Execution Approach

Use phase-gated implementation with a commit after each phase:

1. Phase 1 + 2: migration, ingestion, and stats endpoint.
2. Phase 3: browse endpoint runtime fixes.
3. Phase 4: embedding worker.
4. Phase 5: semantic search full test and runtime fixes.

This approach keeps each change set focused and makes failures easier to isolate.

## Phase 1 + 2 Design: Migration, Ingestion, Stats

The schema should remain aligned with the existing ingestion script and models instead of introducing a second naming scheme. `hadith.chapter_id` remains the field that links a hadith row to a hadith book entry by `hadith_books.book_number` within the same collection.

The migration path must be safe for local development. If the initial migration is not applied, `alembic upgrade head` should create all required tables and pgvector index. If the database already exists locally, fixes should be added as forward migrations instead of editing live tables manually.

The ingestion script remains the source loader for Quran and Hadith raw JSON. It should be idempotent and keep `ON CONFLICT` behavior so reruns refresh text without duplicating records.

The stats endpoint should report corpus counts and embedding coverage. The minimal useful response is total surahs, verses, hadith, collections, embeddings, and model metadata.

Verification:

- Run Alembic upgrade against local PostgreSQL.
- Run Quran and Hadith ingestion.
- Call health and stats endpoints.
- Confirm expected non-zero counts and no migration/runtime exceptions.

## Phase 3 Design: Browse Runtime Fixes

Browse endpoints should use the schema that exists today. Hadith list filtering should use `chapter_id` or expose it as a chapter/book-number filter without referencing `Hadith.book_id`.

Hadith list and detail responses should avoid async lazy-loading failures. The preferred minimal fix is to use `selectinload` where relationship data is needed, or join/select the book name explicitly if eager loading is not compatible with the view-only relationship.

Verification:

- `/api/v1/quran/surahs`
- `/api/v1/quran/{surah_number}`
- `/api/v1/quran/{surah_number}/{verse_number}`
- `/api/v1/hadith/collections`
- `/api/v1/hadith/{collection_slug}`
- `/api/v1/hadith/{collection_slug}/{hadith_id}`

## Phase 4 Design: Embedding Worker

Add a backend Celery app module matching the existing Compose command: `app.celery_app`. The worker should use Redis broker/result backend from settings.

Embedding tasks should generate rows for Quran and Hadith sources using the existing `embed_documents` function. Each task reads source rows in batches, builds document text with the E5 `passage:` behavior already handled by the embedding service, computes `text_hash`, and upserts into `embeddings`.

Tasks should skip rows whose current hash already exists for the same source and model version. This keeps reruns idempotent and allows future text changes to regenerate embeddings.

Task interface:

- `embed_quran(batch_size: int | None = None)`
- `embed_hadith(batch_size: int | None = None)`
- `embed_all(batch_size: int | None = None)`

Verification:

- Import `app.celery_app` successfully.
- Run at least a small embedding batch locally.
- Confirm `embeddings` count increases and hashes/model version are stored.

## Phase 5 Design: Semantic Search Full Test

Semantic search should run against real embeddings in PostgreSQL. Fixes should be limited to runtime issues found during execution, such as vector parameter casting, SQL result shape mismatches, source filtering, or pagination totals.

The existing search behavior remains: embed query with E5 query prefix, search pgvector cosine distance, join Quran/Hadith records, return `SearchResponse`.

Verification:

- Run semantic search with an English query such as `patience`.
- Run semantic search with an Arabic query.
- Verify source filtering for Quran-only and Hadith-capable searches.
- Run project lint/type checks where feasible in the local environment.

## Non-Goals

- No frontend redesign.
- No production deployment changes.
- No alternate embedding model selection.
- No broad schema redesign beyond fixes required for runtime correctness.
- No manual table edits outside Alembic migrations.

## Commit Strategy

Each phase gets a separate commit:

1. `fix: stabilize ingestion stats and migrations`
2. `fix: repair browse endpoint runtime issues`
3. `feat: add embedding celery worker`
4. `fix: verify semantic search runtime`

Commit messages may be adjusted based on the exact changes discovered during implementation.
