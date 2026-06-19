# Dalil App

Semantic search platform for Islamic textual sources: the Qur'an, Hadith collections, and scholarly works. Search by meaning, not just keywords — in Arabic, English, or transliteration.

## Quick Start

```bash
# Start all services
docker compose up -d

# Or run individually:
# Backend
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

## Architecture

```
frontend (React + Vite + TanStack Router)  ──►  backend (FastAPI)  ──►  PostgreSQL + pgvector
                                                      Redis (cache/queue)
                                                      Celery (async tasks)
```

## Documentation

- [PRD](docs/PRD.md) — Product Requirements
- [Technical Spec](docs/TECH.md) — Architecture & Implementation

## API

| Endpoint | Description |
|---|---|
| `GET /api/v1/search?q=...` | Semantic search |
| `GET /api/v1/quran/surahs` | List all surahs |
| `GET /api/v1/quran/{id}` | Get surah with verses |
| `GET /api/v1/quran/{surah}/{verse}` | Get single verse |
| `GET /api/v1/hadith/collections` | List collections |
| `GET /api/v1/hadith/{slug}` | Browse hadith by collection |
| `GET /api/v1/stats` | Corpus statistics |

Full docs at `/docs` when backend is running.
