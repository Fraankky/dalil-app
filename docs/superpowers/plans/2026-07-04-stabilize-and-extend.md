# Stabilize, Indonesian Data & Frontend Extension Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace English translations with Indonesian (Quran + Hadith), revert to e5-large 1024-dim, fix known bugs, harden production, build frontend browse pages, and add search UI polish.

**Architecture:** Backend: FastAPI + SQLAlchemy async + pgvector + Celery. Frontend: Vite + TanStack Router. Data: fawazahmed0/quran-api (Quran ID), renomureza/hadis-api-id (Hadith ID). Embedding: intfloat/multilingual-e5-large-instruct (1024-dim).

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy 2.0, Alembic, Celery, PostgreSQL 16 + pgvector, Redis 7, TypeScript 5, React 18, Vite 5, TanStack Router, Tailwind CSS 3.

---

## File Structure

### Modified files:
| File | Change |
|---|---|
| `.env` | Update `EMBEDDING_MODEL` to e5-large |
| `data/scripts/ingest.py` | Handle ID translations for Quran + Hadith |
| `backend/alembic/versions/0005_*.py` | Migration: rename `text_english`→`text_translation`, vector(384)→(1024) |
| `backend/app/core/config.py` | Fix defaults: model name + dim consistent |
| `backend/app/models/models.py` | Update column names + Vector dim |
| `backend/app/models/schemas.py` | Update field names |
| `backend/app/services/search.py` | Fix HNSW filtered-query bug, rename fields |
| `backend/app/services/embedding.py` | Make async-safe |
| `backend/app/api/search.py` | Global exception handler |
| `backend/app/api/meta.py` | Update field names |
| `backend/app/api/hadith.py` | Update field names |
| `backend/main.py` | Add rate limiting middleware |
| `backend/tests/*.py` | Update field references |
| `frontend/src/lib/api.ts` | Expand client (browse endpoints) |
| `frontend/src/routes/quran.tsx` | Surah grid → detail |
| `frontend/src/routes/hadith.tsx` | Collections → detail |
| `frontend/src/routes/__root.tsx` | Update nav links |
| `frontend/src/routeTree.gen.ts` | New routes |

### Created files:
| File | Purpose |
|---|---|
| `data/raw/quran/quran-id.json` | Indonesian Quran translation |
| `data/raw/hadith-id/*.json` | Indonesian Hadith data (9 collections) |
| `backend/app/middleware/rate_limit.py` | Rate limiting middleware |
| `backend/app/core/cache.py` | Redis cache for embeddings |
| `frontend/src/routes/quran.$surahId.tsx` | Surah detail route |

### Global Constraints

- All commands assume `cwd` is project root unless `workdir` is specified.
- Use `backend/venv/bin/python` consistently (or system `python3` for data tasks).
- Database URL for sync operations: `DATABASE_URL_SYNC` env var.
- Never commit `.env` files or runtime artifacts.
- Each task produces a working, testable state.

---

## Phase 0: Indonesian Data Swap

**Goal:** Replace English translations with Indonesian for both Quran and Hadith.

### Task 0.1: Download Indonesian Quran Translation

**Files:**
- Create: `data/raw/quran/quran-id.json`

- [ ] **Step 1: Download Indonesian Quran**

```bash
curl -sL "https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ind-indonesianislam.json" -o data/raw/quran/quran-id.json
```

Expected: File downloaded (~2MB).

- [ ] **Step 2: Verify download**

```bash
python3 -c "
import json
with open('data/raw/quran/quran-id.json') as f:
    q = json.load(f)
if isinstance(q, list):
    print(f'Verses: {len(q)}')
    print(f'Sample: {q[0][\"text\"][:80]}')
    print(f'Format: chapter/verse style')
elif isinstance(q, dict):
    print(f'Keys: {list(q.keys())[:5]}')
    for k in list(q.keys())[:1]:
        v = q[k]
        print(f'Key {k}: type {type(v).__name__}, {json.dumps(v[:1] if isinstance(v,list) else v, ensure_ascii=False)[:200]}')
"
```

Expected: Indonesian translation text visible, not "TBD". The fawazahmed0 Quran API returns a list of verses.

Wait — the fawazahmed0 Quran API actually returns a list format where each item has `chapter`, `verse`, and `text`. Let me check:

```bash
python3 -c "
import json
with open('data/raw/quran/quran-id.json') as f:
    q = json.load(f)
print(f'Type: {type(q).__name__}')
if isinstance(q, list):
    print(f'Verses: {len(q)}')
    print(f'Sample: {json.dumps(q[0], ensure_ascii=False)[:200]}')
else:
    print(list(q.keys())[:5])
" 2>&1 || echo 'Unexpected format — inspect manually'
```

- [ ] **Step 3: Commit**

```bash
git add data/raw/quran/quran-id.json
git rm data/raw/quran/chapters.json 2>/dev/null  # will be replaced
git commit -m "feat(quran): add Indonesian translation (Kemenag RI)"
```

---

### Task 0.2: Download Indonesian Hadith Data

**Files:**
- Create: `data/raw/hadith-id/` directory

- [ ] **Step 1: Download all 9 hadith collections from renomureza/hadis-api-id**

```bash
mkdir -p data/raw/hadith-id

for slug in abu-dawud ahmad bukhari darimi ibnu-majah malik muslim nasai tirmidzi; do
  echo "Downloading $slug..."
  curl -sL "https://raw.githubusercontent.com/renomureza/hadis-api-id/main/src/data/${slug}.json" \
    -o "data/raw/hadith-id/${slug}.json"
  python3 -c "import json; d=json.load(open('data/raw/hadith-id/${slug}.json')); print(f'  {len(d)} hadith')"
done
```

Expected: 9 files downloaded, each with 1500–7000+ hadith.

- [ ] **Step 2: Download list.json for collection metadata**

```bash
curl -sL "https://raw.githubusercontent.com/renomureza/hadis-api-id/main/src/data/list.json" -o data/raw/hadith-id/list.json
cat data/raw/hadith-id/list.json
```

Expected: JSON with collection names and counts.

- [ ] **Step 3: Verify data format matches expectation**

```bash
python3 -c "
import json
with open('data/raw/hadith-id/bukhari.json') as f:
    h = json.load(f)
print(f'len: {len(h)}, type: {type(h).__name__}')
print(f'Keys: {list(h[0].keys())}')
print(json.dumps(h[0], ensure_ascii=False)[:400])
"
```

Expected: Each hadith is `{"number": int, "arab": "...", "id": "..."}` where `id` is Indonesian.

- [ ] **Step 4: Commit**

```bash
git add data/raw/hadith-id/
git commit -m "feat(hadith): add Indonesian translations (renomureza/hadis-api-id) 9 collections"
```

---

### Task 0.3: Migrate Database Schema for Indonesian

**Files:**
- Create: `backend/alembic/versions/0005_indonesian_translations.py`
- Modify: `backend/app/models/models.py`
- Modify: `backend/app/models/schemas.py`

- [ ] **Step 1: Create migration for column rename**

Create `backend/alembic/versions/0005_indonesian_translations.py`:

```python
"""Rename hadith.text_english→text_translation, update collection slugs

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-04
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("hadith", "text_english", new_column_name="text_translation")
    op.execute("DELETE FROM hadith")  # Remove old EN data
    op.execute("DELETE FROM hadith_books")
    op.execute("DELETE FROM hadith_collections")
    op.execute("DELETE FROM hadith")
    op.execute("DELETE FROM embeddings")
    op.execute("DELETE FROM verses")
    op.execute("DELETE FROM surahs")


def downgrade() -> None:
    op.alter_column("hadith", "text_translation", new_column_name="text_english")
```

- [ ] **Step 2: Run migration**

```bash
cd backend && DATABASE_URL_SYNC=postgresql://postgres:postgres@localhost:5432/dalil venv/bin/python -m alembic upgrade head
```

Expected: Column renamed, old data deleted, migration applied.

- [ ] **Step 3: Update model**

In `backend/app/models/models.py`, change:
```python
# In Hadith class:
text_english = Column(Text, nullable=True)
```
to:
```python
text_translation = Column(Text, nullable=True)
```

Also update the relation in embeddings task references if needed.

- [ ] **Step 4: Update Pydantic schemas**

In `backend/app/models/schemas.py`, change `HadithResponse.text_english` → `text_translation`.

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/0005_indonesian_translations.py backend/app/models/models.py backend/app/models/schemas.py
git commit -m "feat(db): rename text_english→text_translation for Indonesian"
```

---

### Task 0.4: Rewrite Ingestion Script

**Files:**
- Modify: `data/scripts/ingest.py`

- [ ] **Step 1: Rewrite Quran ingestion to include Indonesian translation**

Replace the Quran ingest function to load `quran-id.json` alongside `quran.json`, merge them by chapter+verse, and populate `text_translation`.

```python
def _load_quran_arabic(path: Path) -> dict[tuple[int, int], str]:
    """Load Arabic text indexed by (surah, verse)."""
    with open(path) as f:
        data = json.load(f)
    result = {}
    for surah_str, verses in data.items():
        surah = int(surah_str)
        for v in verses:
            result[(surah, v["verse"])] = v["text"]
    return result


def _load_quran_translation(path: Path) -> dict[tuple[int, int], str]:
    """Load translation indexed by (surah, verse)."""
    with open(path) as f:
        data = json.load(f)
    result = {}
    # fawazahmed0 format: list of {chapter, verse, text}
    if isinstance(data, list):
        for v in data:
            result[(v["chapter"], v["verse"])] = v["text"]
    # alternative: dict keyed by chapter then verse
    elif isinstance(data, dict):
        for surah_str, verses in data.items():
            surah = int(surah_str)
            if isinstance(verses, list):
                for v in verses:
                    result[(surah, v.get("verse"))] = v.get("text", "")
            elif isinstance(verses, dict):
                for verse_str, v in verses.items():
                    result[(surah, int(verse_str))] = v.get("text", "")
    return result


def ingest_quran(session: Session) -> dict:
    print("\n=== INGEST QURAN ===")
    arabic = _load_quran_arabic(QURAN_JSON)
    translation = _load_quran_translation(ROOT / "data" / "raw" / "quran" / "quran-id.json")

    stats = {"surahs": 0, "verses": 0}

    for surah_num in sorted(set(k[0] for k in arabic)):
        if surah_num in QURAN_SURAH_NAMES:
            name_ar, name_en, rev_type = QURAN_SURAH_NAMES[surah_num]
        else:
            continue
        surah_verses = sorted(k[1] for k in arabic if k[0] == surah_num)
        session.execute(
            text("""INSERT INTO surahs (id, name_arabic, name_english, revelation_type, verses_count)
                     VALUES (:id, :name_ar, :name_en, :rev_type, :count)
                     ON CONFLICT (id) DO UPDATE SET
                         name_arabic = EXCLUDED.name_arabic,
                         name_english = EXCLUDED.name_english,
                         revelation_type = EXCLUDED.revelation_type,
                         verses_count = EXCLUDED.verses_count"""),
            {"id": surah_num, "name_ar": name_ar, "name_en": name_en, "rev_type": rev_type, "count": len(surah_verses)},
        )
        stats["surahs"] += 1

    session.commit()
    print(f"  Inserted {stats['surahs']} surahs")

    batch = []
    for (surah, verse), arabic_text in sorted(arabic.items()):
        trans = translation.get((surah, verse), "")
        batch.append({"surah_id": surah, "verse_number": verse, "text_arabic": arabic_text, "text_translation": trans})
        if len(batch) >= 500:
            _insert_verses_batch(session, batch)
            stats["verses"] += len(batch)
            batch = []

    if batch:
        _insert_verses_batch(session, batch)
        stats["verses"] += len(batch)

    session.commit()
    print(f"  Inserted {stats['verses']} verses")
    return stats
```

Update `_insert_verses_batch` to include translation:

```python
def _insert_verses_batch(session: Session, batch: list[dict]) -> None:
    values = ", ".join(f"(:sid_{i}, :vn_{i}, :ar_{i}, :tr_{i})" for i in range(len(batch)))
    params = {}
    for i, v in enumerate(batch):
        params[f"sid_{i}"] = v["surah_id"]
        params[f"vn_{i}"] = v["verse_number"]
        params[f"ar_{i}"] = v["text_arabic"]
        params[f"tr_{i}"] = v["text_translation"]
    session.execute(
        text(f"""INSERT INTO verses (surah_id, verse_number, text_arabic, text_translation)
                 VALUES {values}
                 ON CONFLICT (surah_id, verse_number) DO UPDATE SET
                     text_arabic = EXCLUDED.text_arabic,
                     text_translation = EXCLUDED.text_translation"""),
        params,
    )
```

- [ ] **Step 2: Rewrite Hadith ingestion for Indonesian format**

Replace the hadith ingestion to read `hadith-id/{slug}.json`:

Replace `HADITH_BOOKS` and `HADITH_FILES` with:

```python
HADITH_ID_FILES = {
    "abudawud": DATA_RAW / "hadith-id" / "abu-dawud.json",
    "ahmad": DATA_RAW / "hadith-id" / "ahmad.json",
    "bukhari": DATA_RAW / "hadith-id" / "bukhari.json",
    "darimi": DATA_RAW / "hadith-id" / "darimi.json",
    "ibnmajah": DATA_RAW / "hadith-id" / "ibnu-majah.json",
    "malik": DATA_RAW / "hadith-id" / "malik.json",
    "muslim": DATA_RAW / "hadith-id" / "muslim.json",
    "nasai": DATA_RAW / "hadith-id" / "nasai.json",
    "tirmidhi": DATA_RAW / "hadith-id" / "tirmidzi.json",
}

HADITH_COLLECTIONS_ID = {
    "abudawud": {"name_eng": "Abu Dawud", "slug": "abudawud"},
    "ahmad": {"name_eng": "Ahmad", "slug": "ahmad"},
    "bukhari": {"name_eng": "Bukhari", "slug": "bukhari"},
    "darimi": {"name_eng": "Darimi", "slug": "darimi"},
    "ibnmajah": {"name_eng": "Ibnu Majah", "slug": "ibnmajah"},
    "malik": {"name_eng": "Malik", "slug": "malik"},
    "muslim": {"name_eng": "Muslim", "slug": "muslim"},
    "nasai": {"name_eng": "Nasai", "slug": "nasai"},
    "tirmidhi": {"name_eng": "Tirmidzi", "slug": "tirmidhi"},
}

HADITH_BOOKS = {slug: {"name_eng": info["name_eng"], "name_ar": "", "slug": info["slug"], "collection_id": idx + 1}
                for idx, (slug, info) in enumerate(HADITH_COLLECTIONS_ID.items())}

HADITH_FILES = HADITH_ID_FILES
```

Set collection IDs sequentially. Update the ingestion to match:

```python
def ingest_hadith(session: Session, book_slug: str) -> dict:
    filepath = HADITH_FILES.get(book_slug)
    if not filepath or not filepath.exists():
        print(f"  SKIP {book_slug}: file not found")
        return {"collections": 0, "books": 0, "chapters": 0, "hadith": 0}

    meta = HADITH_BOOKS[book_slug]
    print(f"\n  === {meta['name_eng']} ({book_slug}) ===")

    with open(filepath) as f:
        hadiths = json.load(f)

    stats = {"collections": 0, "books": 0, "chapters": 0, "hadith": 0}

    session.execute(
        text("""INSERT INTO hadith_collections (id, name_eng, name_ar, slug)
                 VALUES (:id, :name_eng, :name_ar, :slug)
                 ON CONFLICT (id) DO UPDATE SET
                     name_eng = EXCLUDED.name_eng, name_ar = EXCLUDED.name_ar, slug = EXCLUDED.slug"""),
        {"id": meta["collection_id"], "name_eng": meta["name_eng"], "name_ar": meta["name_ar"], "slug": meta["slug"]},
    )
    stats["collections"] = 1

    batch = []
    for h in hadiths:
        batch.append({
            "collection_id": meta["collection_id"],
            "chapter_id": None,
            "hadith_number": str(h.get("number", "")),
            "chapter_name_eng": None,
            "chapter_name_ar": None,
            "text_arabic": h.get("arab", ""),
            "text_translation": h.get("id", ""),
            "grade": None,
        })
        if len(batch) >= 500:
            _insert_hadith_batch(session, batch)
            stats["hadith"] += len(batch)
            batch = []

    if batch:
        _insert_hadith_batch(session, batch)
        stats["hadith"] += len(batch)

    session.commit()
    print(f"    Collections: {stats['collections']}, Hadith: {stats['hadith']}")
    return stats
```

Update `_insert_hadith_batch` to use `text_translation` instead of `text_english`:

```python
def _insert_hadith_batch(session: Session, batch: list[dict]) -> None:
    values = ", ".join(f"(:cid_{i}, :chid_{i}, :num_{i}, :ar_{i}, :tr_{i})" for i in range(len(batch)))
    params = {}
    for i, h in enumerate(batch):
        params[f"cid_{i}"] = h["collection_id"]
        params[f"chid_{i}"] = h["chapter_id"]
        params[f"num_{i}"] = h["hadith_number"]
        params[f"ar_{i}"] = h["text_arabic"]
        params[f"tr_{i}"] = h["text_translation"]

    session.execute(
        text(f"""INSERT INTO hadith (collection_id, chapter_id, hadith_number, text_arabic, text_translation)
                 VALUES {values}
                 ON CONFLICT (collection_id, hadith_number) DO UPDATE SET
                     text_arabic = EXCLUDED.text_arabic,
                     text_translation = EXCLUDED.text_translation"""),
        params,
    )
```

Remove now-unused imports/variables related to old hadith books/chapters/english.

- [ ] **Step 3: Re-ingest all data**

```bash
DATABASE_URL_SYNC=postgresql://postgres:postgres@localhost:5432/dalil python3 data/scripts/ingest.py all
```

Expected: 114 surahs, 6236 verses (now with Indonesian translation), 9 hadith collections with ID counts.

- [ ] **Step 4: Update search.py HADITH_SOURCES**

In `backend/app/services/search.py`, replace:
```python
HADITH_SOURCES = {"bukhari", "muslim", "abudawud", "tirmidhi", "nasai", "ibnmajah", "malik", "nawawi40"}
```
with:
```python
HADITH_SOURCES = {"abudawud", "ahmad", "bukhari", "darimi", "ibnmajah", "malik", "muslim", "nasai", "tirmidhi"}
```

- [ ] **Step 5: Update all field references (text_english → text_translation)**

In `backend/app/services/search.py`, change all `h.text_english` references to `h.text_translation` in the search SQL (the `hadith_results` CTE).

In `backend/app/api/hadith.py`, change `h.text_english` to `h.text_translation` in the HadithResponse creation.

- [ ] **Step 6: Commit**

```bash
git add data/scripts/ingest.py backend/app/services/search.py backend/app/api/hadith.py
git commit -m "feat(ingest): Indonesian data pipeline, hadith slug update, field rename"
```

---

## Phase 1: Stabilize & Revert Model

**Goal:** Revert to e5-large 1024-dim, fix critical bugs, re-embed all data.

### Task 1.1: Migration vector(384) → vector(1024)

**Files:**
- Create: `backend/alembic/versions/0006_revert_to_1024_dim.py`
- Modify: `backend/app/models/models.py`

- [ ] **Step 1: Create PGVector-specific migration**

```python
"""Revert embedding column from vector(384) to vector(1024)

Revision ID: 0006
Revises: 0005
"""

from collections.abc import Sequence
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_embeddings_hnsw")
    op.execute("ALTER TABLE embeddings ALTER COLUMN embedding TYPE vector(1024) USING embedding::vector(1024)")
    op.execute(
        "CREATE INDEX idx_embeddings_hnsw ON embeddings "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_embeddings_hnsw")
    op.execute("ALTER TABLE embeddings ALTER COLUMN embedding TYPE vector(384) USING embedding::vector(384)")
    op.execute(
        "CREATE INDEX idx_embeddings_hnsw ON embeddings "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200)"
    )
```

- [ ] **Step 2: Update model Vector dimension**

In `backend/app/models/models.py`, change:
```python
embedding = Column(Vector(384), nullable=False)
```
to:
```python
embedding = Column(Vector(1024), nullable=False)
```

- [ ] **Step 3: Run migration**

```bash
cd backend && DATABASE_URL_SYNC=postgresql://postgres:postgres@localhost:5432/dalil venv/bin/python -m alembic upgrade head
```

Expected: Column now `vector(1024)`, HNSW index rebuilt.

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/0006_revert_to_1024_dim.py backend/app/models/models.py
git commit -m "feat(db): revert vector dim to 1024 for e5-large"
```

---

### Task 1.2: Fix Config Defaults

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `.env`

- [ ] **Step 1: Fix config.py defaults**

```python
# Embedding
embedding_model: str = "intfloat/multilingual-e5-large-instruct"
embedding_dim: int = 1024
embedding_batch_size: int = 32
```

- [ ] **Step 2: Update .env**

In `.env`, change:
```
EMBEDDING_MODEL=all-MiniLM-L6-v2
```
to:
```
EMBEDDING_MODEL=intfloat/multilingual-e5-large-instruct
```

- [ ] **Step 3: Update backend .env symlink (if broken)**

```bash
ln -sf ../.env backend/.env
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/config.py .env
git commit -m "fix(config): align model name and dim defaults"
```

---

### Task 1.3: Fix HNSW Filtered-Query Bug

**Files:**
- Modify: `backend/app/services/search.py`

**Problem:** The `vector_results` CTE applies source-type filters (e.g., `WHERE source_type = 'quran'`) inside the HNSW-indexed `ORDER BY distance LIMIT N` query. HNSW graph traversal with restrictive WHERE filters returns too few (or zero) results because neighbors get filtered out during traversal.

**Fix:** Move source-type and collection filters OUT of the inner vector scan. Apply them in the outer `quran_results`/`hadith_results` CTEs instead.

- [ ] **Step 1: Restructure search SQL**

Replace `_VECTOR_JOIN`, `SEARCH_QUERY`, and `COUNT_QUERY`:

```python
_VECTOR_SCAN = """
    FROM embeddings e
    CROSS JOIN query_embedding qe
    WHERE 1 - (e.embedding <=> qe.vec) >= :min_score
"""

_COUNT_JOIN = """
    FROM embeddings e
    CROSS JOIN query_embedding qe
    LEFT JOIN hadith h ON h.id = e.source_id
    LEFT JOIN hadith_collections hc ON hc.id = h.collection_id
    WHERE (:source_quran OR e.source_type = 'hadith')
      AND (:source_hadith OR e.source_type = 'quran')
      AND 1 - (e.embedding <=> qe.vec) >= :min_score
      AND (
          e.source_type != 'hadith'
          OR :all_hadith_collections
          OR hc.slug = ANY(CAST(:hadith_collections AS TEXT[]))
      )
"""

SEARCH_QUERY = f"""
WITH query_embedding AS (
    SELECT CAST(:embedding AS vector) AS vec
),
vector_results AS (
    SELECT
        e.source_type,
        e.source_id,
        1 - (e.embedding <=> qe.vec) AS score
    {_VECTOR_SCAN}
    ORDER BY e.embedding <=> qe.vec
    LIMIT :candidate_limit
),
quran_results AS (
    SELECT
        'quran' AS type,
        vr.source_id::INT AS source_id,
        vr.score,
        v.id AS verse_id,
        s.name_english AS surah_name,
        s.id AS surah_number,
        v.verse_number,
        NULL::TEXT AS collection_slug,
        NULL::TEXT AS collection_name,
        NULL::TEXT AS book_name,
        NULL::TEXT AS hadith_number,
        NULL::TEXT AS chapter_name,
        NULL::TEXT AS grade,
        v.text_arabic,
        v.text_translation
    FROM vector_results vr
    JOIN verses v ON v.id = vr.source_id
    JOIN surahs s ON s.id = v.surah_id
    WHERE vr.source_type = 'quran'
      AND :source_quran
),
hadith_results AS (
    SELECT
        'hadith' AS type,
        vr.source_id::INT AS source_id,
        vr.score,
        NULL::INT AS verse_id,
        NULL::TEXT AS surah_name,
        NULL::INT AS surah_number,
        NULL::INT AS verse_number,
        hc.slug AS collection_slug,
        hc.name_eng AS collection_name,
        hb.name_eng AS book_name,
        h.hadith_number::TEXT AS hadith_number,
        h.chapter_name_eng AS chapter_name,
        h.grade,
        h.text_arabic,
        h.text_translation
    FROM vector_results vr
    JOIN hadith h ON h.id = vr.source_id
    JOIN hadith_collections hc ON hc.id = h.collection_id
    LEFT JOIN hadith_books hb
        ON hb.collection_id = h.collection_id AND hb.book_number = h.chapter_id
    WHERE vr.source_type = 'hadith'
      AND :source_hadith
      AND (:all_hadith_collections OR hc.slug = ANY(CAST(:hadith_collections AS TEXT[])))
),
combined AS (
    SELECT * FROM hadith_results
    UNION ALL
    SELECT * FROM quran_results
)
SELECT * FROM combined
ORDER BY score DESC
LIMIT :limit OFFSET :offset
"""

COUNT_QUERY = f"""
WITH query_embedding AS (
    SELECT CAST(:embedding AS vector) AS vec
)
SELECT COUNT(*) AS total
{_COUNT_JOIN}
"""
```

- [ ] **Step 2: Update candidate_limit**

In `semantic_search()`, change:
```python
candidate_limit = (offset + limit) * 5
```
to:
```python
candidate_limit = max(500, (offset + limit) * 20)
```

This ensures enough candidates survive the post-filtering.

- [ ] **Step 3: Update SQL text_translation field**

In the `hadith_results` CTE within `SEARCH_QUERY`, change `h.text_english` → `h.text_translation`.

- [ ] **Step 4: Update SearchResult schema**

In `backend/app/models/schemas.py`, change `text_translation: str | None = None` — it's already correct for the field name, but verify the SearchResult uses `text_translation` not `text_english`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/search.py backend/app/models/schemas.py
git commit -m "fix(search): restructure SQL to fix HNSW filtered-query bug"
```

---

### Task 1.4: Async-Safe embed_query

**Files:**
- Modify: `backend/app/services/embedding.py`

- [ ] **Step 1: Add async-safe wrapper**

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial

_executor = ThreadPoolExecutor(max_workers=1)


async def embed_query_async(text: str) -> np.ndarray:
    """Run embed_query in a thread pool to avoid blocking the event loop."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, embed_query, text)


async def embed_documents_async(texts: list[str], batch_size: int | None = None) -> np.ndarray:
    """Run embed_documents in a thread pool."""
    loop = asyncio.get_event_loop()
    fn = partial(embed_documents, texts, batch_size=batch_size)
    return await loop.run_in_executor(_executor, fn)
```

- [ ] **Step 2: Update search.py to use async wrapper**

In `backend/app/services/search.py`, change:
```python
embedding = embed_query(query)
```
to:
```python
embedding = await embed_query_async(query)
```

Add import: `from app.services.embedding import embed_query_async` (remove old import).

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/embedding.py backend/app/services/search.py
git commit -m "fix(search): make embed_query async-safe to unblock event loop"
```

---

### Task 1.5: Global Exception Handler

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add global exception handler**

In `main.py`, add after `app = FastAPI(...)`:

```python
from fastapi import Request
from fastapi.responses import JSONResponse
from app.models.schemas import ErrorResponse
from datetime import datetime, UTC


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="Internal server error",
            detail=str(exc) if settings.debug else None,
            timestamp=datetime.now(UTC),
        ).model_dump(),
    )
```

- [ ] **Step 2: Simplify search endpoint**

In `backend/app/api/search.py`, remove the try/except wrapper around `semantic_search`:

```python
response = await semantic_search(
    db=db,
    query=q,
    sources=source_list,
    limit=limit,
    offset=offset,
    min_score=min_score,
)
response.took_ms = round((time.monotonic() - t0) * 1000)
return response
```

(Rather than catching Exception and leaking internal details.)

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py backend/app/api/search.py
git commit -m "fix(api): global exception handler, remove leaky error in search"
```

---

### Task 1.6: Bulk Embed Script (e5-large, Resumable)

**Files:**
- Create: `data/scripts/embed_bulk.py`

- [ ] **Step 1: Create resumable bulk embed script**

```python
"""
Bulk embedding script — resumable, per-batch commit.

Usage:
    python data/scripts/embed_bulk.py [--batch 64] [--source quran|hadith|all]

Requires: DB running, model cached, .env configured.
"""

import argparse
import json
import time
from typing import Optional

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.embedding import get_model, text_hash
from app.services.search import _vector_literal

MODEL = None


def get_model_singleton():
    global MODEL
    if MODEL is None:
        print(f"Loading model: {settings.embedding_model}...")
        t0 = time.monotonic()
        MODEL = get_model()
        print(f"  Loaded in {time.monotonic() - t0:.1f}s")
    return MODEL


def embed_source(source_type: str, batch_size: int) -> int:
    model = get_model_singleton()
    engine = create_engine(settings.database_url_sync)
    total = 0

    while True:
        with Session(engine) as session:
            if source_type == "quran":
                rows = session.execute(
                    text("""SELECT v.id AS sid, v.text_arabic, v.text_translation
                             FROM verses v
                             LEFT JOIN embeddings e
                               ON e.source_type = 'quran'
                              AND e.source_id = v.id
                              AND e.model_version = :mv
                             WHERE e.id IS NULL
                             ORDER BY v.id
                             LIMIT :bs"""),
                    {"mv": settings.embedding_model, "bs": batch_size},
                ).mappings().all()
            else:
                rows = session.execute(
                    text("""SELECT h.id AS sid, h.text_arabic, h.text_translation
                             FROM hadith h
                             LEFT JOIN embeddings e
                               ON e.source_type = 'hadith'
                              AND e.source_id = h.id
                              AND e.model_version = :mv
                             WHERE e.id IS NULL
                             ORDER BY h.id
                             LIMIT :bs"""),
                    {"mv": settings.embedding_model, "bs": batch_size},
                ).mappings().all()

            if not rows:
                break

            docs = []
            for r in rows:
                parts = [r["text_arabic"].strip()]
                if r.get("text_translation") and r["text_translation"].strip():
                    parts.append(r["text_translation"].strip())
                docs.append("\n".join(parts))

            prefixed = [f"passage: {d}" for d in docs]
            vecs = model.encode(prefixed, batch_size=batch_size, normalize_embeddings=True)

            vals = []
            for row, vec in zip(rows, vecs):
                doc = "\n".join(p for p in [row["text_arabic"].strip(), (row.get("text_translation") or "").strip()] if p)
                vals.append({
                    "st": source_type,
                    "sid": row["sid"],
                    "emb": _vector_literal(vec.tolist()),
                    "th": text_hash(doc),
                    "mv": settings.embedding_model,
                })

            session.execute(
                text("""INSERT INTO embeddings (source_type, source_id, embedding, text_hash, model_version)
                         VALUES (:st, :sid, CAST(:emb AS vector), :th, :mv)
                         ON CONFLICT (source_type, source_id, model_version)
                         DO UPDATE SET embedding = EXCLUDED.embedding, text_hash = EXCLUDED.text_hash"""),
                vals,
            )
            session.commit()
            total += len(rows)
            print(f"  +{len(rows)} = {total}", flush=True)

    return total


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int, default=64, help="Batch size")
    parser.add_argument("--source", choices=["quran", "hadith", "all"], default="all")
    args = parser.parse_args()

    print(f"Settings: model={settings.embedding_model}, dim={settings.embedding_dim}")
    print(f"Source: {args.source}, batch: {args.batch}")

    sources = ["quran", "hadith"] if args.source == "all" else [args.source]

    for src in sources:
        print(f"\n=== Embedding {src} ===")
        t0 = time.monotonic()
        n = embed_source(src, args.batch)
        print(f"  Done: {n} rows in {time.monotonic() - t0:.0f}s")

    print("\n=== Complete ===")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the bulk embed**

```bash
cd backend && DATABASE_URL_SYNC=postgresql://postgres:postgres@localhost:5432/dalil timeout 14400 venv/bin/python ../data/scripts/embed_bulk.py --batch 64 --source all
```

Expected: Progress printed every batch. Total: ~42,441+ new embeddings (now with Arabic+Indonesian text).
Time: ~2 hours on CPU.

- [ ] **Step 3: Verify embeddings**

```bash
docker compose exec -T db psql -U postgres -d dalil -c "SELECT count(*), vector_dims(embedding) FROM embeddings GROUP BY vector_dims(embedding)"
```

Expected: `count=42441+`, `vector_dims=1024`.

- [ ] **Step 4: Spot-check search**

```bash
cd backend && venv/bin/python -c "
from app.services.embedding import embed_query
from app.services.search import _vector_literal
from sqlalchemy import create_engine, text

emb = embed_query('sabar')
emb_val = _vector_literal(emb.tolist())
engine = create_engine(settings.database_url_sync)

with engine.connect() as conn:
    rows = conn.execute(text('''
        SELECT source_type, source_id, 1 - (embedding <=> CAST(:emb AS vector)) AS score
        FROM embeddings
        ORDER BY embedding <=> CAST(:emb2 AS vector)
        LIMIT 5
    '''), {'emb': emb_val, 'emb2': emb_val}).all()
    for r in rows:
        print(f'{r[0]} id={r[1]} score={r[2]:.4f}')
" 2>&1
```

Expected: Scores > 0.3 for relevant queries, both quran and hadith results.

- [ ] **Step 5: Commit**

```bash
git add data/scripts/embed_bulk.py
git commit -m "feat(embed): resumable bulk embed script for e5-large"
```

---

## Phase 2: Production Hardening

**Goal:** Rate limiting, caching, logging, CORS tightening.

### Task 2.1: Rate Limiting

- [ ] **Step 1: Install slowapi**

```bash
cd backend && venv/bin/pip install slowapi
```

- [ ] **Step 2: Add middleware**

In `main.py`, add:
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

Then decorate search endpoint in `search.py`:
```python
@router.get("", response_model=SearchResponse)
@limiter.limit("10/minute")
async def search(
    q: str = Query(...),
    ...
    request: Request,
    ...
):
```

The `request: Request` param is required for slowapi.

- [ ] **Step 3: Commit**

### Task 2.2: Redis Cache

- [ ] **Step 1: Add cache helper**

```python
# backend/app/core/cache.py
import json
import hashlib
import redis as redis_lib

from app.core.config import settings

_client = None


def get_client():
    global _client
    if _client is None:
        _client = redis_lib.from_url(settings.redis_url)
    return _client


def cache_key(model_name: str, query: str) -> str:
    return f"embed:{model_name}:{hashlib.sha256(query.encode()).hexdigest()}"


def get_cached_embedding(query: str) -> list[float] | None:
    key = cache_key(settings.embedding_model, query)
    val = get_client().get(key)
    if val:
        return json.loads(val)
    return None


def set_cached_embedding(query: str, embedding: list[float]) -> None:
    key = cache_key(settings.embedding_model, query)
    get_client().setex(key, 3600, json.dumps(embedding))  # TTL: 1 hour
```

- [ ] **Step 2: Integrate into search**

In `search.py`, modify `semantic_search` to check cache before embedding.

- [ ] **Step 3: Commit**

### Task 2.3: Structured Logging

- [ ] **Step 1: Add logging middleware**

In `main.py`, add a middleware that logs request method, path, status code, and duration.

- [ ] **Step 2: Commit**

### Task 2.4: CORS from Env

In `config.py`, add default for `cors_origins` and make it read from `.env`. Current code already does this via `settings.cors_origins`. Verify it works.

---

## Phase 3: Frontend Browse Pages

**Goal:** Replace stubs with real browse pages for Quran and Hadith.

### Task 3.1: Expand API Client

- [ ] **Step 1:** Add `fetchSurahs()`, `fetchSurahDetail()`, `fetchCollections()`, `fetchCollectionHadith()` functions to `frontend/src/lib/api.ts`.

### Task 3.2: Quran Browse Page

- [ ] **Step 1:** Rewrite `frontend/src/routes/quran.tsx` to fetch surah list from API and render a grid.
- [ ] **Step 2:** Create `frontend/src/routes/quran.$surahId.tsx` for surah detail with paginated verses.
- [ ] **Step 3:** Update `routeTree.gen.ts` to register new route.

### Task 3.3: Hadith Browse Page

- [ ] **Step 1:** Rewrite `frontend/src/routes/hadith.tsx` to fetch collections list and render cards.
- [ ] **Step 2:** Create `frontend/src/routes/hadith.$slug.tsx` for collection detail with hadith list.
- [ ] **Step 3:** Update `routeTree.gen.ts`.

---

## Phase 4: Frontend Polish

**Goal:** Source filter UI, pagination, clickable results, language switcher.

### Task 4.1: Source Filter UI

- [ ] **Step 1:** Add filter dropdown/checkboxes on search page for `sources` parameter.
- [ ] **Step 2:** Wire it to the `fetchSearch` call.

### Task 4.2: Pagination Controls

- [ ] **Step 1:** Add page nav buttons below results using the `page`/`pages` fields from API response.

### Task 4.3: Clickable Result Cards

- [ ] **Step 1:** Make Quran result cards link to `/quran/{surahId}`.
- [ ] **Step 2:** Make Hadith result cards link to `/hadith/{slug}`.

### Task 4.4: Language Switcher (Skip for ID-only)

Since user chose ID-only, no switcher needed. Remove unused `GlobeIcon` from `icons.tsx` if desired.

---

## Verification Checklist

| Phase | Minimum Success |
|---|---|
| Phase 0 | 6236 Quran verses with ID translation, 9 hadith collections with ID text |
| Phase 1 | `vector(1024)` column, HNSW index, search returns results for filtered queries, async-safe embed, no error leaks |
| Phase 1 Embed | 42441+ embeddings with e5-large, score > 0.3 for relevant queries |
| Phase 2 | Rate limit triggers at 10 req/min, cache hit reduces latency, CORS tightened |
| Phase 3 | /quran shows 114 surahs, /quran/1 shows verses, /hadith shows 9 collections |
| Phase 4 | Filters change results, pagination works, result cards link to detail pages |
