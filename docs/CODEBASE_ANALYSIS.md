# Dalil App — Codebase Analysis & Audit

## 1. Executive Summary

Dalil adalah platform semantic search untuk teks Islam (Quran + Hadith) dengan stack:
- **Backend**: Python 3.11 + FastAPI + SQLAlchemy 2.0 (async) + pgvector + Celery
- **Frontend**: React 18 + TypeScript + Vite + TanStack Router + Tailwind CSS 3
- **Database**: PostgreSQL 16 + pgvector (HNSW index, cosine distance)
- **Embedding Model**: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384-dim)

Proyek ini masih dalam **fase awal (Phase 1 — Foundation)** dengan banyak inkonsistensi dan error yang perlu diselesaikan.

---

## 2. Arsitektur & Integrasi: Dari Data ke Embedding

### 2.1 Alur End-to-End

```
DATA INGESTION                EMBEDDING                   SEARCH (Runtime)
                            
Tanzil.net Quran JSON --->   Celery Worker               User Query
   (quran.json)              _rows_missing_                 "patience"
                              embeddings()                       |
Hadith-ID JSON files --->                                       v
  (9 koleksi)               SELECT v.id,               embed_query_async()
                            v.text_arabic              model.encode(
                            FROM verses v               "query: patience"
                            LEFT JOIN                  ) -> vector[384]
ingest.py:                    embeddings e                      |
  parse & validate            WHERE e.id IS NULL                v
  normalize unicode                                           SEARCH_QUERY
  batch insert (500)         embed_documents()           WITH query_emb
  verify & trigger           "passage: {text}"           CROSS JOIN
                             -> vectors[384]             HNSW ANN
PostgreSQL:                                                   cosine <=>
  surahs (114)              _upsert_embeddings()          LIMIT 100
  verses (6236)             INSERT INTO embeddings                |
  collections (9)           ON CONFLICT ... DO UPDATE            v
  hadith (~45k)                                                   JOIN ke verses/hadith
                                    |                          -> SearchResponse JSON
                                    v
                             embeddings table
                             + HNSW index
```

### 2.2 Ingestion Pipeline (`data/scripts/ingest.py`)

**Cara kerja:**
1. **Quran**: Membaca `data/raw/quran/quran.json` (Tanzil.net format: `{surah: [{verse, text}]}`) dan `quran-id.json` (terjemahan Indonesia)
2. **Hadith**: Membaca 9 file JSON dari `data/raw/hadith-id/` (abu-dawud.json, ahmad.json, bukhari.json, darimi.json, ibnu-majah.json, malik.json, muslim.json, nasai.json, tirmidzi.json)
3. **Normalisasi**: Unicode NFKC, strip diacritics opsional
4. **Batch insert**: 500 row per batch dengan `ON CONFLICT DO UPDATE` (idempotent)
5. **Data hadith menggunakan field `arab` (arabic) dan `id` (Indonesian translation)**

**Keterbatasan:**
- Tidak ada validasi encoding Arabic yang proper
- Hadith collection names (`name_ar`) kosong untuk semua koleksi
- Tidak ada buku/chapter mapping (field `book_id`/`chapter_id` di-set NULL, `hadith_books` table kosong)
- Tidak ada trigger otomatis ke Celery setelah ingestion — harus manual via `python ingest.py quran`

### 2.3 Embedding Generation

**Dua metode tersedia:**

| Metode | File | Cara Kerja |
|--------|------|------------|
| Celery task | `app/tasks/embeddings.py` | Async via Redis broker, per-batch commit |
| Bulk script | `data/scripts/embed_bulk.py` | Sync, resumable, command-line |

**Model saat ini vs dokumentasi:**
- **`.env` root**: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384-dim)
- **`app/core/config.py` default**: Sama — MiniLM, 384-dim
- **Dokumen (`docs/TECH.md`, `docs/PIPELINE.md`)**: `intfloat/multilingual-e5-large-instruct` (1024-dim) — **TIDAK KONSISTEN**
- **Alembic migrations**: Sempat berganti-ganti 1024 -> 384 -> 1024 -> 384 (migrations 0004, 0006, 0007)

**Prefix handling di `embedding.py`:**
```python
def _needs_prefix() -> bool:
    return "e5" in settings.embedding_model.lower()
```
Karena model sekarang adalah MiniLM (bukan E5), prefix `"query: "` dan `"passage: "` **tidak digunakan**. Ini benar untuk model MiniLM, tapi jika migrasi ke E5 di masa depan, prefix akan aktif otomatis.

**Idempotency:**
- Celery task menggunakan `ON CONFLICT (source_type, source_id, model_version) DO UPDATE`
- Hash-based change detection: jika `text_hash` sama, skip (tidak re-embed)
- Unique constraint dari migration 0002

### 2.4 HNSW Index

Dibuat via migration:
```sql
CREATE INDEX idx_embeddings_hnsw ON embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 200);
```

- `m=16`: setiap node terkoneksi ke 16 tetangga per layer
- `ef_construction=200`: kualitas build index
- Search default `ef_search=100` (PostgreSQL default)
- Index size: ~30 MB untuk 25k vectors 384-dim

### 2.5 Search Flow (Runtime)

**`GET /api/v1/search?q=patience`**

1. **API Layer** (`app/api/search.py`): Parse query params -> panggil `semantic_search()`
2. **Embedding** (`app/services/embedding.py`): `embed_query_async("patience")` -> `model.encode("patience", normalize_embeddings=True)` -> vector[384]
3. **Vector Search** (`app/services/search.py`): SQL dengan HNSW ANN
4. **JOIN ke sumber**: `vector_results` -> JOIN `verses`/`hadith` untuk full text + metadata
5. **Response Assembly**: `SearchResponse` JSON

**Query optimasi:**
- `candidate_limit = max(500, (offset + limit) * 20)` — oversampling untuk pagination
- `UNION ALL` quran + hadith results
- Separate `COUNT_QUERY` untuk total

---

## 3. Bagaimana Menentukan Kualitas Vector DB

### 3.1 Metrik Evaluasi

| Metrik | Definisi | Cara Ukur |
|--------|----------|-----------|
| **Cosine Similarity** | `1 - cosine_distance` | Sudah dihitung di query |
| **Recall@K** | % query yang hasil relevan muncul di top-K | Benchmark dataset |
| **MRR (Mean Reciprocal Rank)** | Rata-rata 1/rank dari hasil relevan pertama | Manual evaluation |
| **NDCG@K** | Normalized Discounted Cumulative Gain | Butuh relevance judgments |
| **Query Latency** | Waktu dari query ke response | `took_ms` di response |
| **Index Build Time** | Waktu build/reindex HNSW | Monitoring |

### 3.2 Cara Mengevaluasi di Proyek Ini

**Saat ini proyek BELUM memiliki mekanisme evaluasi.** Yang perlu ditambahkan:

1. **Ground Truth Dataset**: Buat ~100 pasangan query -> dokumen relevan (manual annotation)
   ```json
   [
     {"q": "patience in Islam", "relevant": ["quran:2:153", "hadith:bukhari:1"]},
     {"q": "rights of parents", "relevant": ["quran:17:23", "quran:31:14"]}
   ]
   ```

2. **Evaluation Script** (belum ada):
   ```python
   def evaluate_recall(query, relevant_ids, k=10):
       results = search(query, limit=k)
       found = set(r.source_id for r in results) & set(relevant_ids)
       return len(found) / len(relevant_ids)
   ```

3. **A/B Testing Model**: Bandingkan dua model embedding dengan metric yang sama

4. **Query Diversity Testing**: Tes dengan variasi Arabic, English, transliteration

### 3.3 Threshold yang Disarankan

| Metrik | Target | Status Saat Ini |
|--------|--------|-----------------|
| Recall@10 | > 80% | Tidak diketahui |
| MRR | > 0.6 | Tidak diketahui |
| p95 latency | < 500ms | Tidak diketahui |
| Index build (25k vectors) | < 60s | Tidak diketahui |

### 3.4 Monitoring yang Sudah Ada

- `took_ms` di search response (latency per query)
- `score` dan `relevance` per result
- Logging request di middleware (`log_requests`)
- Belum ada: Prometheus metrics, Grafana, Sentry

---

## 4. Error, Bug, dan Masalah Kritis

### 4.1 Masalah Infrastruktur & Konfigurasi

#### [KRITIS] Embedding Model Tidak Konsisten antara Config, .env, dan Dokumentasi

| Lokasi | Model | Dimensi |
|--------|-------|---------|
| `backend/app/core/config.py:13` | `paraphrase-multilingual-MiniLM-L12-v2` | 384 |
| Root `.env:17` | `paraphrase-multilingual-MiniLM-L12-v2` | 384 |
| Root `.env:12` (PIPELINE.md docs) | `multilingual-e5-large-instruct` | 1024 |
| `docs/TECH.md:13` | `multilingual-e5-large-instruct` | 1024 |
| `docs/PIPELINE.md:39` | `multilingual-e5-large-instruct` | 1024 |
| `backend/app/models/models.py:127` | `Vector(384)` — hardcoded | 384 |

**Dampak**: Migrasi 1024->384 terjadi 4x (migrations 0004, 0006, 0007). Jika ada data embedding 1024-dim tersisa di DB, query akan crash. Dokumentasi teknis menyesatkan.

**Fix**: Sync dokumentasi dengan realita, atau migrasi ke E5-large yang lebih powerful.

#### [KRITIS] Alembic Migration Chaotic — Bolak-balik 1024 <-> 384

Urutan migration:
- `0001`: Vector(1024) — initial
- `0004`: Vector(384) — turun ke MiniLM
- `0005`: rename + DELETE semua data
- `0006`: Vector(1024) — kembali ke 1024
- `0007`: Vector(384) — kembali ke 384 lagi + DELETE embeddings

**Dampak**: History migration kacau. Jika ada data di DB, running `alembic upgrade head` bisa gagal karena `DELETE FROM embeddings` di migration 0005 dan 0007. Juga ada versi `be79b21cfad0` yang tidak mengikuti skema penamaan.

**→ RESOLVED 2026-07-09**: SQUASHED 0001-0007 + be79b21cfad0 into single 0001 baseline (`5d1a842`).

#### [SEDANG] Vector Dimension Hardcoded di Model

`backend/app/models/models.py:127`: `embedding = Column(Vector(384), nullable=False)`

Jika model diganti, dimensi vector harus diubah manual di sini dan di migration. Seharusnya mengambil dari `settings.embedding_dim`.

#### [SEDANG] .env Duplikasi dan Konfigurasi Tersebar

- Root `.env` — ada
- `backend/.env` — **TIDAK ADA** (backend Docker bergantung pada `./backend/.env` di docker-compose)
- `backend/.env.example` — ada tapi sangat minimal
- `docker-compose.yml` line `env_file: ./backend/.env` — file tidak ada, container akan warning/error

#### [RENDAH] Celery Broker vs Backend Redis DB Berbeda

`config.py:18-19`: Celery broker di `redis://localhost:6379/1`, backend di `redis://localhost:6379/2`
Root `.env:6-8`: Semua di `redis://localhost:6379/0`
**Tidak konsisten**, tapi Redis DB berbeda bukan masalah besar.

### 4.2 Masalah Backend Code

#### [KRITIS] `sqlalchemy_echo=True` di Debug Mode

`backend/app/core/database.py:8`:
```python
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,  # <-- INI PENYEBAB LOG SQL BANJIR
    pool_size=20,
    max_overflow=10,
)
```

**Dampak**: Setiap SQL query di-log verbatim ke stdout. Ini penyebab utama "banyak error pada log keluar sql" yang Anda sebutkan. Bukan error, tapi SQL logging.

**Fix**: Set `echo=False` di production, atau ganti ke `echo=settings.debug_sql` untuk kontrol lebih granular.

#### [TINGGI] Rate Limiter Terlalu Agresif (10/minute)

`backend/app/api/search.py:18`: `@limiter.limit("10/minute")`

**Dampak**: User hanya bisa search 10 kali per menit dari IP yang sama. Testing jadi sangat menyebalkan. Untuk development, seharusnya lebih longgar.

**Fix**: Pakai environment variable untuk rate limit, atau set default lebih tinggi (60/minute).

**→ RESOLVED 2026-07-09**: Raised to `60/minute` + proxy-aware key func (`6c35e01`).

#### [SEDANG] Global Exception Handler Akan Return 500 untuk Semua Error

`backend/app/main.py:45-54`:
```python
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, ...)
```

**Dampak**: HTTPException (404, 422, dll) akan tertangkap dan return 500, bukan status code yang sesuai. Karena ExceptionHandler harus spesifik atau menggunakan FastAPI built-in.

**Fix**: Register exception handler spesifik, atau hapus global handler dan andalkan FastAPI default.

#### [SEDANG] Search Query Tidak Handle Arabic Text di BM25

`backend/app/services/search.py`: Query hanya menggunakan pure vector search. **Tidak ada hybrid BM25 + vector** seperti yang direncanakan di dokumentasi.

**Dampak**: Exact match keyword Arabic (misal: "آية الكرسي") mungkin tidak muncul di top results jika tidak secara semantik dekat.

#### [SEDANG] CORS Origins. Tidak Valid untuk Multi-env

`backend/app/core/config.py:23`: `cors_origins: str = "http://localhost:3000"`
`backend/app/main.py:59`: `allow_origins=settings.cors_origins.split(",")`

**Dampak**: Di production, origin Vercel domain tidak include. Tapi ini bisa di-set via env variable.

#### [RENDAH] `took_ms` di SearchResponse Selalu 0 Awal

`backend/app/services/search.py:217`: `took_ms=0` — nilai akhir di-set di API layer, jadi sebenarnya OK, tapi bisa di-refactor.

#### [RENDAH] ThreadPoolExecutor Tidak Properly Graceful Shutdown

`backend/app/services/embedding.py:48`: `_executor = ThreadPoolExecutor(max_workers=1)` — global variable, tidak pernah di-shutdown.

### 4.3 Masalah Data & Ingestion

#### [TINGGI] Hadith Books Table Kosong

`data/scripts/ingest.py`: Fungsi `ingest_hadith()` tidak mengisi tabel `hadith_books`. Field `chapter_id` di hadith diset NULL untuk semua record.

**Dampak**: Fitur browse by book tidak berfungsi untuk hadith.

#### [SEDANG] Hadith Collection name_ar Kosong

`data/scripts/ingest.py`: `HADITH_COLLECTIONS_ID` tidak memiliki `name_ar` yang valid untuk setiap koleksi.

**Dampak**: Response API hadith collection memiliki field `name_ar: ""`.

#### [SEDANG] Tidak Ada Validasi Arab Text Encoding

Ingestion script tidak memvalidasi bahwa Arabic text yang di-parse adalah UTF-8 valid (BOM, mojibake, dll). Data dari file JSON bisa corrupt.

#### [RENDAH] Embedding Tidak Otomatis Setelah Ingestion

Tidak ada Celery trigger setelah `python ingest.py all`. Harus manual menjalankan `embed_bulk.py` atau via Celery.

### 4.4 Masalah Frontend

#### [SEDANG] Search Pagination Reset Source Filter

`frontend/src/routes/search.tsx`: State `selectedSources` dan `page` di-reset ketika query berubah di URL, tapi tidak ada persistensi ke URL params.

**Dampak**: Share link search tidak bisa preserve filter.

#### [SEDANG] Tidak Ada Error Boundary

Tidak ada React Error Boundary yang wrap komponen. Jika fetch gagal, error bisa merusak halaman.

#### [RENDAH] TanStack Router Validation Tidak Strict

`frontend/src/routes/search.tsx:325-327`: `validateSearch` hanya return `q`, tidak validasi tipe.

#### [RENDAH] Loading States Minimal

Halaman Quran, Hadith, dan Search hanya menampilkan "Loading..." tanpa skeleton yang proper.

### 4.5 Masalah Testing & CI

#### [SEDANG] Unit Tests Sangat Minimal

`backend/tests/`: Hanya 4 test files dengan total ~10 test:
- `test_search_service.py`: 7 tests — OK
- `test_embedding_tasks.py`: 6 tests — OK
- `test_hadith_browse.py`: 2 tests — OK
- `test_stats.py`: 1 test — OK

**Tidak ada test untuk:**
- API endpoints (integration tests)
- Embedding service
- Ingestion pipeline
- Search quality
- Frontend components

#### [RENDAH] Tidak Ada CI Pipeline

`.github/`: Folder ada tapi tidak ada workflow CI yaml. Tidak ada GitHub Actions untuk lint/test/typecheck.

#### [RENDAH] Test Hadith Menggunakan File Reading dari App Source

`backend/tests/test_hadith_browse.py:4`: `source = Path("app/api/hadith.py").read_text()` — test membaca source code langsung, bukan dari module. Fragile.

### 4.6 Masalah DevOps

#### [SEDANG] Frontend Dockerfile.dev Mount Semua Node_modules

`docker-compose.yml`: `volumes: ./frontend:/app` + `- /app/node_modules` — ini pattern yang OK tapi bisa slow di macOS/Windows.

#### [RENDAH] Tidak Ada Healthcheck untuk Backend di Docker

Frontend depends on backend tanpa healthcheck. Jika backend crash, frontend tetap jalan tapi semua API gagal.

#### [RENDAH] Tidak Ada Production Dockerfile

`backend/Dockerfile` dan `frontend/Dockerfile.dev` — hanya untuk development. Production perlu multi-stage build, image optimization, dll.

**→ RESOLVED 2026-07-09**: `Dockerfile.prod` multi-stage (venv, non-root, gunicorn --preload -w 2) + `.dockerignore` (`5b5be64`). docker-compose.prod.yml with mem_limit, internal network, certbot (`20f0258`).

### 4.7 Masalah Keamanan

#### [SEDANG] CORS Allow All Methods & Headers

`main.py:76-82`: `allow_methods=["*"], allow_headers=["*"]` — cukup longgar. Harus disesuaikan.

**→ RESOLVED 2026-07-09**: Scoped to `allow_methods=["GET"]`, `allow_headers=["Content-Type", "Accept"]`, and origins from config. Prod startup rejects wildcard with `allow_credentials=True` (`main.py:29-30`).

#### [RENDAH] Debug=True di Default Config

`config.py:26`: `debug: bool = False` — di production, debug harus false. Validator prevents debug=True + env=production.

**→ RESOLVED 2026-07-09**: Default changed to `False` (`config.py:26`). Validator raises `ValueError` if debug=true in production (`config.py:36-38`). Exception handler never leaks detail to client (`main.py:65-73`).

#### [RENDAH] No Rate-Limit Middleware (sebelumnya)

**→ RESOLVED 2026-07-09**: `SlowAPIMiddleware` added (`main.py:48`). Proxy-aware key func uses XFF first hop (`6c35e01`).

#### [RENDAH] No SSL Termination (sebelumnya)

**→ RESOLVED 2026-07-09**: nginx reverse proxy + Certbot + Let's Encrypt TLS in docker-compose.prod.yml (`20f0258`).

#### [RENDAH] Celery — No Time / Task Limits (sebelumnya)

**→ RESOLVED 2026-07-09**: `task_time_limit=300`, `task_soft_time_limit=240`, `task_acks_late=True`, `worker_max_tasks_per_child=100`, `result_expires=3600` (`e4475cc`).

#### [RENDAH] Public DB / Redis Ports (sebelumnya)

**→ RESOLVED 2026-07-09**: Prod docker-compose places db + redis on internal network only; no port exposure (`20f0258`).

#### [RENDAH] No Backup Plan (sebelumnya)

**→ RESOLVED 2026-07-09**: `pg_dump` cron documented in `deploy/README.md`; retention 14d local + 90d remote.

#### [RENDAH] DevTools in Production Dependencies (sebelumnya)

**→ RESOLVED 2026-07-09**: `@tanstack/router-devtools` moved to `devDependencies` (`819ef10`).

---

## 5. Rekomendasi Perbaikan (Prioritas)

### Priority 1: Critical — Harus Sekarang

| # | Task | File Lokasi | Dampak |
|---|------|-------------|--------|
| 1 | Matikan SQL echo di production | `database.py:8` | SQL log banjir berhenti |
| 2 | Fix rate limit untuk development | `search.py:18` | Testing jadi lebih mudah |
| 3 | Sync dokumentasi model | `docs/TECH.md`, `PIPELINE.md` | Developer tidak bingung |
| 4 | Buat `backend/.env` | Root `.env` | Docker backend bisa jalan |
| 5 | Fix global exception handler | `main.py:45-54` | HTTPException tidak jadi 500 |

### Priority 2: High — Minggu Ini

| # | Task | File Lokasi |
|---|------|-------------|
| 1 | Tambah ground truth dataset + eval script | `data/eval/` |
| 2 | Isi hadith_books table + chapter_id | `data/scripts/ingest.py` |
| 3 | Tambah integration tests (API) | `backend/tests/` |
| 4 | Set up GitHub Actions CI | `.github/workflows/` |
| 5 | Fix CORS untuk production | `main.py` |

### Priority 3: Medium — Bulan Ini

| # | Task | File Lokasi |
|---|------|-------------|
| 1 | Implement hybrid search (BM25 + vector) | `services/search.py` |
| 2 | Migrasi ke E5-large (1024-dim) untuk akurasi lebih baik | Multiple files |
| 3 | Tambah Sentry error tracking | `main.py` |
| 4 | Cache search results di Redis | `services/search.py` |
| 5 | Tambah transliteration preprocessing | `services/search.py` |

### Priority 4: Nice-to-have

| # | Task | File Lokasi |
|---|------|-------------|
| 1 | Auto-trigger Celery setelah ingestion | `ingest.py` |
| 2 | Frontend error boundaries | `routes/__root.tsx` |
| 3 | Better loading skeletons | `routes/search.tsx` |
| 4 | Prometheus metrics | `main.py` |
| 5 | Production Dockerfiles | `Dockerfile.prod` |

---

## 6. Rekomendasi untuk Evaluasi Search Quality

### Langkah-langkah konkret:

1. **Buat file `data/eval/ground_truth.json`** dengan 50-100 queries:
   ```json
   [
     {"q": "patience in islam", "q_en": "", "q_ar": "الصبر في الإسلام", "relevant_quran": ["2:153", "3:200"], "relevant_hadith": ["bukhari:1"]},
     {"q": "kindness to parents", "q_ar": "بر الوالدين", "relevant_quran": ["17:23", "31:14", "46:15"]}
   ]
   ```

2. **Buat script evaluasi** (`backend/app/evaluation.py`):
   ```python
   async def evaluate():
       results = []
       for item in ground_truth:
           response = await semantic_search(db, item["q"], limit=10)
           found_quran = any(r.source_id in item["relevant_quran"] for r in response.results)
           results.append({"query": item["q"], "recall@10": found_quran})
       return results
   ```

3. **Buat test suite reguler** yang jalan setiap ada perubahan model/data

4. **Monitor secara kontinu**: Log query + relevance scores untuk feedback loop

---

## 7. Ringkasan Status Proyek

| Area | Status | Grade |
|------|--------|-------|
| Project setup & infra | Functional tapi banyak config error | C |
| Data ingestion | Bisa jalan, tapi tidak lengkap (books kosong) | C |
| Embedding pipeline | Functional, idempotent | B |
| Search API | Functional, basic semantic search | B |
| Search quality | Belum terukur (no evaluation) | D |
| Frontend | Functional, basic CRUD | B |
| Testing | Sangat minimal | D |
| Documentation | Outdated vs realitas | D |
| DevOps | Dev-only, no CI/CD | D |
| Security | Basic, beberapa celah | C |

**Overall: C — Bisa jalan tapi banyak yang perlu diperbaiki**