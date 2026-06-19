# Dalil App — Backend

FastAPI backend for semantic search across Islamic textual sources.

## Quick Start

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

## Tech Stack
- **FastAPI** — async web framework
- **PostgreSQL + pgvector** — relational DB with vector search
- **SentenceTransformers** — multilingual embedding model
- **Celery + Redis** — async task queue
- **Alembic** — database migrations
