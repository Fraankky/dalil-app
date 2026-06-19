# AGENTS.md — Dalil App

Semantic search platform for Islamic textual sources (Quran + Hadith).

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0 (async), Alembic, Celery, pgvector |
| Frontend | TypeScript 5.x, React 18, Vite 5, TanStack Router (programmatic), Tailwind CSS 3 |
| Database | PostgreSQL 16 + pgvector (HNSW index, cosine), Redis 7 |
| Infra | Docker Compose (dev), Vercel + Railway (prod) |

## Code Standards

- **Backend**: Ruff (`E, F, W, I, UP, B, C4, SIM, N`), mypy strict, pytest
- **Frontend**: Biome (recommended rules), TypeScript strict mode
- **No comments** unless absolutely necessary — code should be self-documenting
- Follow existing patterns in the codebase

## Key Conventions

- Arabic text always uses `.arabic-text` CSS class with `direction: rtl`
- API routes: `/api/v1/` prefix
- DB migrations: Alembic only, never edit tables directly
- Environment variables: `.env` for local, never commit
- Path aliases: `@/` maps to `src/` in frontend

## Before Committing

```bash
# Backend
ruff check backend/
ruff format --check backend/
mypy backend/ --ignore-missing-imports

# Frontend
npx biome check frontend/src/
npx tsc --noEmit -p frontend/
```

## Project Files

| Path | Purpose |
|---|---|
| `docs/PRD.md` | Product Requirements |
| `docs/TECH.md` | Technical Architecture |
| `docs/DIAGRAMS.md` | System Flow Diagrams |
| `docs/PIPELINE.md` | Data Pipeline & Embedding Design |
| `data/raw/` | Quran + Hadith source JSON files |
| `data/scripts/ingest.py` | ETL ingestion script |
