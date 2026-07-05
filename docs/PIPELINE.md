# Data Pipeline & Vector Embedding Design — Dalil App

## 1. Konsep Vector Embedding untuk Semantic Search

### 1.1 Apa itu Semantic Search?

Keyword search tradisional mencocokkan kata per kata (`WHERE text LIKE '%sabar%'`). Ini **tidak bisa** menemukan:

| Query user | Ayat relevan (gagal ditemukan) |
|---|---|
| "kindness to parents" | `وَبِالْوَالِدَيْنِ إِحْسَانًا` — tidak ada kata "kindness" |
| "patience" (English) | `إِنَّ اللَّهَ مَعَ الصَّابِرِينَ` — tidak ada kata "patience" |
| "backbiting" | `وَلَا يَغْتَب بَّعْضُكُم بَعْضًا` — kata berbeda |

**Semantic search** memetakan makna (meaning) ke dalam **vector** — koordinat numerik dalam ruang 1024-dimensi. Dua teks dengan **makna mirip** akan memiliki **jarak vector yang dekat**, meskipun tidak berbagi satu kata pun.

```
┌─────────────────────────────────────────────────────────────┐
│                    Semantic Vector Space                     │
│                                                             │
│          ★ "God"                     ★ "prophet"            │
│           ⋮                             ⋮                   │
│     ★ "Allah"      ★ "Tuhan"         ★ "nabi"               │
│     ★ "Rabb"                         ★ "rasul"              │
│                                                             │
│    Kedekatan vector = kedekatan makna                       │
│    (tanpa perlu kata yang sama)                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Cara Kerja Model Embedding

```
Input Text ──► Tokenizer ──► Transformer Model ──► Pooling ──► Vector (1024 float)
                                                                 [0.034, -0.12, 0.67, ..., 0.01]
```

Model yang digunakan: **`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`**

| Properti | Nilai | Penjelasan |
|---|---|---|
| Dimensi | 384 | Vektor 384 angka float32 |
| Bahasa | 50+ | Arabic, English, Indonesia, dll |
| Max token | 512 | ~300 kata per input |
| Strategi | Standard | Tidak memerlukan prefix khusus |

### 1.3 Kenapa Bisa Cross-language?

Model multilingual-MiniLM dilatih pada korpus paralel multibahasa. Hasilnya:

- `"patience"` (EN) dan `"الصبر"` (AR) menghasilkan vector yang **hampir identik**
- `"shalat"` (transliterasi) akan dekat dengan `"الصلاة"` (Arabic) dan `"prayer"` (EN)

---

## 2. Data Pipeline — End-to-End Flow

### 2.1 Diagram Alur

```
                            PHASE 1: INGESTION
                            =================

  Tanzil.net Quran JSON ──┐
  Sunnah.com Hadith API ──┤
  Open Hadith Dataset ────┤
                          │
                    ┌─────▼─────┐
                    │  ETL Script │  Python + Pandas
                    │  (ingest.py)│
                    └─────┬─────┘
                          │
                    ┌─────▼─────────────────────────────────────┐
                    │         PostgreSQL (Data Relasional)        │
                    │                                             │
                    │  ┌──────────┐  ┌────────────────────────┐  │
                    │  │  surahs  │  │  hadith_collections     │  │
                    │  │  verses  │  │  hadith_books           │  │
                    │  │          │  │  hadith                 │  │
                    │  └──────────┘  └────────────────────────┘  │
                    └─────────────────────┬───────────────────────┘
                                          │
                                          │ Celery task
                                          │ dipicu otomatis
                                          │ setelah ingestion
                                          ▼

                            PHASE 2: EMBEDDING
                            ==================

  ┌────────────────────────────────────────────────────────────┐
  │                Embedding Worker (Celery)                    │
  │                                                            │
  │  1. Baca batch 32 row dari PostgreSQL (`text_arabic`)      │
  │  2. Tambahkan prefix "passage: "                           │
  │  3. Jalankan SentenceTransformer model                     │
  │  4. Normalisasi (L2 norm = 1.0)                            │
  │  5. Simpan vector ke tabel `embeddings` (source_type +     │
  │     source_id + embedding VECTOR(1024))                    │
  │  6. Hitung text_hash (SHA-256) untuk cache-busting        │
  │                                                            │
  └────────────────────────┬───────────────────────────────────┘
                           │
                           ▼

  ┌────────────────────────────────────────────────────────────┐
  │              PostgreSQL + pgvector                          │
  │                                                            │
  │  embeddings ┌─────────────────────────────────────────────┐│
  │             │ id │ type  │ source_id │ vector(1024)      ││
  │             ├────┼───────┼───────────┼───────────────────┤│
  │             │ 1  │ quran │ 1         │ [0.03,-0.12,...]  ││
  │             │ 2  │ quran │ 2         │ [0.04,-0.11,...]  ││
  │             │... │ hadith│ 1         │ [0.01,-0.09,...]  ││
  │             └────┴───────┴───────────┴───────────────────┘│
  │                                                            │
  │  + HNSW Index (cosine distance) untuk ANN search           │
  └────────────────────────────────────────────────────────────┘


                            PHASE 3: SEARCH (Runtime)
                            =========================

  User Query "kindness to parents"
       │
       ▼
  ┌────────────────────────────┐
  │  Query Preprocessing        │
  │  - Normalisasi Unicode      │
  │  - Detach diacritics (ops)  │
  │  - Language detection       │
  └──────────┬─────────────────┘
             │
             ▼
  ┌────────────────────────────┐
  │  Embed Query                │
  │  model.encode("query: " + q)│
  │  → vector 1024-dim          │
  └──────────┬─────────────────┘
             │
             ▼
  ┌────────────────────────────────────────────┐
  │  Vector Search (pgvector HNSW)              │
  │                                              │
  │  SELECT ..., 1 - (embedding <=> query)       │
  │  FROM embeddings                             │
  │  ORDER BY embedding <=> query_vec    -- ANN  │
  │  WHERE 1 - (embedding <=> q) >= 0.3 -- min  │
  │  LIMIT 100                          -- oversample │
  └──────────┬─────────────────────────────────┘
             │
             │  Top-100 candidates
             ▼
  ┌────────────────────────────┐
  │  Hybrid Re-rank             │
  │  - Vector score (60%)       │
  │  - BM25 text score (30%)    │
  │  - Source boost (10%)       │
  │    (Qur'an > Hadith)        │
  └──────────┬─────────────────┘
             │
             │  Top-20 final
             ▼
  ┌────────────────────────────┐
  │  Response Assembly          │
  │  - JOIN ke verses/hadith    │
  │  - Lampirkan terjemahan     │
  │  - Return JSON              │
  └────────────────────────────┘
```

### 2.2 Detail Langkah Ingestion

```python
# Pseudocode: backend/data/scripts/ingest.py

def ingest_quran(json_path: str) -> None:
    """1. Baca file JSON Tanzil.net"""
    with open(json_path) as f:
        quran_data = json.load(f)

    """2. Insert ke PostgreSQL dalam batch (transaksi besar)"""
    with db_session() as session:
        for surah in quran_data["surahs"]:
            session.execute(
                insert(Surah).values(
                    id=surah["number"],
                    name_arabic=surah["name"],
                    name_english=surah["englishName"],
                    revelation_type=surah["revelationType"],
                    verses_count=len(surah["verses"]),
                )
            )
            for verse in surah["verses"]:
                session.execute(
                    insert(Verse).values(
                        surah_id=surah["number"],
                        verse_number=verse["number"],
                        text_arabic=verse["text"],
                        text_translation=verse["translation"],  # opsional
                        juz=verse.get("juz"),
                    )
                )
        session.commit()

    """3. Trigger Celery task untuk generate embeddings"""
    generate_quran_embeddings.delay()

    """4. Verifikasi"""
    assert db.query(func.count(Verse.id)).scalar() == 6236


def ingest_hadith(collection_slug: str, json_path: str) -> None:
    """Proses sama untuk setiap koleksi Hadith"""
    # 1. Insert collection + books
    # 2. Insert hadith entries
    # 3. Trigger embedding generation
    # 4. Verifikasi count
```

### 2.3 Celery Task: Generate Embeddings

```python
# Pseudocode: backend/app/tasks/embedding_tasks.py

@celery_app.task(bind=True, max_retries=3)
def generate_embeddings(self, source_type: str, batch_size: int = 32):
    """
    Task ini berjalan ASYNC setelah data insertion.
    1 worker saja cukup untuk 25k dokumen:
      ~25.000 / 32 batch * ~0.1 detik/batch ≈ 80 detik total
    """
    model = SentenceTransformer(settings.embedding_model)

    # Ambil row yang belum punya embedding (idempotent)
    with db_session() as session:
        if source_type == "quran":
            rows = session.execute(
                select(Verse.id, Verse.text_arabic)
                .outerjoin(Embedding, ...)  # anti-join: belum di-embed
                .where(Embedding.id == None)
            ).all()
        else:
            rows = session.execute(
                select(Hadith.id, Hadith.text_arabic)
                .outerjoin(Embedding, ...)
                .where(Embedding.id == None)
            ).all()

    # Proses dalam batch
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]

        # 1. Tambahkan prefix "passage: "
        texts = [f"passage: {r.text_arabic}" for r in batch]

        # 2. Generate embeddings
        vectors = model.encode(texts, normalize_embeddings=True)

        # 3. Bulk insert ke tabel embeddings
        with db_session() as session:
            for (source_id, text), vec in zip(batch, vectors):
                session.execute(
                    insert(Embedding).values(
                        source_type=source_type,
                        source_id=source_id,
                        embedding=vec.tolist(),
                        text_hash=hashlib.sha256(text.encode()).hexdigest(),
                        model_version=settings.embedding_model,
                    )
                )
            session.commit()
```

---

## 3. Kenapa Arsitektur Ini Solid

### 3.1 Pemisahan Storage: Data Relasional vs. Vector

| Layer | Storage | Tujuan |
|---|---|---|
| **Teks asli** | PostgreSQL (relasional) | Normalized, support JOIN, FK, constraint |
| **Vector** | PostgreSQL + pgvector | ANN search dengan HNSW index |

**Jangan gabung dalam satu tabel** karena:
- Embedding adalah **derived data** — bisa di-regenerate ulang dari teks
- Memisahkan memungkinkan update model tanpa menyentuh data sumber
- Query vector hanya scan tabel kecil (~200MB), bukan tabel utama yang besar

```
❌ BURUK: verses(id, text_arabic, ..., embedding vector(1024))
   → Fields teks & vector bercampur, I/O boros saat ANN scan

✅ BAIK:  verses(id, text_arabic, ...)
          embeddings(id, source_type, source_id, embedding vector(1024))
   → Query ANN hanya scan tabel embeddings, lalu JOIN ambil detail
```

### 3.2 Idempotency & Incremental Embedding

Embedding worker harus **idempotent** — bisa dijalankan ulang tanpa menghasilkan duplikat:

```sql
-- INSERT hanya untuk row yang belum ada embedding
INSERT INTO embeddings (source_type, source_id, embedding, text_hash, model_version)
SELECT
    'quran' AS source_type,
    v.id AS source_id,
    :embedding AS embedding,
    :text_hash AS text_hash,
    :model_version AS model_version
FROM verses v
LEFT JOIN embeddings e ON e.source_type = 'quran' AND e.source_id = v.id
WHERE e.id IS NULL;
```

### 3.3 HNSW Index untuk Pencarian Cepat

```
Tanpa Index (full scan):      O(N)  → 25k dokumen × linear scan     → ~50ms
Dengan IVFFlat (approximate): O(log N) but perlu rebuild            → ~5ms  
Dengan HNSW (graph-based):    O(log N), build sekali, insert lambat → ~2ms
```

HNSW membangun **graph navigasi multilayer** saat index creation. Saat query:
1. Mulai dari node entry-point (top layer)
2. Greedy search turun layer demi layer
3. Di bottom layer: exact search di neighborhood kecil

Parameter yang kita gunakan:
```sql
CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 200);
```

| Parameter | Nilai | Artinya |
|---|---|---|
| `m` | 16 | Setiap node terhubung ke 16 tetangga (per layer) |
| `ef_construction` | 200 | Makin besar → index lebih akurat, build lebih lambat |
| `ef_search` | 100 (default) | Kandidat yang dipertimbangkan saat query |

### 3.4 Hybrid Re-ranking (Vector + BM25)

**Mengapa perlu hybrid?** Pure vector search kadang gagal untuk:
- Kata kunci spesifik: "ayat kursi" — BM25 lebih baik karena exact match
- Nama proper: "Abu Hurairah", "Surah Al-Baqarah" — lexical match diperlukan

```python
# Konsep hybrid scoring (belum diimplementasi di MVP, roadmap v2)

final_score = (
    0.6 * vector_similarity +       # Semantic relevance
    0.3 * bm25_score +              # Keyword relevance
    0.1 * source_boost              # Qur'an sedikit di-boost atas Hadith
)
```

BM25 dihitung dengan `ts_rank` dari PostgreSQL full-text search pada teks Arabic (setelah stemming ringan).

### 3.5 Strategi Update Model

Ketika kita upgrade embedding model (misal dari e5-large ke model yang lebih baru):

```sql
-- 1. Tambah kolom versi di embeddings (sudah ada)
-- 2. Embedding lama tetap jalan (untuk user)
-- 3. Background: generate ulang embedding dengan model baru
-- 4. Setelah selesai, switch dengan atomic UPDATE:

BEGIN;
UPDATE system_config SET current_model_version = 'new-model-v2';
DELETE FROM embeddings WHERE model_version != 'new-model-v2';
COMMIT;
```

**Zero-downtime embedding upgrade.**

---

## 4. Design System & UI Architecture

### 4.1 Design Tokens

```css
/* === Typography === */
--font-sans: "Inter", system-ui, sans-serif;        /* UI, body text */
--font-arabic: "Scheherazade New", "Noto Naskh Arabic", serif;  /* Arabic text */

/* === Colors === */
--color-primary: #059669;       /* Emerald-600 — brand color */
--color-primary-dark: #047857;  /* Emerald-700 — hover state */
--color-surface: #ffffff;       /* White — background */
--color-border: #e5e5e5;        /* Neutral-200 — card border */
--color-text-primary: #171717;  /* Neutral-900 — heading */
--color-text-secondary: #737373;/* Neutral-500 — description */
--color-text-muted: #a3a3a3;    /* Neutral-400 — placeholder */

/* === Semantic Colors === */
--color-quran: #059669;         /* Emerald — badge/indicator for Qur'an */
--color-hadith: #3b82f6;        /* Blue — badge/indicator for Hadith */
--color-grade-sahih: #059669;   /* Green — authentic hadith */
--color-grade-hasan: #d97706;   /* Amber — good hadith */
--color-grade-daif: #dc2626;    /* Red — weak hadith */

/* === Spacing Scale === */
--space-1: 4px;    --space-2: 8px;    --space-3: 12px;
--space-4: 16px;   --space-5: 20px;   --space-6: 24px;
--space-8: 32px;   --space-10: 40px;  --space-12: 48px;

/* === Border Radius === */
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
```

### 4.2 Component Hierarchy

```
App (RouterProvider)
└── RootLayout (__root.tsx)
    ├── Header
    │   ├── Logo (BookOpenIcon + "Dalil")
    │   └── NavLinks [Search, Quran, Hadith]
    │
    ├── <Outlet /> (per-route content)
    │   │
    │   ├── HomePage (/)
    │   │   ├── HeroSection
    │   │   ├── SearchBar (dengan tombol submit)
    │   │   └── SuggestionChips
    │   │
    │   ├── SearchPage (/search?q=)
    │   │   ├── SearchBar (compact, dengan tombol)
    │   │   ├── ResultsMeta (total, waktu)
    │   │   ├── ResultCard[]
    │   │   │   ├── SourceBadge (Qur'an/Hadith)
    │   │   │   ├── ArabicText (RTL, font arabic)
    │   │   │   └── TranslationText
    │   │   ├── Pagination (future)
    │   │   └── EmptyState
    │   │
    │   ├── QuranBrowse (/quran) — placeholder
    │   └── HadithBrowse (/hadith) — placeholder
    │
    └── Footer
        └── Copyright text
```

### 4.3 Responsive Breakpoints

| Breakpoint | Width | Layout |
|---|---|---|
| `mobile` | < 640px | Single column, full-width search |
| `tablet` | 640–1024px | Two column for result cards |
| `desktop` | > 1024px | Max width 896px centered |

### 4.4 State Management

```
State          │  Scope      │  Library
───────────────┼─────────────┼─────────────
Search query   │  URL        │  TanStack Router (search params: ?q=)
Search results │  Component  │  React useState + useEffect
UI theme/lang  │  Global     │  React Context (future)
Auth/bookmarks │  Global     │  React Context + localStorage (future)
```

**Keputusan**: Tidak pakai Redux/Zustand. State management cukup dengan:
- **URL** untuk search query (shareable, bookmarkable)
- **useState** untuk ephemeral state (loading, results, input)
- **Context** hanya untuk cross-cutting concerns (theme, auth)

### 4.5 Accessibility (WCAG 2.1 AA)

| Requirement | Implementation |
|---|---|
| **RTL text** | `direction: rtl` pada `.arabic-text`, `lang="ar"` pada elemen Arabic |
| **Focus ring** | `focus-within:border-emerald-500` pada input, visible outline |
| **Contrast** | Text #171717 pada white = ratio 17.1:1 (AAA) |
| **Keyboard nav** | Semua interaksi bisa via Tab + Enter |
| **Screen reader** | `aria-label` pada button ikon, semantic HTML (`<nav>`, `<header>`, `<main>`) |
| **Font scaling** | Relative units (`rem`, `em`) — tidak ada `px` untuk font-size |

### 4.6 PWA & SEO

PWA diaktifkan via `vite-plugin-pwa` (future). Untuk SEO:
- Setiap halaman emit `<meta>` tag dinamis (future)
- Indexable content di-render di client-side (belum SSR di MVP)
- Sitemap dan robots.txt (future)

---

## 5. Ringkasan: Flow Lengkap dari Query ke Hasil

```
1. User ketik "rights of neighbors" di search box
2. Browser: navigate ke /search?q=rights+of+neighbors
3. TanStack Router: render <SearchPage /> dengan param q
4. SearchPage: useEffect → fetchSearch({ q: "rights of neighbors" })
5. Browser: HTTP GET /api/v1/search?q=rights+of+neighbors
6. Vite proxy: forward ke FastAPI backend (localhost:8000)
7. FastAPI search.py:
   a. Ambil query string
   b. Panggil embed_query("query: rights of neighbors")
   c. SentenceTransformer → vector 1024-dim
   d. Jalankan SQL HNSW search di tabel embeddings
   e. JOIN ke verses/hadith untuk full text + metadata
   f. Rank hasil berdasarkan cosine similarity
   g. Return JSON { results: [...], total: N, took_ms: M }
8. Browser: render <ResultCard /> per item
```

**Total latency budget (p95):**
```
Network (browser→API) : 20ms
Query embedding        : 30ms  (model inference, CPU/GPU)
HNSW ANN search        :  5ms  (pgvector index)
JOIN ke tabel sumber   : 10ms  (primary key lookup)
JSON serialization     :  5ms
Network (API→browser)  : 20ms
────────────────────────────────
TOTAL                  : 90ms  (target: < 500ms ✅)
```

---

## 6. Next Steps — Phase 1 Checklist

- [ ] Download dataset: Tanzil.net Quran JSON + Hadith open datasets
- [ ] Buat script ETL (`data/scripts/ingest_quran.py`, `ingest_hadith.py`)
- [ ] Konfigurasi Celery app di backend
- [ ] Buat Celery task `generate_embeddings`
- [ ] Running ingestion → verifikasi 6236 Qur'an + ~17000 Hadith
- [ ] Trigger embedding generation → verifikasi HNSW index
- [ ] Smoke test: search query pertama dari browser
