# Priority 2 Search Quality Design

## Goal

Implement the Priority 2 work in the order that improves search quality first: add measurable evaluation, enrich hadith metadata, cover critical API behavior with integration tests, and make CI run the same checks expected locally.

## Scope

This work covers four deliverables:

- A small ground-truth evaluation dataset and runner for semantic search quality.
- Hadith ingestion improvements that populate `hadith_books` and persist stable `chapter_id` metadata where raw data exposes it.
- Backend integration tests for search and browse behavior that previously regressed.
- CI updates that include backend tests alongside existing lint/type/frontend checks.

This work does not migrate embedding models, implement hybrid search, add Redis caching, or redesign the frontend.

## Architecture

The evaluation layer will live under `data/eval/` and call the existing search service/API shape rather than introducing a parallel retrieval implementation. It will report simple metrics first: `Recall@K`, `MRR@K`, per-query hit status, and latency from the response when available.

The ingestion layer will stay in `data/scripts/ingest.py`. It will infer hadith book/chapter metadata from the existing Hadith-ID JSON structure without changing table schemas. `hadith_books` remains the canonical lookup for collection/book metadata, and `hadith.chapter_id` will align with `hadith_books.book_number` so the existing search JOIN can populate `book_name`.

Backend tests will follow the current `backend/tests/` style. Where full database integration is too expensive, tests should verify SQL/query construction and FastAPI route behavior with light fixtures. CI will run those tests after installing backend dependencies.

## Data Flow

Evaluation flow:

1. Load `data/eval/ground_truth.json`.
2. For each query, execute search with a fixed `limit`.
3. Normalize returned result IDs into stable strings such as `quran:2:153` or `hadith:bukhari:7563`.
4. Compare returned IDs against the relevant set.
5. Print aggregate metrics and per-query misses.

Hadith ingestion flow:

1. Load each raw hadith JSON file.
2. Extract collection metadata from existing constants.
3. Detect book/chapter fields when present in the raw item.
4. Upsert `hadith_books` per `(collection_id, book_number)`.
5. Upsert `hadith` rows with `chapter_id` set to the detected book number when available.
6. Preserve idempotency through existing conflict handling.

## Error Handling

Evaluation should fail with a clear message when the ground-truth file is missing, invalid, or has unsupported IDs. Search/API failures should mark the specific query as failed and return a non-zero exit status at the end.

Ingestion should keep current skip behavior for missing files. If a raw hadith item lacks book/chapter metadata, ingestion should insert the hadith with `chapter_id = NULL` rather than inventing metadata.

## Testing

Tests should cover:

- Evaluation metric functions independent of the database.
- Stable result ID normalization for Quran and hadith results.
- Hadith book metadata extraction from representative raw JSON shapes.
- Search source filtering and collection filtering behavior added in Priority 1.
- CI includes backend tests and keeps existing lint/type/frontend jobs.

## Acceptance Criteria

- `data/eval/ground_truth.json` exists with representative Quran and hadith queries.
- An evaluation command can run locally and prints `Recall@K` and `MRR@K`.
- Re-running `python data/scripts/ingest.py hadith` is idempotent and populates `hadith_books` when raw metadata exists.
- Search results can include `book_name` for hadith rows with populated metadata.
- Backend tests include integration or route-level coverage for search behavior.
- GitHub Actions runs backend tests in CI.

## Self-Review

- No placeholder requirements remain.
- Scope is limited to Priority 2 and excludes larger Priority 3 work.
- The design preserves existing schema and patterns.
- Acceptance criteria are verifiable with local commands and CI.
