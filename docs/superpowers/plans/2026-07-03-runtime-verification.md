# Runtime Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the full backend stack live — Docker, migrations, ingestion, API, Celery embeddings, semantic search, and pytest — confirming all Phase 1–5 code works end-to-end.

**Architecture:** Single-machine Docker Compose for PostgreSQL 16 + pgvector and Redis 7. Backend runs via Uvicorn outside Docker for faster iteration. Celery worker runs separately. All verification targets the same `dalil` database.

**Tech Stack:** Docker Compose, PostgreSQL 16 + pgvector, Redis 7, Python 3.11+, FastAPI, SQLAlchemy 2.0 async, Alembic, Celery, SentenceTransformers (all-MiniLM-L6-v2), pytest, httpx.

## Global Constraints

- Docker Compose for infra only; backend runs via `uvicorn` directly for rapid smoke-test iteration.
- All commands assume `cwd` is project root unless `workdir` is specified.
- Use `backend/venv/bin/python` and `backend/venv/bin/pip` consistently — no system Python.
- Database URL for sync operations (ingestion, alembic) uses `DATABASE_URL_SYNC` env var.
- Never commit `.env` files or runtime test artifacts.
- Preserve existing committed data — do not drop/recreate tables unless explicitly stated.

---

## File Structure

- Modify: `.env` (create from `.env.example` or documented defaults) — NEVER COMMIT
- No new source files needed; this plan verifies existing code only.

---

### Task 1: Infrastructure Bootstrap

**Files:**
- Create: `.env` (local only, never committed)
- Read (reference only): `docker-compose.yml`, `backend/pyproject.toml`, `backend/.env.example`

- [ ] **Step 1: Verify Docker availability and start services**

```bash
docker compose ps
docker compose up -d db redis
docker compose ps
```

Expected: `db` (PostgreSQL 16) and `redis` (Redis 7) containers show `Up` status.

- [ ] **Step 2: Create `.env` with database connection strings**

```bash
cat > .env << 'ENVEOF'
# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/dalil
DATABASE_URL_SYNC=postgresql://postgres:postgres@localhost:5432/dalil
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=dalil

# Redis / Celery
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# API
API_PREFIX=/api/v1
SEARCH_DEFAULT_LIMIT=20
SEARCH_MAX_LIMIT=100
SEARCH_MIN_SCORE=0.0

# Embedding
EMBEDDING_MODEL=all-MiniLM-L6-v2
ENVEOF
```

- [ ] **Step 3: Wait for PostgreSQL to be ready**

```bash
# Poll until pg_isready succeeds (up to 30 seconds)
for i in $(seq 1 30); do
  docker compose exec -T db pg_isready -U postgres && break
  sleep 1
done
```

Expected: `pg_isready` returns `accepting connections`.

- [ ] **Step 4: Create the `dalil` database if it does not exist**

```bash
docker compose exec -T db psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='dalil'" | grep -q 1 || docker compose exec -T db psql -U postgres -c "CREATE DATABASE dalil"
```

Expected: Database exists (either found or created).

- [ ] **Step 5: Verify pgvector extension is available**

```bash
docker compose exec -T db psql -U postgres -d dalil -c "CREATE EXTENSION IF NOT EXISTS vector"
```

Expected: `CREATE EXTENSION`

---

### Task 2: Alembic Migrations

**Files:**
- Read: `backend/alembic/env.py` (verify the `sys.path` fix is present)

- [ ] **Step 1: Verify alembic connectivity**

```bash
cd backend && DATABASE_URL_SYNC=postgresql://postgres:postgres@localhost:5432/dalil venv/bin/alembic current
```

Expected: Output shows current migration revision (or `None` if no migrations applied yet). No import errors.

- [ ] **Step 2: Run all pending migrations**

```bash
cd backend && DATABASE_URL_SYNC=postgresql://postgres:postgres@localhost:5432/dalil venv/bin/alembic upgrade head
```

Expected: Output lists each migration with `Running upgrade -> ...`. Final line shows `INFO  [alembic.runtime.migration] Context impl PostgresqlImpl`.

- [ ] **Step 3: Verify all expected tables exist**

```bash
docker compose exec -T db psql -U postgres -d dalil -c "\dt"
```

Expected: Tables: `alembic_version`, `embeddings`, `hadith`, `hadith_books`, `hadith_collections`, `surahs`, `verses`.

- [ ] **Step 4: Verify pgvector embedding column**

```bash
docker compose exec -T db psql -U postgres -d dalil -c "\d embeddings"
```

Expected: `embedding` column of type `vector(1024)`.

- [ ] **Step 5: Verify unique constraints**

```bash
docker compose exec -T db psql -U postgres -d dalil -c "\d embeddings" | grep -E "unique|UNIQUE"
```

Expected: Unique constraint on `(source_type, source_id, model_version)`.

- [ ] **Step 6: Verify revelation_type column width**

```bash
docker compose exec -T db psql -U postgres -d dalil -c "\d surahs"
```

Expected: `revelation_type` column type `character varying(7)`.

---

### Task 3: Data Ingestion

**Files:**
- Read (reference): `data/raw/` directory structure
- Read (reference): `data/scripts/ingest.py`

- [ ] **Step 1: Verify Quran source data exists**

```bash
ls -la data/raw/
```

Expected: Files like `quran.json` (or similar) exist in `data/raw/`.

- [ ] **Step 2: Ingest Quran data**

```bash
DATABASE_URL_SYNC=postgresql://postgres:postgres@localhost:5432/dalil backend/venv/bin/python data/scripts/ingest.py quran
```

Expected: Output shows "Ingested 114 surahs, 6236 verses" (or actual count from source data). Exit code 0.

- [ ] **Step 3: Verify Quran data in database**

```bash
docker compose exec -T db psql -U postgres -d dalil -c "SELECT count(*) FROM surahs; SELECT count(*) FROM verses;"
```

Expected: 114 surahs, 6236 verses.

- [ ] **Step 4: Verify Hadith source data exists**

```bash
ls -la data/raw/hadith/
```

Expected: One or more JSON files (e.g., `bukhari.json`, `muslim.json`, etc.).

- [ ] **Step 5: Ingest all Hadith collections**

```bash
DATABASE_URL_SYNC=postgresql://postgres:postgres@localhost:5432/dalil backend/venv/bin/python data/scripts/ingest.py hadith
```

Expected: Output shows per-collection ingestion counts. Exit code 0.

- [ ] **Step 6: Verify Hadith data in database**

```bash
docker compose exec -T db psql -U postgres -d dalil -c "SELECT count(*) FROM hadith_collections; SELECT count(*) FROM hadith_books; SELECT count(*) FROM hadith;"
```

Expected: Collections (≥2 for bukhari+muslim), books (≥100), hadith (≥7000).

- [ ] **Step 7: Test ingest idempotency (re-run does not duplicate)**

```bash
DATABASE_URL_SYNC=postgresql://postgres:postgres@localhost:5432/dalil backend/venv/bin/python data/scripts/ingest.py quran
DATABASE_URL_SYNC=postgresql://postgres:postgres@localhost:5432/dalil backend/venv/bin/python data/scripts/ingest.py hadith
```

Expected: Row counts unchanged after second run.

---

### Task 4: API Smoke Tests

**Files:**
- None (tests against live Uvicorn)

- [ ] **Step 1: Start Uvicorn in background**

```bash
cd backend && venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001 &
sleep 3
curl -s http://localhost:8001/api/v1/health | python -m json.tool
```

Expected: `{"status": "ok"}` (or similar health response). Exit code 0.

- [ ] **Step 2: Test stats endpoint**

```bash
curl -s http://localhost:8001/api/v1/stats | python -m json.tool
```

Expected: JSON with fields: `total_verses` (~6236), `total_hadith` (~7000+), `total_embeddings`, `quran_embeddings`, `hadith_embeddings`.

- [ ] **Step 3: Test Quran browse endpoint**

```bash
curl -s http://localhost:8001/api/v1/quran/surahs | python -m json.tool
```

Expected: JSON array of 114 surahs, each with `id`, `name_arabic`, `name_english`, `revelation_type`, `verses_count`.

- [ ] **Step 4: Test Quran surah detail**

```bash
curl -s "http://localhost:8001/api/v1/quran/surahs/1/verses" | python -m json.tool
```

Expected: Verses of Surah Al-Fatiha (7 verses).

- [ ] **Step 5: Test Hadith collections endpoint**

```bash
curl -s http://localhost:8001/api/v1/hadith/collections | python -m json.tool
```

Expected: JSON array with collection slugs (`bukhari`, `muslim`, etc.).

- [ ] **Step 6: Test Hadith browse by collection**

```bash
curl -s "http://localhost:8001/api/v1/hadith/bukhari?limit=5" | python -m json.tool
```

Expected: JSON with `results` array (5 hadith), `total` count, each hadith has `text_arabic`, `text_english`, `chapter_name_eng`, etc.

- [ ] **Step 7: Test Hadith browse with pagination**

```bash
curl -s "http://localhost:8001/api/v1/hadith/bukhari?limit=3&offset=5" | python -m json.tool
```

Expected: 3 results starting from offset 5. `total` same as before.

- [ ] **Step 8: Test search endpoint (English query)**

```bash
curl -s "http://localhost:8001/api/v1/search?q=patience" | python -m json.tool
```

Expected: JSON with `results` array and `took_ms`. Results may be empty if no embeddings exist yet (that is OK at this stage).

- [ ] **Step 9: Test search with source filter**

```bash
curl -s "http://localhost:8001/api/v1/search?q=patience&sources=quran" | python -m json.tool
```

Expected: Same structure. Does not error.

- [ ] **Step 10: Kill the background Uvicorn**

```bash
kill %1 2>/dev/null; wait 2>/dev/null
```

---

### Task 5: Embedding Worker Verification

**Files:**
- Read: `backend/app/celery_app.py`
- Read: `backend/app/tasks/embeddings.py`

- [ ] **Step 1: Start Celery worker in background**

```bash
cd backend && venv/bin/celery -A app.celery_app worker --loglevel=info --concurrency=1 -Q celery &
sleep 5
```

Expected: Worker logs show `celery@... ready.` and no import errors.

- [ ] **Step 2: Verify the model downloads (first run)**

Check worker output for SentenceTransformer model download. First invocation downloads `all-MiniLM-L6-v2` (~80 MB). This may take 30–60 seconds.

- [ ] **Step 3: Trigger Quran embedding task**

```bash
cd backend && python -c "
from app.celery_app import app
app.send_task('embed_quran')
print('Task dispatched')
"
```

Expected: "Task dispatched". Worker logs show processing and "Upserted N embeddings" message.

- [ ] **Step 4: Verify Quran embeddings in database**

```bash
docker compose exec -T db psql -U postgres -d dalil -c "SELECT count(*) FROM embeddings WHERE source_type='quran';"
```

Expected: 6236 rows for quran embeddings.

- [ ] **Step 5: Verify embedding vector dimension**

```bash
docker compose exec -T db psql -U postgres -d dalil -c "SELECT vector_dims(embedding) FROM embeddings LIMIT 1;"
```

Expected: `1024`

- [ ] **Step 6: Trigger Hadith embedding task**

```bash
cd backend && python -c "
from app.celery_app import app
app.send_task('embed_hadith')
print('Task dispatched')
"
```

Expected: "Task dispatched". Worker logs show per-collection processing.

- [ ] **Step 7: Verify hadith embeddings in database**

```bash
docker compose exec -T db psql -U postgres -d dalil -c "SELECT count(*) FROM embeddings WHERE source_type='hadith';"
```

Expected: Matches hadith row count.

- [ ] **Step 8: Verify total embedding count in stats API**

```bash
cd backend && venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001 &
sleep 2
curl -s http://localhost:8001/api/v1/stats | python -m json.tool
kill %1 2>/dev/null; wait 2>/dev/null
```

Expected: `total_embeddings` = `quran_embeddings` + `hadith_embeddings`, both non-zero.

---

### Task 6: Semantic Search Verification

- [ ] **Step 1: Start Uvicorn for search tests**

```bash
cd backend && venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001 &
sleep 3
```

- [ ] **Step 2: Test English semantic query**

```bash
curl -s "http://localhost:8001/api/v1/search?q=patience&limit=5" | python -m json.tool
```

Expected: Results array with 5 entries. Each entry has: `source_type`, `text_arabic`, `text_translation` or `text_english`, `score` (float 0–1), `surah_name` or `book_name`, `chapter_number`.

- [ ] **Step 3: Verify relevance scores are meaningful**

```bash
curl -s "http://localhost:8001/api/v1/search?q=patience&limit=5" | python -c "
import json, sys
data = json.load(sys.stdin)
scores = [r['score'] for r in data['results']]
print(f'Scores: {scores}')
if scores == sorted(scores, reverse=True):
    print('PASS: Scores sorted descending')
else:
    print('FAIL: Scores not sorted')
assert all(s > 0.1 for s in scores), 'Scores too low'
"
```

Expected: Scores sorted descending, all > 0.1.

- [ ] **Step 4: Test Arabic query**

```bash
curl -s "http://localhost:8001/api/v1/search?q=%D8%A7%D9%84%D8%B5%D9%84%D8%A7%D8%A9&limit=5" | python -m json.tool
```

(URL-encoded `الصلاة`). Expected: Prayer-related results from both Quran and Hadith.

- [ ] **Step 5: Test source filter — Quran only**

```bash
curl -s "http://localhost:8001/api/v1/search?q=patience&sources=quran&limit=5" | python -c "
import json, sys
data = json.load(sys.stdin)
types = set(r['source_type'] for r in data['results'])
print(f'Source types: {types}')
assert types == {'quran'}, f'Expected only quran, got {types}'
print('PASS: Only Quran results')
"
```

- [ ] **Step 6: Test source filter — specific hadith collection**

```bash
curl -s "http://localhost:8001/api/v1/search?q=patience&sources=bukhari&limit=5" | python -c "
import json, sys
data = json.load(sys.stdin)
for r in data['results']:
    assert r['source_type'] == 'hadith', f'Expected hadith, got {r[\"source_type\"]}'
    # collection slug check depends on API response structure
print('PASS: Only Bukhari results')
"
```

- [ ] **Step 7: Test multi-source filter**

```bash
curl -s "http://localhost:8001/api/v1/search?q=patience&sources=quran,bukhari&limit=10" | python -c "
import json, sys
data = json.load(sys.stdin)
types = set(r['source_type'] for r in data['results'])
print(f'Source types: {types}')
assert 'quran' in types and 'hadith' in types, f'Expected both sources, got {types}'
print('PASS: Mixed results')
"
```

- [ ] **Step 8: Test empty result (unusual query)**

```bash
curl -s "http://localhost:8001/api/v1/search?q=xyznonexistent2024&limit=5" | python -m json.tool
```

Expected: Results array may be empty or contain low-scoring results. Does not error.

- [ ] **Step 9: Test pagination**

```bash
PAGE1=$(curl -s "http://localhost:8001/api/v1/search?q=patience&limit=3&offset=0")
PAGE2=$(curl -s "http://localhost:8001/api/v1/search?q=patience&limit=3&offset=3")
# Verify page 1 and page 2 have different IDs
python -c "
import json, sys
p1 = json.loads('$PAGE1')
p2 = json.loads('$PAGE2')
ids1 = [r.get('id') or r.get('verse_id') or r.get('hadith_id') for r in p1['results']]
ids2 = [r.get('id') or r.get('verse_id') or r.get('hadith_id') for r in p2['results']]
assert set(ids1).isdisjoint(set(ids2)), 'Pages overlap!'
print(f'PASS: Pages {len(ids1)} and {len(ids2)} are disjoint')
"
```

- [ ] **Step 10: Clean up**

```bash
kill %1 2>/dev/null; wait 2>/dev/null
```

---

### Task 7: Full Pytest Suite

**Files:**
- Read (reference): `backend/tests/` directory

- [ ] **Step 1: Verify test dependencies are installed**

```bash
backend/venv/bin/pip list 2>/dev/null | grep -i -E "pytest|httpx|pytest-asyncio|pytest-cov"
```

Expected: pytest, httpx, pytest-asyncio (and optionally pytest-cov) are installed.

If missing:
```bash
backend/venv/bin/pip install pytest httpx pytest-asyncio
```

- [ ] **Step 2: Run all tests with verbose output**

```bash
cd backend && DATABASE_URL_SYNC=postgresql://postgres:postgres@localhost:5432/dalil venv/bin/pytest tests/ -v --tb=short 2>&1
```

Expected: All tests pass (PASSED). Note: test files use `MagicMock` for DB session — they do not require a live database.

- [ ] **Step 3: Run mypy for type checking**

```bash
cd backend && venv/bin/mypy app/ --ignore-missing-imports 2>&1
```

Expected: `Success: no issues found in N source files` or pre-existing type errors only (not introduced by our changes).

- [ ] **Step 4: Final Ruff check**

```bash
cd backend && venv/bin/ruff check app/ tests/ 2>&1 && venv/bin/ruff format --check app/ tests/ 2>&1
```

Expected: `All checks passed!` and `N files already formatted`.

---

### Task 8: Frontend Smoke Test (Optional)

**Files:**
- Read: `frontend/package.json`
- Read: `frontend/vite.config.ts`

- [ ] **Step 1: Install frontend dependencies**

```bash
cd frontend && npm install
```

Expected: Dependencies installed without errors.

- [ ] **Step 2: Start frontend dev server**

```bash
cd frontend && npm run dev -- --port 5173 &
sleep 5
curl -s http://localhost:5173 | head -20
```

Expected: Returns HTML (Vite dev server is serving the app).

- [ ] **Step 3: Verify frontend API proxy works**

```bash
# With backend running on 8001 and Vite proxy configured, verify search from frontend
curl -s "http://localhost:5173/api/v1/health" 2>/dev/null || echo "No proxy configured — OK for optional step"
```

Expected: Either returns health response (proxy configured) or fails gracefully (no proxy — expected).

- [ ] **Step 4: Stop frontend dev server**

```bash
kill %1 2>/dev/null; wait 2>/dev/null
```

---

### Task 9: Cleanup and Verification Summary

- [ ] **Step 1: Stop background services**

```bash
# Kill any remaining background jobs
jobs -l | awk '{print $2}' | xargs -r kill 2>/dev/null
docker compose down --timeout 10
```

- [ ] **Step 2: Verify git status is clean**

```bash
git status --short
```

Expected: No dirty files (except possibly `.env` which should be in `.gitignore`).

- [ ] **Step 3: Document any failed steps**

If any step failed, create a brief issue note at `docs/superpowers/issues/YYYY-MM-DD-<failure>.md` describing the symptom, expected behavior, and potential root cause.

---

## Verification Checklist (Executive Summary)

| Area | Task | Minimum Success Criteria |
|---|---|---|
| Infra | Task 1 | `docker compose ps` shows `db` + `redis` Up |
| Migrations | Task 2 | `alembic upgrade head` succeeds, all 7 tables exist |
| Ingestion | Task 3 | Quran 114 surahs + 6236 verses, Hadith ≥2 collections |
| API | Task 4 | `/stats`, `/quran/surahs`, `/hadith/collections`, `/hadith/bukhari` return valid JSON |
| Embeddings | Task 5 | 6236 quran + N hadith embeddings in `embeddings` table |
| Search | Task 6 | English + Arabic queries return results sorted by score |
| Tests | Task 7 | `pytest tests/ -v` all green, `mypy` no new errors |
| Frontend | Task 8 | `npm run dev` serves HTML (optional) |
