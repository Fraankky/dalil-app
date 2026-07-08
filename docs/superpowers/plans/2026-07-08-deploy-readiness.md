# Deployment Readiness: Security, Bug Fix & Prod Deploy Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Dalil app (semantic search for Qur'an + Hadith) for first production deployment — close security holes, fix bugs, squash migrations, build prod images, and wire deploy config. Target: frontend on Cloudflare Pages, backend + Postgres + Redis on a single VPS via Docker Compose prod + nginx + Certbot HTTPS.

**Architecture:** Backend stays FastAPI + SQLAlchemy async + pgvector + Celery + Redis. Frontend stays Vite + React 18 + TanStack Router + React Query. No auth (public MVP — rate-limit only). Migrations squashed into one baseline (fresh DB, re-ingest from `data/raw/`). Prod serves Vite `dist/` from Cloudflare Pages with `/api` rewrite to the VPS backend domain.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.0 async, Alembic, Celery, pgvector, gunicorn + uvicorn workers; React 18, TypeScript 5, Vite 5, TanStack Router/Query, Tailwind 3; Docker Compose prod, nginx, Certbot; Cloudflare Pages.

---

## Scope

In scope:
- Backend security hardening (config, CORS, error handling, DB SSL/pool, rate limits, Celery limits, search DoS caps, embedding model load safety).
- Squash Alembic migration history into one baseline migration; guard destructive operations.
- Prod Dockerfile (multi-stage, non-root, gunicorn, healthcheck, entrypoint runs migrations).
- Prod `docker-compose.prod.yml` with nginx + Certbot; internal-only DB/Redis; restart policies; healthchecks; resource limits.
- Cloudflare Pages config (`public/_redirects` rewrite `/api` → VPS backend domain).
- Frontend resilience (ErrorBoundary, QueryClient defaults, fetch timeout, router-correct pagination, `<Link>` over `<a href>`).
- Dependency cleanup (remove unused, pin/lock, move devtools to devDeps).
- Update `.env.example` to match active model (384-dim MiniLM).
- Update docs (TECH/CODEBASE_ANALYSIS) with the prod deploy topology + secrets + backup plan.

Out of scope:
- Authentication / user accounts (explicitly public MVP).
- Real tafsir/syarah data ingestion (existing placeholder behavior preserved).
- PWA, SEO, offline, bookmarks.
- Multi-region deploy, autoscaling, managed DB migration.
- Switching embedding model away from `paraphrase-multilingual-MiniLM-L12-v2` (384-dim).

## Files

**Modify:**
- `backend/app/core/config.py` — debug default false, env validator, cors strip, extra forbid.
- `backend/app/main.py` — safe 500 handler, docs disabled in prod, CORS tightening, SlowAPIMiddleware, X-Forwarded-For limiter, `/healthz` root route.
- `backend/app/core/database.py` — pool_pre_ping, pool_recycle, statement_timeout, prod SSL connect_args.
- `backend/app/core/limiter.py` — proxy-aware key func, default limits.
- `backend/app/celery_app.py` — time limits, soft limits, max tasks per child, acks_late, result_expires.
- `backend/app/tasks/embeddings.py` — batch_size clamp, model-load error handling, get_running_loop.
- `backend/app/api/search.py` — offset cap, q max_length, candidate_limit ceiling.
- `backend/app/api/meta.py` — `/ready` endpoint checking DB + Redis.
- `backend/app/services/embedding.py` — safe model load with health flag, `q.strip()`.
- `backend/alembic/versions/0001_initial_schema.py` — becomes the single squashed baseline (384-dim, current final shape).
- `backend/.env.example` — align to 384-dim MiniLM model.
- `backend/alembic.ini` — empty `sqlalchemy.url`.
- `backend/requirements.txt` / `backend/pyproject.toml` — remove unused, add gunicorn.
- `backend/Dockerfile` — keep as dev. (Prod image is a new file.)
- `docker-compose.yml` — dev hardening (loopback ports, networks, restart, healthcheck).
- `frontend/src/main.tsx` — ErrorBoundary + QueryClient defaults.
- `frontend/src/lib/api.ts` — AbortSignal timeout, generic errors, Content-Type guard.
- `frontend/src/routes/search.tsx` — useQuery conversion, dir rtl, aria-label.
- `frontend/src/routes/quran.$surahId.tsx` — validateSearch page, useSearch, `<Link>` pagination.
- `frontend/src/routes/hadith.$slug.tsx` — validateSearch page, useSearch, `<Link>` pagination.
- `frontend/src/routes/quran.$surahId.$verseNumber.tsx` — `<Link>` prev/next.
- `frontend/src/routes/hadith.$slug.$hadithId.tsx` — `<Link>` prev/next.
- `frontend/src/components/Pagination.tsx` — render `<Link>` (or disabled button) instead of `<a href>`.
- `frontend/package.json` — move `@tanstack/router-devtools` to devDependencies.
- `frontend/tsconfig.json` — noUnusedLocals/Parameters true.
- `frontend/biome.json` — noExplicitAny error.
- `frontend/index.html` — input aria-label, lang per content.
- `docs/TECH.md` — prod deploy topology section.
- `docs/CODEBASE_ANALYSIS.md` — mark resolved issues, add prod checklist.

**Create:**
- `backend/Dockerfile.prod` — multi-stage prod image.
- `backend/.dockerignore` — exclude dev artifacts from image context.
- `backend/entrypoint.sh` — run migrations then exec gunicorn.
- `deploy/docker-compose.prod.yml` — prod stack (backend, celery, db, redis, nginx, certbot).
- `deploy/nginx/nginx.conf` — main nginx config.
- `deploy/nginx/conf.d/dalil.conf` — server block reverse proxy + TLS + security headers.
- `deploy/init-letsencrypt.sh` — first-time TLS bootstrap.
- `deploy/.env.prod.example` — prod env template (secrets + DOMAIN + backend URL).
- `deploy/README.md` — step-by-step first deploy runbook.
- `frontend/public/_redirects` — Cloudflare Pages rewrite `/api/(.*) → backend`.
- `frontend/Dockerfile.prod` — optional static-serve image (nginx) for non-Cloudflare hosting.
- `docs/superpowers/plans/2026-07-08-deploy-readiness.md` — this file.

**Delete (after squash):**
- `backend/alembic/versions/0002_embedding_unique_constraint.py`
- `backend/alembic/versions/0003_increase_model_version_length.py`
- `backend/alembic/versions/0004_change_vector_dim_to_384.py`
- `backend/alembic/versions/0005_indonesian_translations.py`
- `backend/alembic/versions/0006_revert_to_1024_dim.py`
- `backend/alembic/versions/0007_revert_to_384_dim.py`
- `backend/alembic/versions/be79b21cfad0_increase_revelation_type_length.py`

---

## Phase A — Backend Security Hardening

### Task A1: Config — debug default, CORS strip, env validator

**Files:** Modify `backend/app/core/config.py`

- [ ] Change `debug: bool = True` → `debug: bool = False` (safe-by-default; prod env must explicitly set `DEBUG=true` only for staging).
- [ ] Add a Pydantic `model_validator(mode="after")` that raises `ValueError("DEBUG=true not allowed when ENV=production")` if `debug` is True and an `env: str = "development"` field equals `"production"`. Add the new `env` field with default `"development"`.
- [ ] Change `model_config` from `{"env_file": ".env", "extra": "ignore"}` → `{"env_file": ".env", "extra": "forbid"}` so misspelled env vars fail fast instead of being silently dropped.
- [ ] Add a property `cors_origin_list` returning `[o.strip() for o in self.cors_origins.split(",") if o.strip()]` (callers will use this instead of raw split).
- [ ] Add a property `is_prod` returning `self.env == "production"`.
- [ ] Run `ruff check backend/app/core/config.py` and `ruff format --check backend/app/core/config.py`.
- [ ] Expected: exit 0, no diff.

### Task A2: Main — safe 500 handler, docs off in prod, CORS tightening, SlowAPIMiddleware

**Files:** Modify `backend/app/main.py`

- [ ] In the global `exception_handler`, replace `detail=str(exc) if settings.debug else None` with `detail=None` always — never leak exception strings to clients. Log the full exception server-side: `logger.exception("Unhandled error on %s", request.url.path)`.
- [ ] Add a `request_id` field to the 500 response: use `uuid.uuid4().hex[:8]` and include it in both the `ErrorResponse.detail` (as `"ref: <id>"`) and the log line, so operators can correlate without exposing internals.
- [ ] `ErrorResponse` schema: confirm `detail: str | None` already nullable. If not, update `backend/app/models/schemas.py` accordingly.
- [ ] Change FastAPI constructor: `docs_url="/docs" if settings.debug else None`, `redoc_url=None if not settings.debug else "/redoc"`, `openapi_url="/openapi.json" if settings.debug else None`.
- [ ] CORS middleware: use `settings.cors_origin_list` (property from A1) instead of `settings.cors_origins.split(",")`. Change `allow_methods=["*"]` → `["GET"]` and `allow_headers=["*"]` → `["Content-Type", "Accept"]`.
- [ ] Add a startup guard: if `settings.is_prod` and `"*"` in `settings.cors_origin_list`, raise `RuntimeError("CORS wildcard not allowed with allow_credentials=True in production")` — wire into `lifespan` before model load.
- [ ] Import `from slowapi.middleware import SlowAPIMiddleware` and add `app.add_middleware(SlowAPIMiddleware)` after `app.state.limiter = limiter` so the default limits actually apply to all routes.
- [ ] Add a root-level `/healthz` route (liveness, no DB check) and `/readyz` route (delegates to meta readiness logic) mounted WITHOUT the api prefix — so infra probes don't need to know `/api/v1`. Keep `/api/v1/health` for backward compat.
- [ ] Run `ruff check backend/app/main.py` and `ruff format --check backend/app/main.py`.
- [ ] Expected: exit 0.

### Task A3: Limiter — proxy-aware key func

**Files:** Modify `backend/app/core/limiter.py`

- [ ] Define a `proxy_key_func(request: Request) -> str` that reads `request.headers.get("x-forwarded-for", "").split(",")[0].strip()` and falls back to `request.client.host` if absent. Document that this trusts the upstream proxy (nginx sets XFF from the real client).
- [ ] Construct `limiter = Limiter(key_func=proxy_key_func, default_limits=["60/minute"])`.
- [ ] Run `ruff check backend/app/core/limiter.py`.
- [ ] Expected: exit 0.

### Task A4: Database — pool_pre_ping, recycle, statement_timeout, prod SSL

**Files:** Modify `backend/app/core/database.py`

- [ ] Add `pool_pre_ping=True` and `pool_recycle=1800` to `create_async_engine`.
- [ ] Build `connect_args` dict: `{"server_settings": {"statement_timeout": "10000", "idle_in_transaction_session_timeout": "30000"}}`.
- [ ] When `settings.is_prod`, add SSL to the **async** engine (asyncpg ignores URL `?sslmode=`): `connect_args["ssl"] = True` (accepts default SSL context). Do NOT mutate the URL for the async engine. The sync engine (psycopg2, used by alembic + Celery tasks) does honour URL `?sslmode=require`, so append `?sslmode=require` to `settings.database_url_sync` only when `is_prod` and the URL has no `sslmode`. Two engines, two mechanisms — keep them separate, do not unify.
- [ ] Default `pool_size` and `max_overflow` to values from settings (add `db_pool_size: int = 10` and `db_max_overflow: int = 20` to config in A1) so they are env-tunable.
- [ ] Run `ruff check backend/app/core/database.py` and `mypy backend/app/core/database.py --ignore-missing-imports`.
- [ ] Expected: exit 0.

### Task A5: Celery — time limits, acks_late, result expiry

**Files:** Modify `backend/app/celery_app.py`

- [ ] In `celery_app.conf.update(...)` add: `task_time_limit=300`, `task_soft_time_limit=240`, `worker_max_tasks_per_child=100`, `task_acks_late=True`, `result_expires=3600`, `worker_prefetch_multiplier=1` (important so a single heavy batch doesn't grab all slots).
- [ ] Run `ruff check backend/app/celery_app.py`.
- [ ] Expected: exit 0.

### Task A6: Embeddings tasks — batch_size clamp, model-load safety, loop fix

**Files:** Modify `backend/app/tasks/embeddings.py` and `backend/app/services/embedding.py`

- [ ] In `backend/app/services/embedding.py`: the elaborate `_model_load_error` flag + dual-path RuntimeError from the original plan is dead code — if startup model load fails, `lifespan` raises → gunicorn worker exits → container crash-loops; there are no in-flight `embed_query` calls before startup completes. SKIP that scheme. Only keep `_load_model` as-is (fail-fast on first call).
- [ ] Add `q.strip()` guard in `embed_query`: if `not text.strip(): raise ValueError("Empty query")`. (The API min_length=1 currently allows `" "`.)
- [ ] Replace `asyncio.get_event_loop()` with `asyncio.get_running_loop()` in both `embed_query_async` and `embed_documents_async` (Python 3.11+ safe).
- [ ] In `backend/app/tasks/embeddings.py`: define `MAX_BATCH = 256` module constant. In `_embed_source` change `size = batch_size or settings.embedding_batch_size` → `size = min(batch_size or settings.embedding_batch_size, MAX_BATCH)`. This bounds a maliciously-enqueued `embed_quran(batch_size=10_000_000)`.
- [ ] Run `ruff check backend/app/services/embedding.py backend/app/tasks/embeddings.py` and `mypy backend/app/tasks/embeddings.py --ignore-missing-imports`.
- [ ] Expected: exit 0.

### Task A7: Search endpoint — DoS caps

**Files:** Modify `backend/app/api/search.py` and `backend/app/services/search.py`

- [ ] In `backend/app/api/search.py`: change `q: str = Query(..., min_length=1, ...)` → add `max_length=1024`. Change `offset: int = Query(0, ge=0)` → `Query(0, ge=0, le=1000)` (deep semantic-search pages below min_score are useless; 1000 is the single effective gate).
- [ ] In `backend/app/services/search.py`: do NOT add a `MAX_CANDIDATE_LIMIT` ceiling that contradicts `offset le=10000` (capping candidates at 50k while offset can reach 10050 yields empty deep pages). The `offset le=10000` cap (change A7's API `offset` from `ge=0` to `Query(0, ge=0, le=10000)` — wait, reduce to `le=1000`, deep semantic-search pages are useless below min_score anyway) is the single gate; keep `_candidate_limit` as-is. Just align the API `offset` `le=1000` in this task. One gate, not two contradicting ones.
- [ ] Run `ruff check backend/app/api/search.py backend/app/services/search.py` and `mypy backend/app/services/search.py --ignore-missing-imports`.
- [ ] Expected: exit 0.

### Task A8: Health/readiness endpoints

**Files:** Modify `backend/app/api/meta.py`

- [ ] A2 already adds root-level `/healthz` (liveness) and `/readyz` and keeps `/api/v1/health`. Do NOT add a separate `/api/v1/ready` — there are zero external consumers pre-launch, two readiness paths is dead code. Implement the `/readyz` readiness logic HERE in `meta.py` as a function `async def readiness() -> JSONResponse` returning `{"status":"ready","db":<bool>,"redis":<bool>}`, status 200 if both ok else 503: run `SELECT 1` on the async engine and ping Redis via `redis.asyncio.from_url(settings.redis_url).ping()`. A2's `/readyz` route calls this function.
- [ ] Import `from sqlalchemy import text` and `import redis.asyncio` (already a transitive dep via celery[redis]).
- [ ] Run `ruff check backend/app/api/meta.py` and `mypy backend/app/api/meta.py --ignore-missing-imports`.
- [ ] Expected: exit 0.

### Task A9: Phase A verification

- [ ] Run `ruff check backend/` — expected exit 0.
- [ ] Run `ruff format --check backend/` — expected exit 0.
- [ ] Run `mypy backend/ --ignore-missing-imports` — expected exit 0 (or only pre-existing warnings).
- [ ] Run `pytest backend/tests -q` — DB-free tests pass; if any test needs a live DB, mark xfail with a `ponytail:` comment and note in Phase E.
- [ ] Manually `python -c "from app.main import app"` (with `ENV=development DEBUG=false`) imports cleanly — no model load (that's lifespan only).

---

## Phase B — Migrations Squash & Data Safety

### Task B1: Read final migration state

**Files:** Read-only `backend/alembic/versions/0007_revert_to_384_dim.py`, `0006_revert_to_1024_dim.py`, `0005_indonesian_translations.py`, `0003_increase_model_version_length.py`, `be79b21cfad0_increase_revelation_type_length.py`

- [ ] Read `0007` to extract the final `embeddings.embedding` column type (`Vector(384)`), final `model_version` length, final `revelation_type` length, final indexes/HNSW config.
- [ ] Read `0003` for the `model_version` length — it is `String(100)`.
- [ ] Read `be79b21cfad0` for the final `revelation_type` length — it is `String(7)`.
- [ ] Read `0005` — it RENAMES `hadith.text_english`→`text_translation` (no new column added).
- [ ] Record the target final DDL for: `surahs`, `verses`, `hadith_collections`, `hadith_books`, `hadith`, `embeddings` (with unique constraint from `0002`, HNSW index, vector dim 384).
- [ ] Expected: a written note (in commit message / scratchpad) of the final schema.

### Task B2: Rewrite baseline migration as squashed 0001

**Files:** Modify `backend/alembic/versions/0001_initial_schema.py`; delete `0002`-`0007` + stray

- [ ] Rewrite `0001_initial_schema.py` `upgrade()` to create all six tables in their FINAL shape (post-0007 state): `surahs` with `revelation_type` at `String(7)` (from `be79b21cfad0`); `verses`; `hadith_collections`; `hadith_books`; `hadith` with column named `text_translation` (`0005` RENAMES `text_english`→`text_translation`, it does NOT add a new column — create only `text_translation`); `embeddings` with `embedding Vector(384)`, `model_version String(100)` (from `0003`, NOT 255 — read 0003 if unsure), the unique constraint `(source_type, source_id, model_version)` named `uq_embeddings_source_model` from `0002`, and the HNSW cosine index (`m=16, ef_construction=200`).
- [ ] Add `op.execute("CREATE EXTENSION IF NOT EXISTS vector")` at the top of `upgrade()` (already there).
- [ ] `downgrade()` drops all six tables + the vector extension (idempotent `IF EXISTS`).
- [ ] Keep revision `"0001"`, `down_revision = None`. Update the docstring to say "Squashed baseline (0001-0007 + be79b21cfad0)".
- [ ] `git rm` the seven superseded migration files listed in **Delete** above.
- [ ] Verify `backend/alembic/env.py` still imports correctly and `alembic history` shows a single revision `0001 (head)`.
- [ ] Run `cd backend && alembic upgrade head` against a FRESH throwaway Postgres (the dev `docker compose up db` is fine). Expected: tables created, no errors.
- [ ] Run `cd backend && alembic downgrade base` then `alembic upgrade head` again — round-trip clean.
- [ ] Run `alembic history` — expected: a single row `0001 (head)`.

### Task B3: Guard destructive baseline (optional, since data is re-ingestable)

**Files:** `backend/alembic/versions/0001_initial_schema.py`

- [ ] Since this is a fresh-DB baseline (no prod data yet) no guard is needed for `upgrade()`. Add a `ponytail:` comment at the top: `# ponytail: squashed baseline for first prod deploy; data/raw/ is the source of truth, no migration guards needed pre-launch`.
- [ ] No code change beyond the comment. If a prod DB already exists with the old history, document in `deploy/README.md` that the operator must `DROP SCHEMA public CASCADE` + `alembic upgrade head` + re-ingest (since migrations were squashed — no upgrade path from old revisions to the new 0001).

### Task B4: Align `.env.example` to active model

**Files:** Modify `backend/.env.example`

- [ ] Change `EMBEDDING_MODEL=intfloat/multilingual-e5-large-instruct` → `EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`.
- [ ] Change `EMBEDDING_DIM=1024` → `EMBEDDING_DIM=384`.
- [ ] Add `ENV=development` line (new field from A1) with comment `# set to "production" for prod`.
- [ ] Add `CORS_ORIGINS=http://localhost:3000` (already present) — keep.
- [ ] Add commented prod hints at the bottom: `# PROD: set DEBUG=false, ENV=production, strong POSTGRES_PASSWORD, CORS_ORIGINS=https://yourdomain.tld`.
- [ ] Diff against root `.env` — both should now agree on model/dim.

### Task B5: Empty alembic.ini URL

**Files:** Modify `backend/alembic.ini`

- [ ] Change `sqlalchemy.url = postgresql://postgres:postgres@localhost:5432/dalil` → `sqlalchemy.url =` (empty). `alembic/env.py:16` already overrides from `settings.database_url_sync` at runtime, so this removes the secret from the tracked file.
- [ ] Run `cd backend && alembic current` (against the dev DB) — expected: uses `settings.database_url_sync`, prints `0001 (head)`.

### Task B6: Phase B verification

- [ ] Fresh DB: `docker compose down -v && docker compose up -d db redis`, wait healthy.
- [ ] `cd backend && alembic upgrade head` — expected: clean.
- [ ] `python data/scripts/ingest.py` (or `data/scripts/embed_bulk.py`) — re-ingests Quran + Hadith from `data/raw/`. Expected: counts match prior known counts (record in scratchpad).
- [ ] `curl 'http://localhost:8000/api/v1/search?q=sabar' | jq '.total'` — expected > 0.

---

## Phase C — Prod Images & VPS Deploy Config

### Task C1: Backend prod Dockerfile

**Files:** Create `backend/Dockerfile.prod`; Create `backend/.dockerignore`

- [ ] `backend/Dockerfile.prod` (uses a real venv owned by `app`, not `--user` into `/root/.local` which `USER app` cannot read):
  ```
  FROM python:3.11-slim AS builder
  WORKDIR /build
  RUN apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev && rm -rf /var/lib/apt/lists/*
  RUN python -m venv /opt/venv
  ENV PATH=/opt/venv/bin:$PATH
  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt gunicorn>=21.2.0

  FROM python:3.11-slim
  RUN apt-get update && apt-get install -y --no-install-recommends libpq5 curl ca-certificates && rm -rf /var/lib/apt/lists/*
  RUN useradd -m -u 1001 app
  WORKDIR /app
  COPY --from=builder --chown=app:app /opt/venv /opt/venv
  ENV PATH=/opt/venv/bin:$PATH
  COPY --chown=app:app . .
  COPY --chown=app:app entrypoint.sh /entrypoint.sh
  RUN chmod +x /entrypoint.sh
  USER app
  EXPOSE 8000
  HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -fsS http://localhost:8000/healthz || exit 1
  ENTRYPOINT ["/entrypoint.sh"]
  CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", "-w", "2", "--preload", "--proxy-headers", "--forwarded-allow-ips=*", "--access-logfile", "-", "--bind", "0.0.0.0:8000"]
  ```
  Notes: `-w 2 --preload` so the MiniLM model loads once and is COW-shared — 4 independent workers each load ~600MB torch+model and OOM a 2g cap on boot. `curl ca-certificates` are both on the apt install line (the original had `ca-certificates` misplaced into the `rm` clause).
- [ ] `backend/.dockerignore`: exclude `venv/`, `__pycache__/`, `.mypy_cache/`, `.ruff_cache/`, `tests/`, `*.egg-info/`, `.env`, `.env.*`, `alembic/versions/__pycache__`, `docs/` (if copied). Anything not needed at runtime.
- [ ] Build: `docker build -f backend/Dockerfile.prod -t dalil-backend:prod backend/` — expected success.
- [ ] Inspect: `docker run --rm -u app dalil-backend:prod python -c "import app.main; print('ok')"` (run as the `app` user to actually verify the venv perms) — expected `ok`. Note: the app imports fine; model loads only on lifespan (gunicorn boot) which needs DB+Redis — skip that smoke here, do it in C7.

### Task C2: Backend entrypoint — migrations then gunicorn

**Files:** Create `backend/entrypoint.sh`

- [ ] Contents:
  ```sh
  #!/bin/sh
  set -e
  echo "Running alembic upgrade head..."
  alembic upgrade head
  echo "Starting gunicorn..."
  exec "$@"
  ```
- [ ] `chmod +x backend/entrypoint.sh`.
- [ ] Verify shebang works: `docker run --rm dalil-backend:prod sh -c "head -1 /entrypoint.sh"` shows `#!/bin/sh`.

### Task C3: Prod compose — backend, celery, db, redis, nginx, certbot

**Files:** Create `deploy/docker-compose.prod.yml`; Create `deploy/.env.prod.example`

- [ ] `deploy/.env.prod.example` — all `config.py` vars with prod placeholders: `DATABASE_URL=postgresql+asyncpg://dalil:${POSTGRES_PASSWORD}@db:5432/dalil`, `DATABASE_URL_SYNC=postgresql://dalil:${POSTGRES_PASSWORD}@db:5432/dalil`, `REDIS_URL=redis://redis:6379/0`, `CELERY_*`, `EMBEDDING_*` (384), `ENV=production`, `DEBUG=false`, `CORS_ORIGINS=https://yourdomain.tld`, `DOMAIN=yourdomain.tld`, `LETSENCRYPT_EMAIL=you@example.com`.
- [ ] `deploy/docker-compose.prod.yml`:
  - `db`: image `pgvector/pgvector:pg16`, env `POSTGRES_USER=dalil POSTGRES_PASSWORD POSTGRES_DB=dalil` (no value, forces required-from-env), NO `ports` (internal only), volume `pgdata`, healthcheck, `restart: unless-stopped`, attached to `internal` network only.
  - `redis`: image `redis:7-alpine`, NO `ports`, command `redis-server --save 60 1`, healthcheck, `restart: unless-stopped`, `internal` network only.
  - `backend`: `build: { context: ../backend, dockerfile: Dockerfile.prod }`, env_file `./.env.prod`, depends_on db/redis healthy, `restart: unless-stopped`, volume `model-cache:/home/app/.cache/huggingface` (the non-root user's HOME is `/home/app`; env `HF_HOME=/home/app/.cache/huggingface` on the service), networks `[internal, web]`, `mem_limit: 3g` (NOT `deploy.resources.limits.memory` — that key is Swarm-only and ignored by `docker compose`).
  - `celery-worker`: same build as backend, command `celery -A app.celery_app worker --loglevel=info --concurrency=2`, env_file `./.env.prod`, depends_on db/redis, `restart: unless-stopped`, volume `model-cache`, network `internal` only, `mem_limit: 3g`.
  - `nginx`: image `nginx:alpine`, ports `80:80 443:443`, volumes `./nginx/conf.d:/etc/nginx/conf.d:ro`, `./nginx/nginx.conf:/etc/nginx/nginx.conf:ro`, `certbot-www:/var/www/certbot:ro`, `certbot-conf:/etc/letsencrypt:ro`, `restart: unless-stopped`, depends_on backend, network `web`.
  - Do NOT add a long-running `certbot` service — `certbot renew` exits in <1s, so `docker compose up -d` would restart-loop it uselessly. Instead, document a weekly cron: `docker compose -f deploy/docker-compose.prod.yml run --rm certbot certbot renew` (define a `certbot` service ONLY for `run --rm`, with `profiles: [certbot]` so `up -d` never starts it).
  - Top-level `networks: { internal: { internal: true }, web: {} }` — `internal: true` means no external gateway (db/redis can't reach internet).
  - Top-level `volumes: { pgdata: {}, model-cache: {}, certbot-conf: {}, certbot-www: {} }`.
  - Each long-running service has `healthcheck` + `restart: unless-stopped`.
  - No `version:` line (obsolete).
- [ ] `docker compose -f deploy/docker-compose.prod.yml config` — expected: validates without error (substitute from `.env.prod.example`-derived env or env-file flag).
- [ ] Confirm `5432` and `6379` are NOT published to any host interface.

### Task C4: nginx config — reverse proxy + TLS + security headers

**Files:** Create `deploy/nginx/nginx.conf`; Create `deploy/nginx/conf.d/dalil.conf`

- [ ] `nginx.conf`: standard `worker_processes auto;`, `events { worker_connections 1024; }`, `http { include /etc/nginx/mime.types; default_type application/octet-stream; sendfile on; keepalive_timeout 65; gzip on; gzip_types text/plain application/json application/javascript text/css; client_max_body_size 2m; include /etc/nginx/conf.d/*.conf; }`.
- [ ] `dalil.conf`: two server blocks.
  - Port 80 server: `server_name ${DOMAIN}; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 301 https://$host$request_uri; }`.
  - Port 443 server: `server_name ${DOMAIN}; listen 443 ssl; http2 on; ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem; ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem; ssl_protocols TLSv1.2 TLSv1.3; ssl_prefer_server_ciphers on; add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always; add_header X-Content-Type-Options nosniff always; add_header X-Frame-Options DENY always; add_header Referrer-Policy strict-origin-when-cross-origin always;`.
  - 443 `location /api/ { proxy_pass http://backend:8000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_read_timeout 120s; }`.
  - 443 `location /healthz { proxy_pass http://backend:8000/healthz; }`.
  - 443 `location / { return 404; }` (frontend lives on Cloudflare, not here — backend VPS only serves `/api` and `/healthz`).
- [ ] Note: `${DOMAIN}` is a literal placeholder — the operator replaces it (or we template via `envsubst` in the init script). Keep it simple: document the find-replace in `deploy/README.md`.
- [ ] Validate: `docker run --rm -v $(pwd)/deploy/nginx:/etc/nginx:ro nginx:alpine nginx -t` — expected `syntax is ok`.

### Task C5: Certbot first-time bootstrap

**Files:** Create `deploy/init-letsencrypt.sh`

- [ ] Script: takes `DOMAIN` and `EMAIL` from env, stops nginx if running, deletes old `certbot-conf`, runs a one-off certbot `certonly --webroot -w /var/www/certbot --email $EMAIL -d $DOMAIN --agree-tos --no-eff-email`, then `docker compose up -d nginx`.
- [ ] Idempotent-ish: warn if cert already exists.
- [ ] `chmod +x deploy/init-letsencrypt.sh`.
- [ ] Document usage in `deploy/README.md`.

### Task C6: Cloudflare Pages config

**Files:** Create `frontend/public/_redirects`

- [ ] Cloudflare Pages **does not** proxy external origins with `_redirects` status `200` (that's Netlify). A same-origin rewrite stays frontend-side; an external rewrite is a redirect exposing the VPS domain. Two viable options — implement option (a):
  - **(a) Pages Function proxy** (recommended): create `frontend/functions/api/[[...path]].ts` that forwards `${request.method}` to `${BACKEND_URL}/api/v1/${path}` (with `${search}`) and returns the upstream response. Set `BACKEND_URL` in the Pages environment variables. Add SPA `_redirects` with just `/* /index.html 200`.
  - **(b) Direct cross-origin calls** (lazy fallback): frontend calls the backend domain directly, CORS `CORS_ORIGINS` includes the Pages domain, no proxy. Simpler but exposes the VPS domain.
- [ ] `frontend/public/_redirects` (SPA fallback only, since the `/api` proxy is handled by the Function):
  ```
  /*  /index.html  200
  ```
- [ ] Note in `deploy/README.md`: operator sets Cloudflare Pages build command `npm run build`, output dir `dist`, and Pages env var `BACKEND_URL=https://api.yourdomain.tld`.
- [ ] Optional `frontend/Dockerfile.prod`: multi-stage `node:20-alpine` build → `nginx:alpine` serving `dist/` with the same SPA fallback, in case the operator ever wants self-hosted frontend instead of Cloudflare. Include but mark optional.

### Task C7: Deploy README — first-deploy runbook

**Files:** Create `deploy/README.md`

- [ ] Step 1: VPS prep — install docker, docker compose, point DNS A record for `DOMAIN` to VPS IP, copy repo, create `deploy/.env.prod` from `.env.prod.example` with strong `POSTGRES_PASSWORD`, generate `SECRET_KEY` (if added).
- [ ] Step 2: First launch without TLS — temporarily start nginx serving only port 80 (comment out 443 block), bring up `docker compose -f docker-compose.prod.yml up -d`, run `./init-letsencrypt.sh DOMAIN EMAIL` to obtain the cert.
- [ ] Step 3: Enable 443 block, `docker compose restart nginx`, verify `curl https://DOMAIN/healthz` returns `{"status":"ok"}`.
- [ ] Step 4: Re-ingest data — `docker compose exec backend python data/scripts/ingest.py` (or the embed_bulk path), then `docker compose exec celery-worker celery -A app.celery_app call app.tasks.embeddings.embed_all` to populate embeddings. Wait for queue to drain (`celery -A app.celery_app inspect active`).
- [ ] Step 5: Cloudflare Pages — connect repo, set build `npm run build`, output `dist`, add `public/_redirects` with real backend domain, deploy. Verify `https://frontend-domain/api/v1/health` returns `{"status":"ok"}`.
- [ ] Step 6: Postinstall checklist — `DEBUG=false` confirmed, `/docs` returns 404, `CORS_ORIGINS` is the frontend domain, `docker compose exec backend python -c "from app.core.config import settings; assert not settings.debug"`.
- [ ] Step 7: Backup — document scheduled `pg_dump` cron (or Railway-managed if moved later): `docker compose exec db pg_dump -U dalil dalil | gzip > /backups/dalil-$(date +%F).sql.gz`, rotate, copy offsite. Note embeddings are regenerable but re-embedding hours of Celery work — keep a backup anyway.
- [ ] Step 8: Secrets rotation — change `POSTGRES_PASSWORD` from default, update `.env.prod`, `docker compose down && up -d` (db keeps data via volume; the password change requires `ALTER USER` on the existing db — document: `docker compose exec db psql -U dalil -c "ALTER USER dalil PASSWORD 'newpw'"` then update env and restart).

### Task C8: Phase C verification

- [ ] `docker compose -f deploy/docker-compose.prod.yml config` validates.
- [ ] `docker build -f backend/Dockerfile.prod -t dalil-backend:prod backend/` succeeds.
- [ ] `docker run --rm -v $(pwd)/deploy/nginx:/etc/nginx:ro nginx:alpine nginx -t` → `syntax is ok`.
- [ ] Nginx config does not contain real secrets (only the `${DOMAIN}` placeholder).
- [ ] `frontend/public/_redirects` exists with the two rules.

---

## Phase D — Frontend Resilience & Bugs

### Task D1: ErrorBoundary + QueryClient defaults

**Files:** Modify `frontend/src/main.tsx`; Create `frontend/src/components/ErrorBoundary.tsx`

- [ ] Create `frontend/src/components/ErrorBoundary.tsx`: class component implementing `getDerivedStateFromError` + `componentDidCatch`, renders a fallback UI with a reload button (`window.location.reload()`) and the message "Terjadi kesalahan. Muat ulang halaman." Conservative styling with Tailwind classes.
- [ ] In `frontend/src/main.tsx`: wrap `<RouterProvider>` with `<ErrorBoundary>`.
- [ ] Construct `new QueryClient({ defaultOptions: { queries: { retry: 2, staleTime: 60_000, refetchOnWindowFocus: false } } })`.
- [ ] Run `npx tsc --noEmit -p frontend/` — expected exit 0.
- [ ] Run `npx biome check frontend/src/` — expected exit 0 (or only pre-existing warnings).

### Task D2: API client — timeout + safe errors

**Files:** Modify `frontend/src/lib/api.ts`

- [ ] Add a helper `async function apiFetch(url: string, init?: RequestInit): Promise<Response>` that merges `init` with an `AbortSignal.any([init?.signal, AbortSignal.timeout(10_000)])` — combining the caller's abort (react-query cancellation, route unmount) WITH the 10s timeout, not discarding the caller's signal.
- [ ] Replace all `await fetch(...)` calls with `await apiFetch(...)`.
- [ ] In each error branch: drop `res.statusText` from the thrown message — use generic `"Gagal memuat data. Coba lagi nanti."`. Keep the HTTP status visible only via a `status` property on a small `ApiError` class if useful, but never expose the statusText body.
- [ ] Guard `res.json()`: try/catch, on parse failure throw `ApiError("Respon tidak valid dari server.", res.status)`.
- [ ] Optionally check `res.headers.get("content-type")?.includes("application/json")` before `.json()`.
- [ ] Run `npx tsc --noEmit -p frontend/` — expected exit 0.

### Task D3: Search route — useQuery + dir rtl + aria

**Files:** Modify `frontend/src/routes/search.tsx`

- [ ] Convert the manual `useState`+`useEffect`+`fetchSearch` to a `useQuery` keyed on `["search", q, page, sources]`. Remove the manual effect; let React Query own loading/error/refetch.
- [ ] Replace `getQueryParam()` reading `window.location.search` with TanStack `useSearch({ from: "/search" })` reading the validated `q` (the `validateSearch` at the bottom already defines it — use it).
- [ ] On the Arabic result card `<p className="arabic-text ...">` add explicit `dir="rtl"`.
- [ ] Add `aria-label="Cari dalil"` to the search `<input>`.
- [ ] Update the `validateSearch` to coerce non-string `q` to `""` (replace `(params.q as string)` with `typeof params.q === "string" ? params.q : ""`).
- [ ] Run `npx tsc --noEmit -p frontend/` and `npx biome check frontend/src/routes/search.tsx` — expected exit 0.

### Task D4: Quran surah page — router-managed pagination

**Files:** Modify `frontend/src/routes/quran.$surahId.tsx`

- [ ] Add `validateSearch` to the route returning `{ page: Number(page) || 1 }` (coerce safely), mirroring the pattern TanStack expects.
- [ ] Replace `getPageParam()` reading `window.location.search` with `const { page } = useSearch({ from: "/quran/$surahId" })`.
- [ ] Pass `page` into the `useQuery` key: `["surah", surahId, page]`.
- [ ] Replace raw `<a href>` pagination buttons with TanStack `<Link to="/quran/$surahId" search={{ page: p }}>`.
- [ ] Run `npx tsc --noEmit -p frontend/` — expected exit 0.

### Task D5: Hadith collection page — router-managed pagination

**Files:** Modify `frontend/src/routes/hadith.$slug.tsx`

- [ ] Same pattern as D4: add `validateSearch { page }`, use `useSearch`, `<Link search={{page}}>` for pagination.
- [ ] Run `npx tsc --noEmit -p frontend/` — expected exit 0.

### Task D6: Detail pages — `<Link>` prev/next

**Files:** Modify `frontend/src/routes/quran.$surahId.$verseNumber.tsx`, `frontend/src/routes/hadith.$slug.$hadithId.tsx`

- [ ] Replace raw `<a href>` prev/next with TanStack `<Link>` components.
- [ ] Run `npx tsc --noEmit -p frontend/` — expected exit 0.

### Task D7: Pagination component — Link/button instead of anchor

**Files:** Modify `frontend/src/components/Pagination.tsx`

- [ ] Where currently rendering `<a href={buildHref(p)}>`, render `<Link>` when a `to` prop is passed, OR a regular `<button>` when `onClick` is the integration. Disabled prev/next should render a `<button disabled>` (not a focusable `<a>`), so add `tabIndex={-1}` + `aria-disabled` if keeping `<a>`.
- [ ] Keep the public API of `Pagination` compatible with both call sites.
- [ ] Run `npx tsc --noEmit -p frontend/` and `npx biome check frontend/src/components/Pagination.tsx` — expected exit 0.

### Task D8: Dependency hygiene

**Files:** Modify `frontend/package.json`, `frontend/tsconfig.json`, `frontend/biome.json`

- [ ] Move `@tanstack/router-devtools` from `dependencies` to `devDependencies`.
- [ ] `tsconfig.json`: set `"noUnusedLocals": true`, `"noUnusedParameters": true`. Fix any new errors that surface (likely a few unused imports) before re-running.
- [ ] `biome.json`: set `noExplicitAny` to `"error"` (was `"warn"`).
- [ ] Run `npm install` (to regenerate lockfile with the devDeps move), then `npx tsc --noEmit -p frontend/` and `npx biome check frontend/src/` — expected exit 0.

### Task D9: HTML lang + input aria

**Files:** Modify `frontend/index.html`

- [ ] Add `<input ... aria-label="Cari dalil" ...>` to the search input — it is React-rendered in `routes/search.tsx` (`SearchBar`) and the home route, NOT in `index.html` (which has no input). Edit the React files; leave `index.html` alone except for `<html lang="id">`.
- [ ] Keep `<html lang="id" dir="ltr">` (UI is Indonesian); add `lang="ar"` attribute on Arabic `<p>` elements where rendered (mainly in the verse/hadith detail components).
- [ ] Run `npx biome check frontend/src/` — expected exit 0.

### Task D10: Phase D verification

- [ ] `npx tsc --noEmit -p frontend/` — exit 0.
- [ ] `npx biome check frontend/src/` — exit 0.
- [ ] Manual build: `cd frontend && npm run build` — expected success, `dist/` produced,Inspect `dist/` size sane (< ~500KB gzipped).
- [ ] Manual smoke (dev): `npm run dev`, navigate `/quran/1`, change page, verify URL updates via router (no full reload), back/forward works. Same for `/hadith/bukhari`. `/search?q=sabar` deep link works and reload fetches via react-query.

---

## Phase E — Compose Hardening, Deps, Docs

### Task E1: Dev compose — loopback ports, networks, restart, healthcheck

**Files:** Modify `docker-compose.yml` (dev)

- [ ] Remove the `version: '3.8'` line (obsolete, emits warning).
- [ ] `db.ports`: `"5432:5432"` → `"127.0.0.1:5432:5432"` (loopback only).
- [ ] `redis.ports`: `"6379:6379"` → `"127.0.0.1:6379:6379"`.
- [ ] Add top-level `networks: { default: {} }` (or explicit named networks if desired).
- [ ] Add `restart: unless-stopped` to `db`, `redis`, `backend`, `celery-worker` (NOT `frontend` — dev hot-reload should crash visibly).
- [ ] Add a `healthcheck` to `backend`: `["CMD-SHELL", "python -c \"import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/healthz').status==200 else 1)\""]`, interval 30s, timeout 5s, retries 3.
- [ ] Add `mem_limit: 2g` to `backend` and `mem_limit: 3g` to `celery-worker` (NOT `deploy.resources.limits.memory` — that key is Swarm-only and `docker compose` ignores it).
- [ ] Run `docker compose config` — expected: validates (warnings about obsolete version gone).
- [ ] Bring dev stack up briefly: `docker compose up -d`, `curl http://localhost:8000/healthz` → `{"status":"ok"}`, then `docker compose down`.

### Task E2: Backend deps cleanup + lockfile

**Files:** Modify `backend/requirements.txt`, `backend/pyproject.toml`

- [ ] Remove `python-multipart>=0.0.9` (no file-upload endpoint uses it).
- [ ] Remove `scikit-learn>=1.5.0` (no `sklearn` import in `backend/app/`).
- [ ] Add `gunicorn>=21.2.0`.
- [ ] Verify the open question in the plan's Risks: does sentence-transformers 3.4 actually need `torch>=2.9.0`? It does not — lower to `torch>=2.2.0` (CPU wheels are ~200MB vs 2GB for 2.9 CUDA). If unsure after checking, keep `torch>=2.2.0` (sentence-transformers 3.4 supports torch>=2.1).
- [ ] Generate `backend/requirements.lock` via `pip freeze > requirements.lock` from a fresh install — BUT exclude torch (architecture/CUDA-specific, a dev-box freeze pinning breaks the VPS). Either `uv pip compile requirements.txt -o requirements.lock --no-deps` is wrong too; the lazy correct approach: commit a `requirements.lock` and `Dockerfile.prod` uses `pip install --no-cache-dir -r requirements.lock`, then ADD `torch` on its own line AFTER, pinned to `>=2.2.0` so pip resolves the CPU wheel for the slim image. Verify the build pulls CPU torch (check `pip show torch` output isn't a CUDA variant in the image).
- [ ] Confirm `reverse-engineer` search service still imports without sklearn (it never used it — this is a noop removal).
- [ ] Run `pip install -r backend/requirements.txt` in a clean venv — expected success.
- [ ] Run `pytest backend/tests -q` — still passing.

### Task E3: Smoke test full stack (Phase A+B+E integration)

- [ ] `docker compose down -v` (wipe dev state).
- [ ] `docker compose up -d db redis` — wait healthy.
- [ ] `cd backend && alembic upgrade head` — squashed baseline applies.
- [ ] `python data/scripts/ingest.py` — re-ingest Quran + Hadith.
- [ ] `docker compose up -d backend celery-worker` — backend boots, Celery starts.
- [ ] Trigger embedding: `python -c "from app.tasks.embeddings import embed_all; embed_all.delay()"` (or `celery call`) — wait queue drains (`celery -A app.celery_app inspect active` empty).
- [ ] `curl 'http://localhost:8000/api/v1/search?q=sabar' | jq '.total, .results[0]'` — expected > 0 and a sensible top result.
- [ ] `curl 'http://localhost:8000/api/v1/quran/1' | jq '.verses | length'` — expected non-zero.
- [ ] `curl http://localhost:8000/healthz` → `{"status":"ok"}`.
- [ ] `curl http://localhost:8000/api/v1/ready` → `{"status":"ready","db":true,"redis":true}`.
- [ ] `curl http://localhost:8000/docs` when `DEBUG=false` (set in `.env`) → expected 404 (docs disabled). Toggle `DEBUG=true`, restart, `/docs` returns Swagger UI.

### Task E4: Update docs

**Files:** Modify `docs/TECH.md`; Modify `docs/CODEBASE_ANALYSIS.md`

- [ ] `docs/TECH.md`: in the Deployment section, replace the stated "Vercel + Railway" target with the confirmed topology: **Cloudflare Pages (frontend) + VPS Docker Compose prod (backend + Postgres + Redis + nginx + Certbot)**. Add subsections: Network topology, DNS, TLS, Migrations (auto via entrypoint), Re-ingest, Backups, Secrets rotation.
- [ ] `docs/CODEBASE_ANALYSIS.md`: update the "PERLU DI-SQUASH" note to "SQUASHED 2026-07-08 into single 0001 baseline"; mark the previously-flagged security issues (debug leak, no rate-limit middleware, no SSL, Celery no limits, migration destructive, public DB/Redis ports, no prod Dockerfile, no backup plan, devtools in deps) as RESOLVED with commit refs / date.
- [ ] Run `git diff docs/` — expected: diffs only in the two doc files.

### Task E5: Final lint + typecheck + commit readiness

- [ ] `ruff check backend/` — exit 0.
- [ ] `ruff format --check backend/` — exit 0.
- [ ] `mypy backend/ --ignore-missing-imports` — exit 0 (or only third-party library stub warnings, acceptable).
- [ ] `npx biome check frontend/src/` — exit 0.
- [ ] `npx tsc --noEmit -p frontend/` — exit 0.
- [ ] `pytest backend/tests -q` — exit 0.
- [ ] `git status` — staged set matches expected changes; no secrets in diff; `.env` not staged.
- [ ] DO NOT commit unless the user explicitly asks. Stop here and report.

---

## Verification Summary

After all phases:
- Backend: `ruff`, `mypy`, `pytest` all green.
- Frontend: `biome`, `tsc`, `npm run build` all green.
- Migrations: single `0001` baseline, fresh DB round-trip clean.
- Prod image: builds, runs as non-root, gunicorn+uvicorn workers, healthcheck wired.
- Compose prod: validates, no DB/Redis ports exposed, nginx+TLS config syntactically valid.
- Cloudflare: `_redirects` proxies `/api` to VPS; SPA fallback in place.
- Docs: prod topology documented, security issues marked resolved.

## Risks / Notes

- **No auth** by explicit decision (public MVP). If abuse appears, add a shared-secret API-key dependency on routers — Phases A still gate via rate-limits + non-root container + loopback DB/Redis + TLS.
- **Squash breaks existing DBs**: any environment that already ran the old `0001-0007` must `DROP SCHEMA public CASCADE` + re-run + re-ingest, because there is no upgrade path from the old revisions to the new squashed `0001`. This is acceptable pre-launch (no prod data yet). Documented in `deploy/README.md`.
- **Embedding model floor**: `torch>=2.9.0` in requirements inflates the image (~2GB). Verify this floor is real (does sentence-transformers 3.4 need torch 2.9?). If not, lower to `torch>=2.2.0`. Investigate in E2; do not blindly pin.
- **X-Forwarded-For trust**: the limiter trusts nginx's XFF. If backend is ever exposed directly (misconfig), an attacker can spoof XFF. Mitigated by `internal: true` network on the compose (backend not reachable except via nginx). Document the trust assumption.
- **Backup**: `pgdata` volume is the only persistence. E4 documents a `pg_dump` cron; operator must schedule it. Embeddings are regenerable but cost hours — backup anyway.
- **Certbot renewal**: the `certbot renew` container should run on a cron via `docker compose run --rm certbot` weekly. Add to `deploy/README.md` the suggested crontab line.