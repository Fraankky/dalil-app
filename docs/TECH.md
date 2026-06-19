# Technical Requirements & Architecture — Dalil App

## 1. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) + TypeScript | SSR/SSG for SEO, React ecosystem, Vercel-native |
| **Styling** | Tailwind CSS + shadcn/ui | Rapid UI development, RTL support |
| **Backend API** | Python FastAPI | Async, OpenAPI auto-docs, ML ecosystem |
| **Database (Primary)** | PostgreSQL 16 + pgvector | Vector similarity search, relational data |
| **Cache** | Redis | Rate limiting, session cache, hot query cache |
| **Embedding Model** | `intfloat/multilingual-e5-large-instruct` | State-of-the-art multilingual (supports Arabic + English), 1024-dim vectors |
| **Search Engine** | pgvector `ivfflat` / `hnsw` indexing | Cosine similarity, hybrid with BM25 |
| **Task Queue** | Celery + Redis | Async embedding generation, data imports |
| **Object Storage** | MinIO (dev) / S3 (prod) | Model files, static assets |
| **Deployment** | Docker Compose (dev), Vercel (frontend) + Railway/Fly.io (backend) | Simple ops for MVP |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                      │
│  Next.js 14 (App Router) + Tailwind + shadcn/ui              │
│  PWA • SSR • RTL • i18n                                     │
└──────────────┬──────────────────────────────┬────────────────┘
               │                              │
          SSR/SSG (pages)              API Calls (search, browse)
               │                              │
┌──────────────▼──────────────────────────────▼────────────────┐
│                    Next.js API Routes (BFF)                   │
│  /api/search    /api/quran/[surah]   /api/hadith/[id]       │
│  Thin proxy — forwards to FastAPI backend                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                     FastAPI Backend (:8000)                   │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │  /search     │  │  /quran/*    │  │  /hadith/*        │   │
│  │  semantic    │  │  CRUD+browse │  │  CRUD+browse      │   │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────────┘   │
│         │                 │                   │               │
│         │    ┌────────────▼───────────┐       │               │
│         │    │   Embedding Service    │       │               │
│         │    │   (SentenceTransformers)│       │               │
│         │    │   multilingual-e5-large │       │               │
│         │    └────────────┬───────────┘       │               │
│         │                 │                   │               │
│  ┌──────▼─────────────────▼───────────────────▼──────────┐   │
│  │              PostgreSQL 16 + pgvector                   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────────────┐    │   │
│  │  │  verses  │  │  hadith  │  │  vector_index     │    │   │
│  │  │  (6236)  │  │ (~17000) │  │  (HNSW + cosine)  │    │   │
│  │  └──────────┘  └──────────┘  └───────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌──────────────────────┐   ┌──────────────────────────┐      │
│  │  Celery Workers (2)  │   │  Redis (:6379)            │      │
│  │  - Embed generation  │   │  - Cache (query results)  │      │
│  │  - Data ingestion    │   │  - Rate limiter           │      │
│  └──────────────────────┘   │  - Celery broker           │      │
│                              └──────────────────────────┘      │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Search Pipeline Detail

```
User Query (any language)
        │
        ▼
┌─────────────────────┐
│ 1. Query Preprocessing │
│    - Normalize unicode  │
│    - Strip diacritics   │
│    - Transliteration →  │
│      Arabic (optional)  │
│    - Language detection  │
└─────────┬─────────────┘
          │
          ▼
┌─────────────────────┐
│ 2. Embed Query        │
│    multilingual-e5     │
│    → 1024-dim vector   │
└─────────┬─────────────┘
          │
          ▼
┌─────────────────────┐
│ 3. Vector Search      │
│    pgvector cosine     │
│    similarity (HNSW)   │
│    → top-k candidates  │
│    (k=100)             │
└─────────┬─────────────┘
          │
          ▼
┌─────────────────────┐
│ 4. Hybrid Re-rank     │
│    - BM25 text score   │
│    - Vector similarity │
│    - Source boost      │
│      (Qur'an > Hadith) │
│    → top-K final       │
│    (K=20)              │
└─────────┬─────────────┘
          │
          ▼
┌─────────────────────┐
│ 5. Response Assembly  │
│    - Fetch full text   │
│    - Attach metadata   │
│    - Add translations  │
│    - Return JSON       │
└──────────────────────┘
```

---

## 4. Vector Embedding Strategy

### Model Choice: `intfloat/multilingual-e5-large-instruct`

| Property | Value |
|---|---|
| Embedding dim | 1024 |
| Max tokens | 512 |
| Languages | 100+ (Arabic, English, Indonesian strong) |
| MTEB score | 64.5 (multilingual retrieval) |
| Instruction-tuned | Yes — prefix queries with `"query: "` |

### Embedding Storage

```sql
-- pgvector migration
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE verse_embeddings (
    id          SERIAL PRIMARY KEY,
    verse_id    INT REFERENCES verses(id) ON DELETE CASCADE,
    embedding   VECTOR(1024),
    source_type VARCHAR(10) CHECK (source_type IN ('quran', 'hadith')),
    lang        VARCHAR(5) DEFAULT 'ar'
);

CREATE INDEX ON verse_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);
```

### What Gets Embedded

| Content | Embedding Strategy |
|---|---|
| Arabic verse text | Embed directly (primary) |
| English translation | Embed separately (cross-lingual fallback) |
| Verse + Hadith concatenated | "Arabic text" ∥ "English translation" for unified embedding |

---

## 5. Data Model

```sql
-- === QUR'AN ===
CREATE TABLE surahs (
    id              SMALLINT PRIMARY KEY,
    name_arabic     TEXT NOT NULL,
    name_english    TEXT NOT NULL,
    revelation_type VARCHAR(6) CHECK (revelation_type IN ('Meccan', 'Medinan')),
    verses_count    SMALLINT NOT NULL
);

CREATE TABLE verses (
    id              SERIAL PRIMARY KEY,
    surah_id        SMALLINT REFERENCES surahs(id),
    verse_number    SMALLINT NOT NULL,
    text_arabic     TEXT NOT NULL,
    text_translation TEXT,  -- e.g., Sahih International English
    juz             SMALLINT,
    page            SMALLINT,
    UNIQUE (surah_id, verse_number)
);

-- === HADITH ===
CREATE TABLE hadith_collections (
    id      SERIAL PRIMARY KEY,
    name_eng TEXT NOT NULL,
    name_ar  TEXT NOT NULL,
    slug     VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE hadith_books (
    id              SERIAL PRIMARY KEY,
    collection_id   INT REFERENCES hadith_collections(id),
    name_eng        TEXT NOT NULL,
    name_ar         TEXT NOT NULL,
    book_number     SMALLINT NOT NULL
);

CREATE TABLE hadith (
    id              SERIAL PRIMARY KEY,
    collection_id   INT REFERENCES hadith_collections(id),
    book_id         INT REFERENCES hadith_books(id),
    hadith_number   TEXT NOT NULL,
    chapter_name_eng TEXT,
    chapter_name_ar  TEXT,
    text_arabic     TEXT NOT NULL,
    text_english    TEXT, -- translation
    grade           VARCHAR(30), -- Sahih, Hasan, Da'if, etc.
    narrator_chain  TEXT,
    UNIQUE (collection_id, hadith_number)
);

-- === EMBEDDINGS ===
CREATE TABLE embeddings (
    id              SERIAL PRIMARY KEY,
    source_type     VARCHAR(10) CHECK (source_type IN ('quran', 'hadith')),
    source_id       INT NOT NULL, -- PK of verse or hadith
    embedding       VECTOR(1024),
    text_hash       VARCHAR(64),  -- SHA-256 for cache-busting
    model_version   VARCHAR(30),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_embeddings_source ON embeddings(source_type, source_id);
CREATE INDEX idx_embeddings_hnsw ON embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);
```

---

## 6. API Specification

### `GET /api/search`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | string | yes | Search query (Arabic, English, or transliteration) |
| `sources` | string | no | Comma-separated: `quran,bukhari,muslim` (default: all) |
| `lang` | string | no | Interface language: `en`, `ar`, `id` |
| `limit` | int | no | Results per page (default: 10, max: 50) |
| `offset` | int | no | Pagination offset |
| `min_score` | float | no | Minimum relevance score 0–1 (default: 0.3) |

**Response:**
```json
{
  "query": "kindness to parents",
  "query_lang": "en",
  "total": 342,
  "results": [
    {
      "type": "quran",
      "source_id": 1234,
      "surah_name": "Al-Isra",
      "surah_number": 17,
      "verse_number": 23,
      "text_arabic": "وَقَضَىٰ رَبُّكَ أَلَّا تَعۡبُدُوٓاْ إِلَّآ إِيَّاهُ وَبِٱلۡوَٰلِدَيۡنِ إِحۡسَٰنًا...",
      "text_translation": "Your Lord has decreed that you worship none but Him, and to parents, good treatment...",
      "score": 0.92,
      "relevance": 92
    }
  ],
  "took_ms": 87,
  "page": 1,
  "pages": 35
}
```

### `GET /api/quran/{surah_number}`

Returns all verses of a surah with translations.

### `GET /api/quran/{surah_number}/{verse_number}`

Returns a single verse.

### `GET /api/hadith/{collection_slug}`

Paginated hadith listing by collection.

### `GET /api/hadith/{collection_slug}/{hadith_id}`

Returns a single hadith with translation.

### `GET /api/stats`

Returns corpus statistics (total verses, hadith count, etc.).

---

## 7. Data Pipeline (Ingestion)

```
Raw Data Sources                    Processed Data
─────────────────                   ──────────────
quran-text.json ──┐
                  ├──► ETL Script ──► PostgreSQL
bukhari.json ─────┤    (Python)          │
muslim.json ──────┤                      │
riyad.json ───────┤                      ▼
nawawi.json ──────┘              Embedding Worker
                                        │
                                        ▼
                                  pgvector index
                                  (HNSW + cosine)
```

### Data Sources (Open/Academic)
- **Qur'an**: [Tanzil.net](https://tanzil.net) Uthmani text + translations (CC-licensed)
- **Hadith**: [Sunnah.com](https://sunnah.com) API (with rate limiting, cache to disk)
- **Alternative**: [Hadith-API](https://github.com/farshedx/hadith-api) (open dataset)

### Ingestion Process
1. Download raw JSON/text datasets
2. Normalize Arabic text (NFKC, strip optional diacritics)
3. Insert into PostgreSQL
4. Celery task: generate embeddings in batches of 32
5. Build HNSW index on `embeddings` table

---

## 8. Performance & Scaling

| Concern | Solution |
|---|---|
| **Cold start (embedding model)** | Pre-load model on FastAPI startup; keep in GPU/CPU memory |
| **Search latency** | Cache frequent queries in Redis (TTL: 1 hour); HNSW index for O(log N) ANN |
| **High concurrency** | Connection pooling (pgBouncer); async FastAPI; multiple workers |
| **Large corpus growth** | Partition embeddings table; shard by source_type |
| **Model update** | Version column in embeddings; background re-index |

### Approximate Embedding Storage
- 1024 dims × 4 bytes = 4 KB per vector
- ~25,000 records (6236 verses + ~17,000 hadith) = ~100 MB
- With HNSW index overhead: ~200 MB total — fits comfortably in memory

---

## 9. Development Environment

```
dalil-app/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── search.py
│   │   │   ├── quran.py
│   │   │   └── hadith.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   └── dependencies.py
│   │   ├── models/
│   │   │   ├── verse.py
│   │   │   └── hadith.py
│   │   ├── services/
│   │   │   ├── embedding.py
│   │   │   ├── search.py
│   │   │   └── ingestion.py
│   │   └── main.py
│   ├── alembic/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── docker-compose.dev.yml
├── frontend/
│   ├── app/                 # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx         # Home / Search
│   │   ├── search/
│   │   ├── quran/
│   │   ├── hadith/
│   │   └── api/
│   ├── components/
│   ├── lib/
│   ├── public/
│   ├── tailwind.config.ts
│   └── package.json
├── data/
│   ├── raw/                 # Raw datasets
│   └── scripts/             # ETL Python scripts
├── docker-compose.yml
├── docs/
│   ├── PRD.md
│   └── TECH.md
└── README.md
```

---

## 10. Key Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Arabic embedding quality** | Poor search results | Evaluate on Arabic retrieval benchmarks; fallback to BM25 hybrid |
| **Large model RAM usage** | OOM on small instances | Use `multilingual-e5-base` (768-dim) if needed; ONNX quantization |
| **pgvector performance at scale** | Slow queries beyond 1M rows | Partition by source; add approximate nearest-neighbor libraries (FAISS) |
| **Data licensing** | Cannot redistribute | Use CC/Open data; document attributions clearly |
| **RTL UI complexity** | Layout bugs on Arabic | Tailwind RTL support; test with Arabic-first UI early |

---

## 11. Tech Decision: pgvector vs. Dedicated Vector DB

| Factor | pgvector | Pinecone / Weaviate / Qdrant |
|---|---|---|
| **Ops simplicity** | Same DB, no new service | Separate service to manage |
| **Cost (MVP)** | Free | Paid tier or self-hosted infra |
| **Performance** | Good for < 1M vectors | Excellent for 100M+ |
| **Hybrid search** | Easy (JOIN with text columns) | Requires dual-write |
| **Verdict** | ✅ **pgvector for MVP**; migrate if scale demands it |

---

## 12. Monitoring Stack (MVP+)

- **Sentry** — error tracking (frontend + backend)
- **Prometheus + Grafana** — query latency, embedding throughput
- **Vercel Analytics** — frontend performance, user behavior
- **Postgres pg_stat_statements** — slow query detection
