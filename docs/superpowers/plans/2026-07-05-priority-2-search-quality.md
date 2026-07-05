# Priority 2 Search Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add measurable search evaluation, enrich hadith metadata ingestion, expand backend tests, and run backend tests in CI.

**Architecture:** Keep changes minimal and aligned with existing project layout. Add evaluation utilities under `data/eval/`, keep ingestion changes in `data/scripts/ingest.py`, extend existing backend pytest coverage, and add a CI test job without redesigning the pipeline.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy, pytest, GitHub Actions, PostgreSQL/pgvector.

---

## Files

- Create: `data/eval/ground_truth.json` with representative search queries.
- Create: `data/eval/evaluate.py` with metric helpers and CLI runner.
- Create: `data/eval/__init__.py` so metric helpers are importable.
- Create: `backend/tests/test_eval_metrics.py` for evaluation helper tests.
- Modify: `data/scripts/ingest.py` to extract hadith book metadata and upsert `hadith_books`.
- Create: `backend/tests/test_ingest_hadith_books.py` for ingestion helper tests.
- Modify: `backend/tests/test_search_service.py` to cover vector-level source filtering and collection candidate oversampling.
- Modify: `.github/workflows/ci.yml` to add backend tests.

---

### Task 1: Evaluation Dataset And Metrics Runner

**Files:**
- Create: `data/eval/__init__.py`
- Create: `data/eval/ground_truth.json`
- Create: `data/eval/evaluate.py`
- Test: `backend/tests/test_eval_metrics.py`

- [ ] Write failing tests for `normalize_result_id`, `recall_at_k`, and `mrr_at_k`.
- [ ] Run `backend/venv/bin/pytest backend/tests/test_eval_metrics.py -q`; expect import failure for `data.eval.evaluate`.
- [ ] Implement metric helpers and a CLI skeleton in `data/eval/evaluate.py`.
- [ ] Add `ground_truth.json` with Quran and hadith examples.
- [ ] Re-run `backend/venv/bin/pytest backend/tests/test_eval_metrics.py -q`; expect pass.

### Task 2: Hadith Book Metadata Ingestion

**Files:**
- Modify: `data/scripts/ingest.py`
- Test: `backend/tests/test_ingest_hadith_books.py`

- [ ] Write failing tests for detecting a book number/name from representative hadith rows.
- [ ] Run `backend/venv/bin/pytest backend/tests/test_ingest_hadith_books.py -q`; expect import/attribute failure.
- [ ] Add helper functions for book metadata extraction and batch upsert SQL for `hadith_books`.
- [ ] Wire helpers into `ingest_hadith` while preserving idempotency and NULL behavior for missing metadata.
- [ ] Re-run `backend/venv/bin/pytest backend/tests/test_ingest_hadith_books.py -q`; expect pass.

### Task 3: Search Service Regression Tests

**Files:**
- Modify: `backend/tests/test_search_service.py`

- [ ] Add failing tests asserting `SEARCH_QUERY` filters source type inside `vector_results`.
- [ ] Add failing tests for collection-specific candidate limit calculation.
- [ ] Run `backend/venv/bin/pytest backend/tests/test_search_service.py -q`; expect failures for any missing helper/SQL assertion.
- [ ] Extract or expose the candidate limit calculation if needed without changing runtime behavior.
- [ ] Re-run `backend/venv/bin/pytest backend/tests/test_search_service.py -q`; expect pass.

### Task 4: CI Backend Tests

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] Update CI to add a `backend-test` job using Python 3.11.
- [ ] Install backend requirements and run `pytest` in `backend`.
- [ ] Keep existing lint/type/frontend jobs unchanged unless necessary.
- [ ] Validate YAML structure by reading the workflow and running local backend tests.

### Task 5: Verification

**Commands:**
- Run: `backend/venv/bin/pytest backend/tests/test_eval_metrics.py backend/tests/test_ingest_hadith_books.py backend/tests/test_search_service.py -q`
- Run if available: `backend/venv/bin/ruff check backend data/scripts data/eval`

**Expected:** all targeted tests pass; lint either passes or reports pre-existing issues clearly.
