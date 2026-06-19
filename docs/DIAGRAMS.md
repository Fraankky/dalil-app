# Dalil App — System Flow Diagrams

---

## DIAGRAM 1: System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              DALIL APP — SYSTEM ARCHITECTURE                       │
└──────────────────────────────────────────────────────────────────────────────────┘

                                    INTERNET
                                       │
                            ┌──────────┴──────────┐
                            │     DNS / Domain     │
                            │   (dalil.app)        │
                            └──────────┬──────────┘
                                       │
                            ┌──────────┴──────────┐
                            │    Reverse Proxy     │
                            │   (Nginx / Caddy)    │
                            └──────┬───────┬──────┘
                                   │       │
                    ┌──────────────┘       └──────────────┐
                    ▼                                     ▼
    ┌──────────────────────────────┐    ┌──────────────────────────────┐
    │       FRONTEND (port 3000)   │    │       BACKEND (port 8000)    │
    │                              │    │                              │
    │  ┌────────────────────────┐  │    │  ┌────────────────────────┐  │
    │  │   Vite Dev Server    │  │    │  │   FastAPI Application  │  │
    │  │   HMR · Proxy · RTL   │  │    │  │   Uvicorn · Async      │  │
    │  └───────────┬────────────┘  │    │  └───────────┬────────────┘  │
    │              │               │    │              │               │
    │  ┌───────────▼────────────┐  │    │  ┌───────────▼────────────┐  │
    │  │  TanStack Router       │  │    │  │  API Routers           │  │
    │  │  ┌──────┐ ┌─────────┐  │  │    │  │  /search   /quran      │  │
    │  │  │  /   │ │ /search │  │  │    │  │  /hadith   /stats      │  │
    │  │  ├──────┤ ├─────────┤  │  │    │  └───────────┬────────────┘  │
    │  │  │/quran│ │ /hadith │  │    │  │              │               │
    │  │  └──────┘ └─────────┘  │  │    │  ┌───────────▼────────────┐  │
    │  └────────────────────────┘  │    │  │  Services              │  │
    │              │               │    │  │  ┌──────────────────┐   │  │
    │  ┌───────────▼────────────┐  │    │  │  │ EmbeddingService │   │  │
    │  │  React Components      │  │    │  │  │ (SentenceTF)     │   │  │
    │  │  · SearchBar           │  │    │  │  ├──────────────────┤   │  │
    │  │  · ResultCard          │  │    │  │  │ SearchService    │   │  │
    │  │  · LoadingSkeleton     │  │    │  │  │ (pgvector)       │   │  │
    │  │  · SourceBadge         │  │    │  │  └──────────────────┘   │  │
    │  └────────────────────────┘  │    │  └────────────────────────┘  │
    └──────────────────────────────┘    └──────────┬───────────┬───────┘
                                                   │           │
                                        ┌──────────┘           └──────────┐
                                        ▼                                 ▼
                        ┌────────────────────────────┐   ┌────────────────────────────┐
                        │     PostgreSQL 16          │   │     Redis 7                │
                        │     + pgvector             │   │                            │
                        │                            │   │  ┌──────────────────────┐  │
                        │  ┌──────────────────────┐  │   │  │ Cache (query results)│  │
                        │  │ Relational Data      │  │   │  │ TTL: 1 jam           │  │
                        │  │ · surahs (114)       │  │   │  └──────────────────────┘  │
                        │  │ · verses (6,236)     │  │   │                            │
                        │  │ · hadith (~17,000)   │  │   │  ┌──────────────────────┐  │
                        │  │ · collections        │  │   │  │ Celery Broker        │  │
                        │  └──────────────────────┘  │   │  │ (task queue)         │  │
                        │                            │   │  └──────────────────────┘  │
                        │  ┌──────────────────────┐  │   │                            │
                        │  │ Vector Index         │  │   │  ┌──────────────────────┐  │
                        │  │ · embeddings table   │  │   │  │ Rate Limiter         │  │
                        │  │ · HNSW index         │  │   │  │ (middleware)         │  │
                        │  │ · cosine_ops         │  │   │  └──────────────────────┘  │
                        │  │ · ~25k vectors       │  │   │                            │
                        │  │ · ~200 MB total      │  │   └────────────────────────────┘
                        │  └──────────────────────┘  │
                        └────────────────────────────┘
                                        │
                            ┌───────────┴───────────┐
                            │   Celery Workers (2)   │
                            │                        │
                            │  Worker 1:             │
                            │  · Embedding generation│
                            │  · Batch processing    │ ───► Redis ───► Model GPU/CPU
                            │                        │
                            │  Worker 2:             │
                            │  · Data ingestion      │
                            │  · Index maintenance   │
                            └────────────────────────┘
                                        │
                            ┌───────────┴───────────┐
                            │   HuggingFace Hub      │
                            │   ─────────────────    │
                            │   multilingual-e5-large│
                            │   1024-dim, 560M params│
                            │   ~2.2 GB model        │
                            └────────────────────────┘
```

**Penjelasan Diagram 1 — Arsitektur Sistem**

1. **Traffic masuk** melalui domain → reverse proxy (Nginx/Caddy) → diarahkan ke Frontend (Port 3000) atau Backend (Port 8000)

2. **Frontend (React + Vite + TanStack Router)**:
   - Vite dev server menyediakan HMR (Hot Module Replacement) dan proxy API ke backend
   - TanStack Router mengelola 4 route: `/`, `/search`, `/quran`, `/hadith`
   - React components murni presentasi, semua data dari API calls

3. **Backend (FastAPI)**:
   - 4 API routers: search, quran, hadith, stats
   - 2 core services: `EmbeddingService` (model SentenceTransformer) dan `SearchService` (pgvector query)
   - Async I/O (Uvicorn + SQLAlchemy async) untuk throughput tinggi

4. **PostgreSQL + pgvector** — Database tunggal untuk 2 kebutuhan:
   - **Relational**: tabel `surahs`, `verses`, `hadith`, `hadith_books`, `hadith_collections`
   - **Vector**: tabel `embeddings` dengan HNSW index untuk ANN search
   - Dipisah agar JOIN ambil detail teks tidak ikut membaca vector yang besar

5. **Redis** — 3 peran:
   - **Cache**: hasil query yang sering muncul (TTL 1 jam)
   - **Broker**: antrian task untuk Celery workers
   - **Rate limiter**: mencegah abuse API

6. **Celery Workers** — 2 worker process:
   - Worker 1: generate embedding (batch 32, model inference ~100ms/batch)
   - Worker 2: data ingestion, index maintenance

7. **Model** — `multilingual-e5-large-instruct`:
   - 1024 dimensi, 100+ bahasa termasuk Arab dan Inggris
   - Disimpan di HuggingFace cache, di-load saat startup FastAPI (lifespan event)

---

## DIAGRAM 2: Data Pipeline — Phase 1 (Ingestion)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                         DATA PIPELINE — FASE 1: INGESTION                             │
└──────────────────────────────────────────────────────────────────────────────────────┘

    ╔═══════════════════╗     ╔═══════════════════╗     ╔═══════════════════════╗
    ║  TANZIL.NET       ║     ║  SUNNAH.COM API   ║     ║  OPEN HADITH DATASET ║
    ║  ─────────        ║     ║  ─────────────    ║     ║  ───────────────────  ║
    ║  Quran text       ║     ║  Hadith + trans.   ║     ║  Bukhari, Muslim,    ║
    ║  Uthmani script   ║     ║  Rate limited      ║     ║  Riyad, Nawawi       ║
    ║  CC BY-ND 3.0     ║     ║  JSON API          ║     ║  CC / Open License   ║
    ╚═══════╤═══════════╝     ╚═══════╤═══════════╝     ╚═══════════╤═══════════╝
            │                         │                            │
            │  quran.json             │  hadith-bukhari.json       │  hadith-muslim.json
            │  (6236 verses)          │  (~7563 hadith)            │  (~7563 hadith)
            │                         │                            │
            └─────────────┬───────────┴──────────────┬─────────────┘
                          │                          │
                          ▼                          ▼
            ┌─────────────────────────────────────────────────────┐
            │             INGESTION SCRIPT (ingest.py)             │
            │                                                     │
            │  ┌─────────────────────────────────────────────┐    │
            │  │ Step 1: Parse & Validate                     │    │
            │  │  · Parse JSON / fetch API                    │    │
            │  │  · Validasi struktur: field wajib ada        │    │
            │  │  · Validasi count: 6236 verses, 114 surahs   │    │
            │  │  · Deteksi encoding issues (arabic chars)    │    │
            │  └──────────────────┬──────────────────────────┘    │
            │                     │                               │
            │  ┌──────────────────▼──────────────────────────┐    │
            │  │ Step 2: Normalize Text                       │    │
            │  │  · Unicode NFKC normalization               │    │
            │  │  · Strip optional diacritics (opsional)     │    │
            │  │  · Standardize spacing (tashkeel normal)    │    │
            │  │  · Generate SHA-256 hash per teks           │    │
            │  └──────────────────┬──────────────────────────┘    │
            │                     │                               │
            │  ┌──────────────────▼──────────────────────────┐    │
            │  │ Step 3: Bulk Insert PostgreSQL               │    │
            │  │  · INSERT surahs (114 rows)                  │    │
            │  │  · INSERT verses (6236 rows)                 │    │
            │  │  · INSERT collections (5 rows)               │    │
            │  │  · INSERT books (~200 rows)                  │    │
            │  │  · INSERT hadith (~17000 rows)               │    │
            │  │  · Gunakan batch insert (500/batch)          │    │
            │  │  · Transaction: ALL OR NOTHING               │    │
            │  └──────────────────┬──────────────────────────┘    │
            │                     │                               │
            │  ┌──────────────────▼──────────────────────────┐    │
            │  │ Step 4: Verify & Log                         │    │
            │  │  · SELECT COUNT(*) untuk setiap tabel        │    │
            │  │  · Cek referential integrity                │    │
            │  │  · Log statistik ingestion                  │    │
            │  │  · Trigger Celery task → embed generation   │    │
            │  └─────────────────────────────────────────────┘    │
            └──────────────────────┬──────────────────────────────┘
                                   │
                                   ▼
            ┌─────────────────────────────────────────────────────┐
            │                 PostgreSQL (DATA RELASIONAL)         │
            │                                                     │
            │  surahs                     verses                  │
            │  ┌────┬──────────┬──────┐  ┌──────┬────┬────┬─────┐ │
            │  │ id │ name_ar  │ type │  │  id  │sura│v_no│text │ │
            │  ├────┼──────────┼──────┤  ├──────┼────┼────┼─────┤ │
            │  │  1 │ الفاتحة  │Mec││  │   1  │  1 │  1 │بسم..││
            │  │  2 │ البقرة   │Med  │  │   2  │  1 │  2 │الحم│ │
            │  │ ...│ ...      │ ... │  │  ... │ ...│ ...│ ... │ │
            │  │ 114│ الناس    │Mec││  │ 6236 │114 │  6 │من ش│ │
            │  └────┴──────────┴──────┘  └──────┴────┴────┴─────┘ │
            │                                                     │
            │  hadith_collections       hadith                    │
            │  ┌────┬──────────┬──────┐ ┌──────┬────┬───────────┐ │
            │  │ id │ name_eng │ slug │ │  id  │coll│ text_ar   │ │
            │  ├────┼──────────┼──────┤ ├──────┼────┼───────────┤ │
            │  │  1 │ Bukhari  │bukh..│ │   1  │  1 │حدثنا الح..│ │
            │  │  2 │ Muslim   │muslim│ │   2  │  1 │حدثنا عبد..│ │
            │  └────┴──────────┴──────┘ │  ... │ ...│ ...       │ │
            │                           └──────┴────┴───────────┘ │
            └──────────────────────┬──────────────────────────────┘
                                   │
                          ┌────────┴────────┐
                          │  CELERY TASK    │
                          │  generate_      │
                          │  embeddings     │
                          │  di-trigger     │
                          │  otomatis       │
                          └────────┬────────┘
                                   │
                                   ▼
                        (lanjut ke Diagram 3)
```

**Penjelasan Diagram 2 — Fase Ingestion**

1. **3 sumber data** didownload secara manual (atau via API untuk Sunnah.com):
   - **Tanzil.net**: File JSON Quran lengkap — 1 file, 6236 ayat, teks Uthmani + terjemahan
   - **Sunnah.com API**: Rate limited (1 req/detik), output JSON per collection
   - **Open Hadith Datasets**: Repo GitHub `hadith-api` atau `islamic-dataset` — file JSON

2. **Script ingestion** (Python) menjalankan 4 langkah berurutan:
   - **Parse & Validate**: Pastikan struktur JSON valid, field wajib ada, jumlah record benar
   - **Normalize**: Unicode NFKC, strip diacritics opsional, hitung SHA-256
   - **Bulk Insert**: Batch 500 row per transaksi, dengan `ON CONFLICT DO NOTHING` untuk idempotency
   - **Verify & Trigger**: COUNT validasi, lalu kirim Celery task `generate_embeddings.delay()`

3. **Hasil**: ~25.000 row di tabel relasional siap untuk embedding

---

## DIAGRAM 3: Data Pipeline — Phase 2 (Embedding Generation)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                    DATA PIPELINE — FASE 2: EMBEDDING GENERATION                       │
└──────────────────────────────────────────────────────────────────────────────────────┘

    Celery beat/task triggered
    setelah ingestion selesai
            │
            ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                   CELERY WORKER — generate_embeddings()         │
    │                                                                 │
    │  ┌─────────────────────────────────────────────────────────┐   │
    │  │ INIT: Load Model                                         │   │
    │  │                                                          │   │
    │  │   from sentence_transformers import SentenceTransformer  │   │
    │  │   model = SentenceTransformer(                           │   │
    │  │       "intfloat/multilingual-e5-large-instruct"          │   │
    │  │   )                                                      │   │
    │  │   # Download model dari HuggingFace (pertama kali)       │   │
    │  │   # Cache di: /root/.cache/huggingface/                  │   │
    │  │   # Ukuran model: ~2.2 GB                                │   │
    │  │   # Device: CUDA jika GPU tersedia, else CPU             │   │
    │  └──────────────────────┬──────────────────────────────────┘   │
    │                         │                                      │
    │  ┌──────────────────────▼──────────────────────────────────┐   │
    │  │ FETCH: Ambil teks yang belum di-embed                     │   │
    │  │                                                           │   │
    │  │   SELECT v.id, v.text_arabic                              │   │
    │  │   FROM verses v                                           │   │
    │  │   LEFT JOIN embeddings e                                  │   │
    │  │     ON e.source_type = 'quran' AND e.source_id = v.id    │   │
    │  │   WHERE e.id IS NULL   ← anti-join, hanya yang belum     │   │
    │  │   ORDER BY v.id                                          │   │
    │  │                                                           │   │
    │  │   → Hasil: 6236 teks arabic ayat Quran                    │   │
    │  │   → (kemudian 17000 teks hadith)                          │   │
    │  └──────────────────────┬──────────────────────────────────┘   │
    │                         │                                      │
    │  ┌──────────────────────▼──────────────────────────────────┐   │
    │  │ PROCESS: Batch encoding (32 teks per batch)              │   │
    │  │                                                           │   │
    │  │   FOR i in range(0, total, BATCH_SIZE=32):                │   │
    │  │                                                           │   │
    │  │     batch = rows[i : i+32]                               │   │
    │  │                                                           │   │
    │  │     # Tambahkan prefix "passage: "                        │   │
    │  │     texts = [                                            │   │
    │  │       f"passage: {r.text_arabic}"                        │   │
    │  │       for r in batch                                     │   │
    │  │     ]                                                     │   │
    │  │                                                           │   │
    │  │     # Generate embeddings (model inference)                │   │
    │  │     vectors = model.encode(                              │   │
    │  │         texts,                                            │   │
    │  │         normalize_embeddings=True  ← L2 norm = 1.0       │   │
    │  │     )                                                     │   │
    │  │     # vectors.shape = (32, 1024)                          │   │
    │  │                                                           │   │
    │  └──────────────────────┬──────────────────────────────────┘   │
    │                         │                                      │
    │  ┌──────────────────────▼──────────────────────────────────┐   │
    │  │ INSERT: Simpan vectors ke PostgreSQL                     │   │
    │  │                                                           │   │
    │  │   FOR (source_id, text), vec IN zip(batch, vectors):     │   │
    │  │                                                           │   │
    │  │     INSERT INTO embeddings (                              │   │
    │  │         source_type,    -- 'quran' | 'hadith'            │   │
    │  │         source_id,      -- verse.id | hadith.id          │   │
    │  │         embedding,      -- vector(1024)                   │   │
    │  │         text_hash,      -- SHA-256                        │   │
    │  │         model_version   -- "multilingual-e5-large"       │   │
    │  │     )                                                     │   │
    │  │     ON CONFLICT DO NOTHING;  ← idempotent                │   │
    │  │                                                           │   │
    │  │   COMMIT setiap 10 batch (320 teks)                       │   │
    │  │                                                           │   │
    │  └──────────────────────────────────────────────────────────┘   │
    └─────────────────────────────┬───────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
    ┌───────────────────────────┐  ┌───────────────────────────┐
    │  Quran embeddings          │  │  Hadith embeddings        │
    │  6,236 vectors × 4 KB     │  │  ~17,000 vectors × 4 KB  │
    │  = ~25 MB                  │  │  = ~68 MB                 │
    └───────────────┬───────────┘  └───────────────┬───────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
    ┌─────────────────────────────────────────────────────────────┐
    │               PostgreSQL: tabel embeddings                   │
    │                                                             │
    │  ┌────┬───────┬───────────┬──────────────────┬────────────┐ │
    │  │ id │ type  │ source_id │ embedding(V1024) │ text_hash  │ │
    │  ├────┼───────┼───────────┼──────────────────┼────────────┤ │
    │  │  1 │ quran │     1     │ [0.03,-0.12,...] │ sha256_a.. │ │
    │  │  2 │ quran │     2     │ [0.04,-0.11,...] │ sha256_b.. │ │
    │  │ ...│ ...   │    ...    │      ...         │ ...        │ │
    │  │6237│ hadith│     1     │ [0.01,-0.09,...] │ sha256_c.. │ │
    │  │ ...│ ...   │    ...    │      ...         │ ...        │ │
    │  └────┴───────┴───────────┴──────────────────┴────────────┘ │
    │                                                             │
    │  + HNSW INDEX (dibuat setelah semua embedding tersimpan)     │
    │    CREATE INDEX ON embeddings                                │
    │    USING hnsw (embedding vector_cosine_ops)                  │
    │    WITH (m = 16, ef_construction = 200);                     │
    │                                                             │
    │    Index size: ~120 MB (graph overhead + vectors)           │
    │    Build time: ~30 detik untuk 25k vectors                  │
    │    Search perf: ~2ms per query (ANN, ef_search=100)         │
    └─────────────────────────────────────────────────────────────┘
```

**Penjelasan Diagram 3 — Embedding Generation**

1. **Celery Worker** menerima task `generate_embeddings(source_type="quran")` atau `generate_embeddings(source_type="hadith")`

2. **Load Model**: SentenceTransformer di-load dari HuggingFace cache. Download pertama kali (~2.2 GB). Setelah itu instant dari cache.

3. **Fetch**: Query SQL hanya mengambil teks yang **belum** memiliki embedding (anti-join dengan tabel embeddings). Ini membuat task **idempotent** — bisa di-restart tanpa duplikasi.

4. **Batch Encoding**: 
   - Setiap batch 32 teks diproses bersamaan (GPU utilization optimal)
   - Prefix `"passage: "` ditambahkan (**WAJIB** untuk model E5 — tanpa ini akurasi turun 20-30%)
   - Output: array NumPy (32, 1024) dengan L2 norm = 1.0

5. **Insert**: Setiap vector disimpan ke tabel `embeddings` dengan metadata (source_type, source_id, text_hash, model_version). `ON CONFLICT DO NOTHING` mencegah duplikasi.

6. **HNSW Index**: Dibangun setelah semua vector tersimpan. Parameter:
   - `m=16`: setiap node terkoneksi ke 16 tetangga per layer
   - `ef_construction=200`: kualitas index (makin besar = makin akurat, makin lambat build)

---

## DIAGRAM 4: Search Flow — User Query to Result

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                      SEARCH FLOW — DARI QUERY USER KE HASIL                          │
└──────────────────────────────────────────────────────────────────────────────────────┘

    USER
     │
     │  Mengetik: "what does Islam say about patience"
     │  di Browser (http://dalil.app/search?q=what+does+islam+say+about+patience)
     │
     ▼
    ╔══════════════════════════════════════════════════════════════════════╗
    ║                         CLIENT (Browser)                             ║
    ║                                                                      ║
    ║  1. User submit query                                                ║
    ║  2. TanStack Router: navigate({ to: "/search", search: { q } })     ║
    ║  3. useEffect → fetchSearch({ q })                                   ║
    ║  4. fetch("/api/v1/search?q=what+does+islam+say+about+patience")    ║
    ║     ↓ (Vite proxy: /api → localhost:8000)                            ║
    ╚══════════════════════╤═══════════════════════════════════════════════╝
                           │  HTTP GET /api/v1/search?q=...
    ╔══════════════════════╧═══════════════════════════════════════════════╗
    ║                    BACKEND: FastAPI (/api/v1/search)                 ║
    ║                                                                      ║
    ║  ┌─────────────────────────────────────────────────────────────┐    ║
    ║  │ STEP 1: Query Preprocessing                                  │    ║
    ║  │                                                              │    ║
    ║  │  Input: "what does Islam say about patience"                 │    ║
    ║  │                                                              │    ║
    ║  │  1a. Unicode Normalization (NFKC)                            │    ║
    ║  │      "what does Islam say about patience"                    │    ║
    ║  │      → tetap sama (sudah ASCII)                              │    ║
    ║  │                                                              │    ║
    ║  │  1b. Language Detection                                       │    ║
    ║  │      Arabic chars: 0 | Latin chars: 34                       │    ║
    ║  │      → detected: "en"                                        │    ║
    ║  │                                                              │    ║
    ║  │  1c. (Optional) Transliteration → Arabic                      │    ║
    ║  │      Jika input: "sabr" → "صبر"                              │    ║
    ║  │      Tidak perlu untuk input ini                              │    ║
    ║  └──────────────────────┬──────────────────────────────────────┘    ║
    ║                         │                                          ║
    ║  ┌──────────────────────▼──────────────────────────────────────┐   ║
    ║  │ STEP 2: Generate Query Embedding                             │   ║
    ║  │                                                               │   ║
    ║  │  Text: "query: what does Islam say about patience"           │   ║
    ║  │         ^^^^^^^ prefix Wajib untuk model E5                  │   ║
    ║  │                                                               │   ║
    ║  │  ┌─────────────────────────────────────────────────────┐     │   ║
    ║  │  │         SentenceTransformer Model                    │     │   ║
    ║  │  │                                                     │     │   ║
    ║  │  │   Text → Tokenizer → 512 tokens                     │     │   ║
    ║  │  │                   → 12 Transformer layers            │     │   ║
    ║  │  │                   → Mean Pooling                     │     │   ║
    ║  │  │                   → L2 Normalize                     │     │   ║
    ║  │  │                   → vector[1024]                     │     │   ║
    ║  │  │                                                     │     │   ║
    ║  │  │  Output: [0.034, -0.120, 0.672, ..., 0.015]       │     │   ║
    ║  │  │          (1024 float32 numbers, ||v|| = 1.0)        │     │   ║
    ║  │  └─────────────────────────────────────────────────────┘     │   ║
    ║  │                                                               │   ║
    ║  │  Inference time: ~30ms (CPU) | ~5ms (GPU)                    │   ║
    ║  └──────────────────────┬──────────────────────────────────────┘   ║
    ║                         │                                          ║
    ║  ┌──────────────────────▼──────────────────────────────────────┐   ║
    ║  │ STEP 3: Vector Similarity Search (pgvector HNSW)            │   ║
    ║  │                                                               │   ║
    ║  │  SQL Query:                                                   │   ║
    ║  │                                                               │   ║
    ║  │  WITH query_vec AS (                                          │   ║
    ║  │      SELECT '[0.034, -0.120, ...]'::vector AS vec             │   ║
    ║  │  )                                                            │   ║
    ║  │  SELECT                                                       │   ║
    ║  │      e.source_type,                                          │   ║
    ║  │      e.source_id,                                            │   ║
    ║  │      1 - (e.embedding <=> qv.vec) AS cosine_similarity       │   ║
    ║  │  FROM embeddings e, query_vec qv                              │   ║
    ║  │  WHERE e.source_type IN ('quran', 'hadith')                  │   ║
    ║  │    AND 1 - (e.embedding <=> qv.vec) >= 0.3  ← min score     │   ║
    ║  │  ORDER BY e.embedding <=> qv.vec       ← cosine distance     │   ║
    ║  │  LIMIT 100;                             ← candidates         │   ║
    ║  │                                                               │   ║
    ║  │  Operator <=> = cosine distance (pgvector)                    │   ║
    ║  │  Cosine similarity = 1 - distance                            │   ║
    ║  │                                                               │   ║
    ║  │  HNSW Index — Navigasi Graph:                                │   ║
    ║  │                                                               │   ║
    ║  │       Layer 2 (sparse)                                       │   ║
    ║  │         ●───●                                                │   ║
    ║  │        /     \         1. Masuk dari entry-point (●)         │   ║
    ║  │       ●───●───●        2. Cari tetangga terdekat            │   ║
    ║  │      /         \       3. Turun ke layer 1                  │   ║
    ║  │     ●───●───●───●      4. Ulangi greedy search              │   ║
    ║  │    / \ / \ / \ / \     5. Di layer 0: exact scan di         │   ║
    ║  │   ●───●───●───●───●      neighborhood terdekat              │   ║
    ║  │   Layer 0 (dense)                                            │   ║
    ║  │                                                               │   ║
    ║  │  Kompleksitas: O(log N) — ~2ms untuk 25k vectors            │   ║
    ║  │  (vs O(N) linear scan ~50ms tanpa index)                     │   ║
    ║  └──────────────────────┬──────────────────────────────────────┘   ║
    ║                         │                                          ║
    ║                         │ Top-100 candidates (oversampled)          │
    ║                         │                                          ║
    ║  ┌──────────────────────▼──────────────────────────────────────┐   ║
    ║  │ STEP 4: Hybrid Re-ranking (future, MVP skip)                │   ║
    ║  │                                                               │   ║
    ║  │  final_score = (                                              │   ║
    ║  │      0.6 × vector_score      ← semantic relevance            │   ║
    ║  │    + 0.3 × bm25_score        ← keyword match                 │   ║
    ║  │    + 0.1 × source_boost      ← quran = 1.0, hadith = 0.95   │   ║
    ║  │  )                                                            │   ║
    ║  │                                                               │   ║
    ║  │  Top-100 → re-rank → Top-20 final results                    │   ║
    ║  └──────────────────────┬──────────────────────────────────────┘   ║
    ║                         │                                          ║
    ║  ┌──────────────────────▼──────────────────────────────────────┐   ║
    ║  │ STEP 5: Response Assembly (JOIN ke tabel sumber)            │   ║
    ║  │                                                               │   ║
    ║  │  SELECT                                                       │   ║
    ║  │      'quran' AS type,                                        │   ║
    ║  │      v.id AS source_id,                                      │   ║
    ║  │      vr.score,                                               │   ║
    ║  │      s.name_english AS surah_name,                          │   ║
    ║  │      s.id AS surah_number,                                   │   ║
    ║  │      v.verse_number,                                         │   ║
    ║  │      v.text_arabic,                                          │   ║
    ║  │      v.text_translation                                      │   ║
    ║  │  FROM vector_results vr                                       │   ║
    ║  │  JOIN verses v ON v.id = vr.source_id                        │   ║
    ║  │  JOIN surahs s ON s.id = v.surah_id                          │   ║
    ║  │  WHERE vr.source_type = 'quran'                              │   ║
    ║  │                                                               │   ║
    ║  │  UNION ALL                                                   │   ║
    ║  │                                                               │   ║
    ║  │  (Query yang sama untuk hadith, JOIN ke tabel hadith)        │   ║
    ║  │                                                               │   ║
    ║  │  ORDER BY score DESC                                         │   ║
    ║  │  LIMIT 20 OFFSET 0;                                          │   ║
    ║  └──────────────────────┬──────────────────────────────────────┘   ║
    ║                         │                                          ║
    ║  ┌──────────────────────▼──────────────────────────────────────┐   ║
    ║  │ STEP 6: Return JSON Response                                 │   ║
    ║  │                                                               │   ║
    ║  │  {                                                            │   ║
    ║  │    "query": "what does Islam say about patience",             │   ║
    ║  │    "query_lang": "en",                                        │   ║
    ║  │    "total": 128,                                              │   ║
    ║  │    "took_ms": 87,                                             │   ║
    ║  │    "results": [                                               │   ║
    ║  │      {                                                        │   ║
    ║  │        "type": "quran",                                       │   ║
    ║  │        "surah_name": "Al-Baqarah",                           │   ║
    ║  │        "surah_number": 2,                                    │   ║
    ║  │        "verse_number": 153,                                  │   ║
    ║  │        "text_arabic": "يَٰٓأَيُّهَا ٱلَّذِينَ...",           │   ║
    ║  │        "text_translation": "O you who have believed, seek    │   ║
    ║  │           help through patience and prayer...",               │   ║
    ║  │        "score": 0.92,                                         │   ║
    ║  │        "relevance": 92                                        │   ║
    ║  │      },                                                       │   ║
    ║  │      ...                                                      │   ║
    ║  │    ]                                                          │   ║
    ║  │  }                                                            │   ║
    ║  └──────────────────────────────────────────────────────────────┘   ║
    ╚══════════════════════════════════════════════════════════════════════╝
                           │  JSON Response
    ╔══════════════════════╧═══════════════════════════════════════════════╗
    ║                         CLIENT (Browser)                             ║
    ║                                                                      ║
    ║  5. React state update: setData(response)                            ║
    ║  6. Render ResultCard[] dengan:                                       ║
    ║     ┌─────────────────────────────────────────────────────┐         ║
    ║     │ [Qur'an]  Al-Baqarah (2:153)              ★ 92%    │         ║
    ║     │ ─────────────────────────────────────────────────── │         ║
    ║     │ يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱسْتَعِينُوا۟   │         ║
    ║     │ بِٱلصَّبْرِ وَٱلصَّلَوٰةِ                       │         ║
    ║     │ ─────────────────────────────────────────────────── │         ║
    ║     │ O you who have believed, seek help through           │         ║
    ║     │ patience and prayer...                              │         ║
    ║     └─────────────────────────────────────────────────────┘         ║
    ║  7. User melihat hasil, klik, scroll, atau refine search             ║
    ╚══════════════════════════════════════════════════════════════════════╝
```

**Penjelasan Diagram 4 — Search Flow**

Diagram di atas menunjukkan perjalanan lengkap 1 query dari browser ke hasil:

| Step | Lokasi | Waktu | Apa yang terjadi |
|---|---|---|---|
| **1** | Browser | ~1ms | User mengetik, TanStack Router navigate ke `/search?q=...`, React useEffect trigger `fetchSearch()` |
| **2** | Browser→Backend | ~20ms | HTTP GET ke FastAPI. Vite proxy forward `/api/*` ke `localhost:8000` |
| **3** | Backend: Preprocess | ~1ms | Unicode normalize, detect language (en/ar) |
| **4** | Backend: Embed | ~30ms | Model SentenceTransformer encode `"query: {teks}"` → vector 1024-dim. **Ini bottleneck utama** |
| **5** | Backend: Search | ~2ms | pgvector HNSW index — cosine distance ANN search pada 25k vectors |
| **6** | Backend: Re-rank | ~5ms | Hybrid scoring: vector(60%) + BM25(30%) + source boost(10%). Top-100 → Top-20 |
| **7** | Backend: Assemble | ~10ms | JOIN ke tabel teks (verses/hadith/surahs) untuk full text + metadata |
| **8** | Backend→Browser | ~20ms | JSON response dikirim. Ukuran ~5-20 KB |
| **9** | Browser: Render | ~10ms | React render `<ResultCard>` dengan Arabic text + translation |

**Total latency ~87ms** (dalam target < 500ms)

---

## DIAGRAM 5: Vector Embedding Concept — Visual Explanation

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                    BAGAIMANA VECTOR EMBEDDING BEKERJA (VISUAL)                        │
└──────────────────────────────────────────────────────────────────────────────────────┘


    ╔═══════════════════════════════════════════════════════════════════════════════╗
    ║  KONSEP: Setiap teks direpresentasikan sebagai titik dalam ruang 1024-dimensi  ║
    ║  Makna mirip → jarak dekat (cosine similarity tinggi)                          ║
    ╚═══════════════════════════════════════════════════════════════════════════════╝


    VISUALISASI 2D (proyeksi dari 1024 dimensi ke 2D untuk ilustrasi):


                        ★ "forgiveness" (EN)
                        │\
                        │ \
                        │  ★ "pengampunan" (ID)
          "mercy" ★     │   \
              (EN)  \   │    ★ "المغفرة" (AR)        ★ "rezeki" (ID)
                      \  │
                       \ │
    ──────────────────────────────────────────────────────────────────────────
           ★ "anger"   \│                 ★ "الصبر" (AR)
           (EN)         ★ "patience"       │
                        (EN)               │
                          │\               ★ "وَاسْتَعِينُوا بِالصَّبْرِ"
                          │ \              (Quran 2:153)
                          │  \
                          │   ★ "sabr" (transliterasi)
                          │
                          ★ "sabar" (ID)


    ╔═══════════════════════════════════════════════════════════════════════════════╗
    ║  OBSERVASI KUNCI:                                                              ║
    ║                                                                                 ║
    ║  1. "patience" (EN) ≈ "الصبر" (AR) ≈ "sabr" (translit) ≈ "sabar" (ID)        ║
    ║     → SEMUA dekat satu sama lain karena MAKNA SAMA                             ║
    ║                                                                                 ║
    ║  2. Ayat Quran 2:153 (tentang sabar) DEKAT dengan kata "patience"               ║
    ║     → Meskipun tidak ada kata "patience" dalam teks Arab ayat tersebut         ║
    ║                                                                                 ║
    ║  3. "forgiveness" jauh dari "anger" → makna berlawanan                          ║
    ║                                                                                 ║
    ║  4. "mercy" dekat dengan "forgiveness" → makna terkait                          ║
    ╚═══════════════════════════════════════════════════════════════════════════════╝


    ───────────────────────────────────────────────────────────────────────────────


    PERBANDINGAN: KEYWORD SEARCH vs SEMANTIC SEARCH


    Query: "patience"
    ─────────────────

    ┌─────────────────────────────────┬──────────────────────────────────────┐
    │   KEYWORD SEARCH (ILIKE)        │   SEMANTIC SEARCH (Vector)           │
    │                                 │                                      │
    │   SELECT * FROM verses          │   SELECT * FROM embeddings            │
    │   WHERE text_translation        │   ORDER BY embedding <=> query_vec   │
    │   ILIKE '%patience%';           │   LIMIT 10;                           │
    │                                 │                                      │
    │   ┌───────────────────────────┐ │   ┌────────────────────────────────┐ │
    │   │ ✅ "patience is beautiful"│ │   │ ✅ "وَٱسْتَعِينُوا۟ بِٱلصَّبْرِ"│ │
    │   │ ✅ "have patience..."     │ │   │    (Quran 2:153)               │ │
    │   │ ❌ "وَٱسْتَعِينُوا۟        │ │   │    Score: 0.87 — tentang sabar │ │
    │   │     بِٱلصَّبْرِ"         │ │   │                                │ │
    │   │    (tidak ada kata        │ │   │ ✅ "فَصَبْرٌ جَمِيلٌ"          │ │
    │   │     'patience' di teks)   │ │   │    (Quran 12:18)               │ │
    │   │                           │ │   │    Score: 0.85                 │ │
    │   │ ❌ "إِنَّ اللَّهَ مَعَ     │ │   │                                │ │
    │   │     الصَّابِرِينَ"        │ │   │ ✅ "Be patient..."              │ │
    │   │    (sama, tidak nemu)     │ │   │    Score: 0.82                 │ │
    │   └───────────────────────────┘ │   └────────────────────────────────┘ │
    │                                 │                                      │
    │   Hasil: 3 teks English        │   Hasil: 50+ teks (Arab + English)   │
    │   Missing: semua Arabic text   │   Cross-language, semua bahasa       │
    │   Recall: RENDAH               │   Recall: TINGGI                     │
    └─────────────────────────────────┴──────────────────────────────────────┘


    ───────────────────────────────────────────────────────────────────────────────


    BAGAIMANA MODEL E5 MENGHASILKAN VECTOR CROSS-LINGUAL?


                  ┌──────────────┐
                  │  TRAINING    │  Contrastive Learning pada milyaran pasangan teks
                  │  DATA        │  paralel multi-bahasa:
                  │              │
                  │  "patience"  │  ←──────────→  "الصبر"
                  │  (English)   │    pasangan     (Arabic)
                  │              │    paralel
                  │  "prayer"    │  ←──────────→  "الصلاة"
                  │              │
                  │  "kindness   │  ←──────────→  "بِالْوَالِدَيْنِ إِحْسَانًا"
                  │   to parents"│                 (Quran 17:23)
                  └──────┬───────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  CONTRASTIVE LOSS   │
              │                     │
              │  Minimize distance: │  ←──▶  pasangan paralel (makna sama)
              │  Maximize distance: │  ←──▶  pasangan random (makna beda)
              │                     │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────────────────────────┐
              │  HASIL: Multilingual Vector Space        │
              │                                         │
              │  Teks dengan makna sama ditarik DEKAT   │
              │  → terlepas dari BAHASA                 │
              │  → terlepas dari PILIHAN KATA            │
              └─────────────────────────────────────────┘
```

---

## DIAGRAM 6: Frontend Component Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                     FRONTEND COMPONENT LIFECYCLE — SEARCH PAGE                        │
└──────────────────────────────────────────────────────────────────────────────────────┘


    ┌─────────────────────────────────────────────────────────────────┐
    │                      APP INITIALIZATION                          │
    │                                                                  │
    │  main.tsx                                                       │
    │  ┌──────────────────────────────────────────────────────────┐   │
    │  │ 1. createRouter({ routeTree })  ← import dari routeTree  │   │
    │  │ 2. RouterProvider             ← wrapping seluruh app     │   │
    │  │ 3. createRoot(document...)    ← mount ke div#root        │   │
    │  └──────────────────────────────────────────────────────────┘   │
    └─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                    ROUTE MATCHING                                │
    │                                                                  │
    │  URL: http://localhost:3000/search?q=patience                    │
    │                                                                  │
    │  TanStack Router:                                                │
    │  ┌──────────────────────────────────────────────────────────┐   │
    │  │ 1. Parse URL → path="/search", search={q:"patience"}     │   │
    │  │ 2. Match route tree:                                      │   │
    │  │      rootRoute                                             │   │
    │  │      └── searchRoute  ← MATCH!                             │   │
    │  │ 3. Validate search params:                                 │   │
    │  │      validateSearch({q:"patience"}) → {q:"patience"}      │   │
    │  └──────────────────────────────────────────────────────────┘   │
    └──────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                  COMPONENT RENDER TREE                          │
    │                                                                  │
    │  <RouterProvider>                                               │
    │  └── <RootLayout>          ← __root.tsx (selalu render)         │
    │       ├── <Header>                                              │
    │       │   ├── Logo ("Dalil")                                    │
    │       │   └── NavLinks [Search, Quran, Hadith]                  │
    │       │                                                        │
    │       ├── <Outlet>          ← child route render di sini        │
    │       │   └── <SearchPage>  ← search.tsx                        │
    │       │       ├── <SearchBar>                                   │
    │       │       │   ├── <SearchIcon />                            │
    │       │       │   ├── <input> (controlled)                      │
    │       │       │   └── <button> "Search"                         │
    │       │       │                                                 │
    │       │       ├── <div> "{total} results · {took_ms}ms"         │
    │       │       │                                                 │
    │       │       └── <ResultCard> × 20                            │
    │       │           ├── <SourceBadge> "Qur'an" / "Hadith"         │
    │       │           ├── <p.arabic-text> {text_arabic}             │
    │       │           └── <p> {text_translation}                    │
    │       │                                                        │
    │       └── <Footer>                                              │
    └─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                    SEARCH PAGE STATE FLOW                       │
    │                                                                  │
    │  ┌─────────────────────────────────────────────────────────┐    │
    │  │            COMPONENT MOUNT (useEffect)                    │    │
    │  │                                                          │    │
    │  │  const [q] = getQueryParam()    // "patience"            │    │
    │  │  const [data, setData] = useState(null)                  │    │
    │  │  const [loading, setLoading] = useState(false)            │    │
    │  │  const [error, setError] = useState(null)                │    │
    │  │  const [inputValue, setInputValue] = useState(q)         │    │
    │  └──────────────────────┬──────────────────────────────────┘    │
    │                         │                                       │
    │                         ▼                                       │
    │  ┌─────────────────────────────────────────────────────────┐    │
    │  │            FETCH DATA (doSearch)                          │    │
    │  │                                                          │    │
    │  │  if (q) {                                                │    │
    │  │    setLoading(true)                                      │    │
    │  │    try {                                                  │    │
    │  │      const res = await fetchSearch({ q, limit: 20 })     │    │
    │  │      setData(res)        ← trigger re-render             │    │
    │  │    } catch (err) {                                       │    │
    │  │      setError(err.message)                                │    │
    │  │    } finally {                                            │    │
    │  │      setLoading(false)                                    │    │
    │  │    }                                                      │    │
    │  │  }                                                        │    │
    │  └──────────────────────┬──────────────────────────────────┘    │
    │                         │                                       │
    │                    ┌────┴────┐                                  │
    │                    │         │                                  │
    │              loading?   error?                                  │
    │              ┌──┴──┐  ┌──┴──┐                                  │
    │              │ YES │  │ YES │                                  │
    │              └──┬──┘  └──┬──┘                                  │
    │                 │        │                                      │
    │           <Loading    <div>                                     │
    │           Skeleton />  "{error}" />                            │
    │                 │        │                                      │
    │              ┌──┴────────┴──┐                                  │
    │              │  data !== null │                                 │
    │              └──────┬────────┘                                 │
    │                     │                                           │
    │          <SearchMeta total={} took={} />                        │
    │          <ResultCard> × data.results.length                     │
    │          OR <EmptyState />                                      │
    └─────────────────────────────────────────────────────────────────┘
```

---

## DIAGRAM 7: Database Schema — Entity Relationship

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                       DATABASE SCHEMA — ENTITY RELATIONSHIP                           │
└──────────────────────────────────────────────────────────────────────────────────────┘


                         ┌──────────────────────┐
                         │      surahs          │
                         │──────────────────────│
                         │ PK  id   SMALLINT     │
                         │     name_arabic  TEXT │
                         │     name_english TEXT │
                         │     revelation_type   │
                         │     verses_count      │
                         └──────────┬───────────┘
                                    │ 1
                                    │
                                    │ has
                                    │
                                    │ N
                         ┌──────────▼───────────┐
                         │      verses          │
                         │──────────────────────│
                         │ PK  id    INTEGER     │
                         │ FK  surah_id → surahs │
                         │     verse_number      │
                         │     text_arabic  TEXT │
                         │     text_translation  │
                         │     juz               │
                         │     page              │
                         └──────────┬───────────┘
                                    │ 1
                                    │
                                    │ has
                                    │
                                    │ N
                         ┌──────────▼───────────┐
                         │    embeddings        │
                         │──────────────────────│
                         │ PK  id    SERIAL      │
                         │     source_type       │◄── 'quran' | 'hadith'
                         │     source_id         │◄── verses.id | hadith.id
                         │     embedding VEC1024 │
                         │     text_hash         │
                         │     model_version     │
                         │     created_at        │
                         │                      │
                         │ IDX hnsw (cosine_ops) │
                         └──────────────────────┘


    ┌──────────────────────┐          ┌──────────────────────┐
    │  hadith_collections  │          │    hadith_books       │
    │──────────────────────│          │──────────────────────│
    │ PK  id    INTEGER     │          │ PK  id    INTEGER     │
    │     name_eng  TEXT    │          │ FK  collection_id     │◄── hadith_collections.id
    │     name_ar   TEXT    │──────────│     name_eng  TEXT    │
    │     slug   VARCHAR(50)│  1:N     │     name_ar   TEXT    │
    └──────────┬───────────┘          │     book_number       │
               │                      └──────────┬───────────┘
               │ 1                               │ 1
               │                                 │
               │ has                       has   │
               │                                 │
               │ N                               │ N
    ┌──────────▼───────────┐          ┌──────────▼───────────┐
    │       hadith         │◄─────────┤                      │
    │──────────────────────│ optional │                      │
    │ PK  id    INTEGER     │          └──────────────────────┘
    │ FK  collection_id     │──► hadith_collections.id
    │ FK  book_id (nullable)│──► hadith_books.id
    │     hadith_number     │
    │     chapter_name_eng  │
    │     chapter_name_ar   │
    │     text_arabic       │
    │     text_english      │
    │     grade             │      ┌──────────────────────┐
    │     narrator_chain    │      │     embeddings       │
    └──────────┬───────────┘      │  (shared table)      │
               │ 1                │  source_id ◄── hadith │
               │                  └──────────────────────┘
               │ has
               │
               │ N
    ┌──────────▼───────────┐
    │    embeddings        │
    │  (shared table)      │
    │  source_id ◄── hadith│
    └──────────────────────┘


    ╔══════════════════════════════════════════════════════════════════════╗
    ║  DESIGN DECISION: Tabel embeddings BERSAMA untuk Quran & Hadith     ║
    ║                                                                      ║
    ║  ✅ PRO: Query vector ONE TIME, mencakup SEMUA sumber                ║
    ║  ✅ PRO: HNSW index tunggal, semua vector dalam 1 graph             ║
    ║  ✅ PRO: source_type column untuk filter                             ║
    ║                                                                      ║
    ║  ❌ CONS: Tidak bisa foreign key ke 2 tabel berbeda                  ║
    ║     → Solusi: source_id tanpa FK, tapi JOIN manual via query        ║
    ╚══════════════════════════════════════════════════════════════════════╝
```

---

## DIAGRAM 8: Deployment & Infrastructure

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                          DEPLOYMENT & INFRASTRUCTURE                                  │
└──────────────────────────────────────────────────────────────────────────────────────┘


    ╔═══════════════════════════════════════════════════════════════════════════════╗
    ║                        DEVELOPMENT (docker compose)                            ║
    ╚═══════════════════════════════════════════════════════════════════════════════╝

    ┌──────────────────────────────────────────────────────────────────────────┐
    │                          docker-compose.yml                               │
    │                                                                           │
    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
    │  │  frontend   │  │  backend    │  │  celery     │  │    postgres     │  │
    │  │  :3000      │  │  :8000      │  │  worker     │  │    :5432        │  │
    │  │             │  │             │  │             │  │                 │  │
    │  │  Vite dev   │  │  FastAPI    │  │  embedding  │  │  pgvector:pg16  │  │
    │  │  server     │  │  uvicorn    │  │  tasks      │  │  HNSW index     │  │
    │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
    │         │                │                │                   │           │
    │         │                │                │                   │           │
    │         │       ┌────────┴────────┐       │                   │           │
    │         │       │                 │       │                   │           │
    │         │  ┌────▼────┐    ┌───────▼───────┴───────────────────▼──┐        │
    │         │  │  redis  │    │            volumes:                   │        │
    │         │  │  :6379  │    │  pgdata/     — PostgreSQL data        │        │
    │         │  │         │    │  model-cache/ — HuggingFace models    │        │
    │         │  └─────────┘    └──────────────────────────────────────┘        │
    │         │                                                                  │
    │  ┌──────▼──────────────────────────────────────────────────────────┐      │
    │  │                        volumes                                   │      │
    │  │  ./frontend:/app      — Hot reload frontend code                 │      │
    │  │  ./backend:/app       — Hot reload backend code (--reload)       │      │
    │  │  /app/node_modules    — Excluded from bind mount (docker volume)  │      │
    │  └─────────────────────────────────────────────────────────────────┘      │
    └──────────────────────────────────────────────────────────────────────────┘


    ╔═══════════════════════════════════════════════════════════════════════════════╗
    ║                          PRODUCTION (MVP)                                      ║
    ╚═══════════════════════════════════════════════════════════════════════════════╝

                         ┌─────────────────────┐
                         │    GitHub Actions    │
                         │    CI/CD Pipeline    │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
          ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
          │  Lint & Test │  │  Build      │  │  Deploy     │
          │  TypeScript  │  │  Vite build │  │             │
          │  Python mypy │  │  Docker img │  │             │
          └─────────────┘  └──────┬──────┘  └──────┬──────┘
                                  │                 │
                    ┌─────────────┼─────────────┐   │
                    │             │             │   │
                    ▼             ▼             ▼   │
          ┌──────────────┐ ┌──────────────┐ ┌──────▼──────┐
          │ Vercel       │ │ Railway /    │ │ Railway     │
          │              │ │ Fly.io       │ │             │
          │ Frontend     │ │ Backend API  │ │ PostgreSQL  │
          │ Static       │ │ Docker       │ │ + pgvector  │
          │ Served from  │ │ Container    │ │             │
          │ CDN edge     │ │              │ │ + Redis     │
          └──────────────┘ └──────────────┘ └─────────────┘


    ╔═══════════════════════════════════════════════════════════════════════════════╗
    ║  MONITORING STACK                                                            ║
    ╚═══════════════════════════════════════════════════════════════════════════════╝

    ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
    │   Sentry     │    │  Prometheus  │    │  Vercel Analytics │
    │              │    │  + Grafana   │    │                  │
    │ Error track: │    │              │    │ Web vitals:      │
    │ · Frontend   │    │ Query time:  │    │ · LCP, FID, CLS  │
    │ · Backend    │    │ · p50, p95   │    │ · Page views     │
    │ · Celery     │    │ Embed gen:   │    │ · Bounce rate    │
    │              │    │ · throughput │    │                  │
    └──────────────┘    └──────────────┘    └──────────────────┘

    ┌──────────────────────────────────────────────────────────┐
    │              PostgreSQL Monitoring                        │
    │                                                          │
    │  pg_stat_statements:                                     │
    │  · Identify slow queries (latency > 100ms)               │
    │  · Hit ratio (index vs sequential scan)                 │
    │  · Bloated indexes                                       │
    │                                                          │
    │  pgvector health:                                        │
    │  · Index size monitoring                                 │
    │  · Vacuum frequency (HNSW index perlu vacuum rutin)      │
    │  · Dead tuples setelah frequent INSERT                   │
    └──────────────────────────────────────────────────────────┘
```

**Penjelasan Diagram 8 — Infrastructure**

1. **Development** — Docker Compose menjalankan 5 service di local:
   - `frontend`: Vite dev server + HMR, proxy `/api` ke backend
   - `backend`: FastAPI + uvicorn `--reload` (hot reload saat file berubah)
   - `celery-worker`: Task embedding generation
   - `postgres`: pgvector:pg16 dengan HNSW index
   - `redis`: Cache, broker Celery, rate limiter

2. **Production** — Split deployment:
   - **Frontend**: Vercel (static + edge CDN, gratis untuk personal)
   - **Backend**: Railway/Fly.io (Docker container, autoscale)
   - **Database**: Railway managed PostgreSQL + pgvector extension

3. **Monitoring**:
   - **Sentry** — error tracking untuk semua layer
   - **Prometheus + Grafana** — query latency, throughput embedding
   - **Vercel Analytics** — web vitals (LCP, FID, CLS)
   - **pg_stat_statements** — deteksi slow query

---

## DIAGRAM 9: Error Handling Flow

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                            ERROR HANDLING FLOW                                        │
└──────────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────────┐
    │                         FRONTEND ERROR STATES                            │
    │                                                                          │
    │  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐   │
    │  │  LOADING     │    │  ERROR       │    │  EMPTY STATE             │   │
    │  └──────┬───────┘    └──────┬───────┘    └────────────┬─────────────┘   │
    │         │                   │                         │                  │
    │   ┌─────▼─────┐       ┌─────▼─────┐            ┌──────▼──────┐          │
    │   │ Skeleton  │       │  ❌ Error │            │ No results  │          │
    │   │ animation │       │  Message  │            │ Try different│          │
    │   │ 5 bars    │       │  & Retry  │            │ keywords    │          │
    │   └───────────┘       │  button   │            └─────────────┘          │
    │                       └───────────┘                                      │
    └─────────────────────────────────────────────────────────────────────────┘


    ┌─────────────────────────────────────────────────────────────────────────┐
    │                         BACKEND ERROR HANDLING                           │
    │                                                                          │
    │                                                                          │
    │    HTTP Request                                                          │
    │         │                                                                │
    │         ▼                                                                │
    │    ┌──────────────────┐                                                  │
    │    │ Validate Input    │──► 422 ValidationError                          │
    │    │ · q: min_length=1│     {"detail": [{"msg": "field required"}]}     │
    │    │ · limit: ≤50     │                                                  │
    │    └────────┬─────────┘                                                  │
    │             │ ✓                                                          │
    │             ▼                                                            │
    │    ┌──────────────────┐                                                  │
    │    │ Embed Query       │──► 500 ModelError                               │
    │    │ · Model loaded?   │     {"detail": "Model not loaded"}              │
    │    └────────┬─────────┘                                                  │
    │             │ ✓                                                          │
    │             ▼                                                            │
    │    ┌──────────────────┐                                                  │
    │    │ pgvector Search   │──► 503 DatabaseError                            │
    │    │ · DB connected?   │     {"detail": "Database connection failed"}    │
    │    │ · Index exists?   │     (return cached results if available)        │
    │    └────────┬─────────┘                                                  │
    │             │ ✓                                                          │
    │             ▼                                                            │
    │    ┌──────────────────┐                                                  │
    │    │ Assemble Result   │──► 200 OK (dengan metadata)                     │
    │    │ · JOIN successful │    { "query": "...", "results": [...] }        │
    │    └──────────────────┘                                                  │
    └─────────────────────────────────────────────────────────────────────────┘
```

---

## RINGKASAN: Semua Diagram dalam 1 Pandangan

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                                  DALIL APP — COMPLETE FLOW                           │
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│   DATA INGESTION        →    EMBEDDING GEN       →    VECTOR STORAGE               │
│  ┌─────────────────┐       ┌─────────────────┐      ┌─────────────────┐            │
│  │ Tanzil Quran    │       │ Celery Worker   │      │ pgvector        │            │
│  │ Sunnah Hadith   │──►    │ Batch 32        │──►   │ HNSW Index      │            │
│  │ Open Datasets   │       │ E5-large model  │      │ ~25k vectors    │            │
│  └─────────────────┘       └─────────────────┘      └────────┬────────┘            │
│                                                               │                     │
│  USER SEARCH                                                 │                     │
│  ┌─────────────────┐                                          │                     │
│  │ Type "patience" │                                          │                     │
│  │ in browser     │                                           │                     │
│  └───────┬─────────┘                                          │                     │
│          │                                                     │                     │
│          ▼                                                     ▼                     │
│  ┌─────────────────┐        ┌─────────────────┐      ┌─────────────────┐           │
│  │ TanStack Router │        │ FastAPI Search  │      │ Cosine          │           │
│  │ /search?q=...   │──►     │ Embed query     │──►   │ similarity      │──► RESULT│
│  │ React render    │◄──     │ JOIN assembly   │◄──   │ top-K + re-rank │           │
│  └─────────────────┘        └─────────────────┘      └─────────────────┘           │
│                                                                                     │
│  ═══════════════════════════════════════════════════════════════════════════════    │
│  INFRASTRUCTURE:  Vite → FastAPI → PostgreSQL(pgvector) + Redis → Celery           │
│  TOTAL LATENCY:   ~87ms (target p95 < 500ms)                                       │
│  MODEL:           multilingual-e5-large-instruct (1024-dim, 100+ languages)        │
│  CORPUS:          6,236 Quran verses + ~17,000 Hadith                              │
│  ═══════════════════════════════════════════════════════════════════════════════    │
└────────────────────────────────────────────────────────────────────────────────────┘
```
