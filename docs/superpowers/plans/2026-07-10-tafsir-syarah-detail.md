# Tafsir Quran & Syarah 40 Hadith Nawawi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambahkan tafsir Quran (3 sumber Indonesia) dan syarah 40 Hadith Nawawi pada page detail masing-masing, sebelum deploy.

**Architecture:** Static curated JSON dibundel di repo + kolom DB baru via baseline migration. Data → ingest (idempotent ON CONFLICT DO UPDATE) → API detail endpoint → frontend tab/section. Tidak ada runtime API eksternal, mengikuti pattern existing `data/raw/*.json → ingest → DB → API`.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL+pgvector, React 18, TanStack Router/Query, Tailwind CSS.

## Global Constraints

- Ruff lint: `E, F, W, I, UP, B, C4, SIM, N`, line-length=100, target py311
- Mypy strict; pytest untuk backend; Biome + tsc untuk frontend
- No comments unless absolutely necessary
- Arabic text pakai `.arabic-text` class + `direction: rtl`
- API routes: `/api/v1/` prefix (handled via Vite proxy + FastAPI root)
- DB migrations: Alembic only; baseline 0001 masih pre-deploy, modifikasi langsung
- Path alias frontend: `@/` → `src/`
- Ingest idempotent (ON CONFLICT DO UPDATE)
- Baseline migrationsquashed 0001; data/raw/ is the source of truth; re-ingest required

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `data/raw/quran/quran-tafsir.json` | Create | Subset tafsir dari renomureza/quran-api-id: `{surah, verse, kemenag_short, kemenag_long, quraish, jalalayn}` per ayat |
| `data/raw/hadith-id/nawawi40.json` | Create | 42 entri curated manual: `{number, arab, id, syarah}` |
| `data/raw/hadith-id/list.json` | Modify | Tambah entry nawawi40 |
| `backend/alembic/versions/0001_initial_schema.py` | Modify | +`text_tafsir JSONB` di verses, +`text_syarah Text` di hadith |
| `backend/app/models/models.py` | Modify | +`Verse.text_tafsir`, +`Hadith.text_syarah` |
| `backend/app/models/schemas.py` | Modify | +`VerseResponse.tafsir`, +`HadithResponse.text_syarah` |
| `backend/app/api/quran.py` | Modify | `get_verse` return tafsir |
| `backend/app/api/hadith.py` | Modify | `get_hadith_detail` return syarah |
| `data/scripts/ingest.py` | Modify | `_load_quran_tafsir`, upsert tafsir, +nawawi40 koleksi, +`text_syarah` di batch |
| `backend/tests/test_ingest_hadith_books.py` | Modify | +test `_prepare_hadith_row` dengan `syarah`, +test nawawi40 count |
| `frontend/src/lib/api.ts` | Modify | +`tafsir` di `VerseDetailResponse`, +`text_syarah` di `HadithInfo` |
| `frontend/src/routes/quran.$surahId.$verseNumber.tsx` | Modify | Tafsir tab UI ganti placeholder |
| `frontend/src/routes/hadith.$slug.$hadithId.tsx` | Modify | Syarah section ganti placeholder |

---

## Task 1: Prepare data files (`quran-tafsir.json` + `nawawi40.json` + `list.json`)

**Files:**
- Create: `data/raw/quran/quran-tafsir.json`
- Create: `data/raw/hadith-id/nawawi40.json`
- Modify: `data/raw/hadith-id/list.json`

**Interfaces:**
- Produces: `quran-tafsir.json` dengan structure `[{"surah": int, "verse": int, "kemenag_short": str, "kemenag_long": str, "quraish": str, "jalalayn": str}, ...]` — 6236 entries
- Produces: `nawawi40.json` dengan structure `[{"number": int, "arab": str, "id": str, "syarah": str}, ...]` — 42 entries
- Produces: `list.json` updated dengan `{"name": "40 Hadith Nawawi", "slug": "nawawi40", "total": 42}`

- [ ] **Step 1: Clone upstream repo dan extract tafsir subset**

Run:
```bash
cd /tmp/opencode && git clone --depth 1 --filter=blob:none --sparse https://github.com/renomureza/quran-api-id.git quran-api-id-tafsir 2>&1 | tail -3
```
Expected: clone sukses.

- [ ] **Step 2: Sparse checkout `src/data` lalu build tafsir subset**

Run:
```bash
cd /tmp/opencode/quran-api-id-tafsir && git sparse-checkout set src/data 2>&1 | tail -2
```
Expected: `src/data/quran.json` muncul.

- [ ] **Step 3: Write script untuk extract tafsir subset dari `quran.json` upstream**

Create temporary extractor di `/tmp/opencode/extract_tafsir.py`:

```python
"""
Extract tafsir subset dari renomureza/quran-api-id quran.json.
Output: data/raw/quran/quran-tafsir.json — [{surah, verse, kemenag_short, kemenag_long, quraish, jalalayn}, ...]
"""
import json
from pathlib import Path

SRC = Path("/tmp/opencode/quran-api-id-tafsir/src/data/quran.json")
DST = Path("<absolute-repo>/data/raw/quran/quran-tafsir.json")

with open(SRC) as f:
    surahs = json.load(f)

result = []
for surah in surahs:
    surah_num = surah["number"]
    for ayah in surah["ayahs"]:
        tafsir = ayah.get("tafsir", {})
        kemenag = tafsir.get("kemenag", {})
        result.append({
            "surah": surah_num,
            "verse": ayah["number"]["inSurah"],
            "kemenag_short": kemenag.get("short", ""),
            "kemenag_long": kemenag.get("long", ""),
            "quraish": tafsir.get("quraish", ""),
            "jalalayn": tafsir.get("jalalayn", ""),
        })

DST.parent.mkdir(parents=True, exist_ok=True)
with open(DST, "w") as f:
    json.dump(result, f, ensure_ascii=False)

print(f"Extracted {len(result)} tafsir entries to {DST}")
assert len(result) == 6236, f"Expected 6236, got {len(result)}"
```

Note: ganti `<absolute-repo>` dengan absolute path repo Dalil (dapatkan dari `pwd` di workdir).

- [ ] **Step 4: Jalankan extractor dan verifikasi output**

Run:
```bash
python3 /tmp/opencode/extract_tafsir.py
```
Expected: `Extracted 6236 tafsir entries`.

- [ ] **Step 5: Verify quran-tafsir.json structure**

Run:
```bash
python3 -c "
import json
with open('data/raw/quran/quran-tafsir.json') as f: d=json.load(f)
assert len(d) == 6236, f'len {len(d)}'
assert d[0]['surah'] == 1 and d[0]['verse'] == 1
assert all(k in d[0] for k in ['kemenag_short','kemenag_long','quraish','jalalayn']), 'missing key'
print('OK: 6236 entries, all keys present')
print('Sample 2:1 jalalayn:', next(x for x in d if x['surah']==2 and x['verse']==1)['jalalayn'][:80])
"
```
Expected: `OK: 6236 entries, all keys present`.

- [ ] **Step 6: Copy nawawi40 arabic text dari existing `hadith/nawawi40.json` sebagai base**

`data/raw/hadith/nawawi40.json` (sumber EN: Open Hadith Dataset, dengan keys `id`, `metadata`, `chapters`, `hadiths`). Hanya `hadiths[*].arabic` yang dipakai sebagai base arabic untuk nawawi40.json baru. Terjemahan ID dan syarah harus curated manual.

Create transform script `/tmp/opencode/build_nawawi40.py`:

```python
"""
Build data/raw/hadith-id/nawawi40.json dari arabic source + manual terjemahan/syarah stubs.

Isi `id` dan `syarah` dengan teks Indonesia curated. Untuk sekarang, stub dengan
string kosong agar struktur lengkap — LLM/curator isi manual setelah ini.
"""
import json
from pathlib import Path

SRC = Path("<absolute-repo>/data/raw/hadith/nawawi40.json")
DST = Path("<absolute-repo>/data/raw/hadith-id/nawawi40.json")

with open(SRC) as f:
    data = json.load(f)

hadiths = data["hadiths"]
assert len(hadiths) == 42, f"Expected 42, got {len(hadiths)}"

result = []
for h in hadiths:
    num_in_book = h["idInBook"]
    result.append({
        "number": num_in_book,
        "arab": h["arabic"].strip(),
        "id": "",  # ponytail: manual curate terjemahan Indonesia 42 hadith Nawawi
        "syarah": "",  # ponytail: manual curate syarah ringkas dari sumber Indonesia kredibel
    })

DST.parent.mkdir(parents=True, exist_ok=True)
with open(DST, "w") as f:
    json.dump(result, f, ensure_ascii=False)

print(f"Built {len(result)} nawawi40 entries at {DST}")
assert len(result) == 42
```

Ganti `<absolute-repo>` dengan absolute path repo.

- [ ] **Step 7: Jalankan builder nawawi40**

Run:
```bash
python3 /tmp/opencode/build_nawawi40.py
```
Expected: `Built 42 nawawi40 entries`.

- [ ] **Step 8: Verify nawawi40.json structure**

Run:
```bash
python3 -c "
import json
with open('data/raw/hadith-id/nawawi40.json') as f: d=json.load(f)
assert len(d) == 42, f'len {len(d)}'
assert d[0]['number'] == 1
assert all(k in d[0] for k in ['number','arab','id','syarah']), 'missing key'
assert d[0]['arab'], 'arab empty for #1'
print('OK: 42 entries, arabic filled, id/syarah stubs ready for curation')
"
```
Expected: `OK: 42 entries`.

- [ ] **Step 9: Update `list.json` dengan nawawi40**

Modify `data/raw/hadith-id/list.json` — tambahkan entry nawawi40:

```json
[
  { "name": "Abu Dawud", "slug": "abu-dawud", "total": 4419 },
  { "name": "Ahmad", "slug": "ahmad", "total": 4305 },
  { "name": "Bukhari", "slug": "bukhari", "total": 6638 },
  { "name": "Darimi", "slug": "darimi", "total": 2949 },
  { "name": "Ibnu Majah", "slug": "ibnu-majah", "total": 4285 },
  { "name": "Malik", "slug": "malik", "total": 1587 },
  { "name": "Muslim", "slug": "muslim", "total": 4930 },
  { "name": "Nasai", "slug": "nasai", "total": 5364 },
  { "name": "Tirmidzi", "slug": "tirmidzi", "total": 3625 },
  { "name": "40 Hadith Nawawi", "slug": "nawawi40", "total": 42 }
]
```

- [ ] **Step 10: Cleanuptemp dan commit**

Run:
```bash
rm -rf /tmp/opencode/quran-api-id-tafsir /tmp/opencode/extract_tafsir.py /tmp/opencode/build_nawawi40.py
git add data/raw/quran/quran-tafsir.json data/raw/hadith-id/nawawi40.json data/raw/hadith-id/list.json
git commit -m "feat: add tafsir quran data + nawawi40 curated stub data"
```
Expected: commit sukses.

---

## Task 2: DB schema — migration + model + schema additions

**Files:**
- Modify: `backend/alembic/versions/0001_initial_schema.py`
- Modify: `backend/app/models/models.py`
- Modify: `backend/app/models/schemas.py`

**Interfaces:**
- Produces: `Verse.text_tafsir` (JSONB nullable column), `Hadith.text_syarah` (Text nullable column)
- Produces: `VerseResponse.tafsir` (dict | None field), `HadithResponse.text_syarah` (str | None field)

- [ ] **Step 1: Tambah `text_tafsir` JSONB column di migration baseline verses table**

Modify `backend/alembic/versions/0001_initial_schema.py` — dalam `op.create_table("verses", ...)`, tambahkan setelah `page` column:

```python
        sa.Column("text_tafsir", sa.dialects.postgresql.JSONB(), nullable=True),
```

Full verses table block setelah modifikasi:

```python
    op.create_table(
        "verses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("surah_id", sa.SmallInteger(), sa.ForeignKey("surahs.id"), nullable=False),
        sa.Column("verse_number", sa.SmallInteger(), nullable=False),
        sa.Column("text_arabic", sa.Text(), nullable=False),
        sa.Column("text_translation", sa.Text(), nullable=True),
        sa.Column("juz", sa.SmallInteger(), nullable=True),
        sa.Column("page", sa.SmallInteger(), nullable=True),
        sa.Column("text_tafsir", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.UniqueConstraint("surah_id", "verse_number"),
    )
```

- [ ] **Step 2: Tambah `text_syarah` Text column di migration baseline hadith table**

Dalam `op.create_table("hadith", ...)`, tambahkan setelah `narrator_chain` column:

```python
        sa.Column("text_syarah", sa.Text(), nullable=True),
```

- [ ] **Step 3: Tambah import JSONB di migration file jika diperlukan**

Edit header imports:

```python
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
```

`sa.dialects.postgresql.JSONB` referensi sudah cukup via `sa.dialects.postgresql.JSONB()` (SQLAlchemy urutan path: `sqlalchemy.dialects.postgresql.JSONB`). Verifikasi tidak ada import tambahan diperlukan — `sa.dialects.postgresql.JSONB` adalah accessor valid.

- [ ] **Step 4: Tambah `text_tafsir` di Verse model (`models.py`)**

Import `JSONB` di `backend/app/models/models.py` (di atas, setelah `from sqlalchemy import ...`):

```python
from sqlalchemy.dialects.postgresql import JSONB
```

Dalam class `Verse`, setelah `page` column, tambahkan:

```python
    text_tafsir = Column(JSONB, nullable=True)
```

- [ ] **Step 5: Tambah `text_syarah` di Hadith model (`models.py`)**

Dalam class `Hadith`, setelah `narrator_chain` column, tambahkan:

```python
    text_syarah = Column(Text, nullable=True)
```

- [ ] **Step 6: Tambah `tafsir` field di `VerseResponse` (`schemas.py`)**

In `backend/app/models/schemas.py`, modify `VerseResponse`:

```python
class VerseResponse(BaseModel):
    id: int
    surah_name_arabic: str
    surah_name_english: str
    surah_number: int
    verse_number: int
    text_arabic: str
    text_translation: str | None = None
    juz: int | None = None
    revelation_type: str | None = None
    tafsir: dict | None = None
```

- [ ] **Step 7: Tambah `text_syarah` field di `HadithResponse` (`schemas.py`)**

Modify `HadithResponse`:

```python
class HadithResponse(BaseModel):
    id: int
    collection_name: str
    collection_slug: str
    book_name: str | None = None
    hadith_number: str
    chapter_name_eng: str | None = None
    chapter_name_ar: str | None = None
    text_arabic: str
    text_translation: str | None = None
    grade: str | None = None
    text_syarah: str | None = None
```

- [ ] **Step 8: Verify linting**

Run:
```bash
ruff check backend/app/models/models.py backend/app/models/schemas.py backend/alembic/versions/0001_initial_schema.py
ruff format --check backend/app/models/models.py backend/app/models/schemas.py backend/alembic/versions/0001_initial_schema.py
mypy backend/app/models/ --ignore-missing-imports
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add backend/alembic/versions/0001_initial_schema.py backend/app/models/models.py backend/app/models/schemas.py
git commit -m "feat: add text_tafsir + text_syarah columns in baseline migration and models"
```

---

## Task 3: Update ingest.py — load tafsir + nawawi40 collection + syarah field

**Files:**
- Modify: `data/scripts/ingest.py`
- Modify: `backend/tests/test_ingest_hadith_books.py`

**Interfaces:**
- Consumes: `Verse.text_tafsir` column from Task 2; `Hadith.text_syarah` column from Task 2; `quran-tafsir.json`, `nawawi40.json` from Task 1
- Produces: `_load_quran_tafsir(path)` returns `dict[tuple[int,int], dict]`; `_prepare_hadith_row` returns dict dengan key `"text_syarah"`; `HADITH_COLLECTIONS_ID` dan `HADITH_ID_FILES` include `"nawawi40"` entry; `_insert_verses_batch` dan `_insert_hadith_batch` persist tafsir/syarah

- [ ] **Step 1: Write failing test for `_load_quran_tafsir`**

Add ke `backend/tests/test_ingest_hadith_books.py` (atau buat file sibling `test_ingest_helpers.py` — reuse struktur exist di `test_ingest_hadith_books.py`):

```python
from data.scripts.ingest import _load_quran_tafsir, _prepare_hadith_row


def test_prepare_hadith_row_includes_text_syarah_when_present() -> None:
    prepared = _prepare_hadith_row(
        {"collection_id": 10},
        {"number": 1, "arab": "arabic", "id": "translation", "syarah": "syarah text"},
    )

    assert prepared["text_syarah"] == "syarah text"


def test_prepare_hadith_row_text_syarah_none_when_missing() -> None:
    prepared = _prepare_hadith_row(
        {"collection_id": 10},
        {"number": 1, "arab": "arabic", "id": "translation"},
    )

    assert prepared["text_syarah"] is None


def test_prepare_hadith_row_preserves_null_chapter_without_metadata_nawawi() -> None:
    prepared = _prepare_hadith_row(
        {"collection_id": 10},
        {"number": 1, "arab": "arabic", "id": "translation"},
    )

    assert prepared["chapter_id"] is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd backend && python -m pytest tests/test_ingest_hadith_books.py -v
```
Expected: FAIL — `ImportError: cannot import name '_load_quran_tafsir'` (plus `_prepare_hadith_row` returns dict tanpa key `text_syarah`).

- [ ] **Step 3: Tambah `_load_quran_tafsir()` di `ingest.py`**

Deklarasikan konstanta file path di atas, lalu fungsi loader baru. Tambah:

```python
QURAN_TAFSIR_JSON = DATA_RAW / "quran" / "quran-tafsir.json"
```

Deklarasikan setelah `QURAN_JSON` (line ~27).

Fungsi loader, taruh setelah `_load_quran_translation` (line ~222):

```python
def _load_quran_tafsir(path: Path) -> dict[tuple[int, int], dict]:
    with open(path) as f:
        data = json.load(f)
    result = {}
    for entry in data:
        result[(entry["surah"], entry["verse"])] = {
            "kemenag_short": entry.get("kemenag_short", ""),
            "kemenag_long": entry.get("kemenag_long", ""),
            "quraish": entry.get("quraish", ""),
            "jalalayn": entry.get("jalalayn", ""),
        }
    return result
```

- [ ] **Step 4: Update `ingest_quran` untuk load dan upsert tafsir**

Di `ingest_quran`, setelah `translation = _load_quran_translation(...)` (line ~228), tambahkan:

```python
    tafsir_map = _load_quran_tafsir(QURAN_TAFSIR_JSON)
    print(f"  Loaded {len(tafsir_map)} tafsir entries")
```

Dalam loop batch building (line ~260), tambahkan `tafsir` field kepada tiap verse dict:

```python
    batch = []
    for (surah, verse), arabic_text in sorted(arabic.items()):
        trans = translation.get((surah, verse), "")
        taf = tafsir_map.get((surah, verse))
        batch.append(
            {
                "surah_id": surah,
                "verse_number": verse,
                "text_arabic": arabic_text,
                "text_translation": trans,
                "text_tafsir": json.dumps(taf) if taf else None,
            }
        )
        if len(batch) >= 500:
            _insert_verses_batch(session, batch)
            stats["verses"] += len(batch)
            batch = []
```

Note: `json.dumps(taf) if taf else None` — `text_tafsir` column adalah JSONB; passing stringified JSON ke parameter `:tf_{i}` biar SQLAlchemy binding pakai `cast` di SQL; alternatif passing Python dict juga work, tapi konsisten dengan raw SQL pattern codebase. Detail binding di step berikutnya.

- [ ] **Step 5: Update `_insert_verses_batch` untuk include `text_tafsir`**

Replace existing `_insert_verses_batch`:

```python
def _insert_verses_batch(session: Session, batch: list[dict]) -> None:
    values = ", ".join(
        f"(:sid_{i}, :vn_{i}, :ar_{i}, :tr_{i}, CAST(:tf_{i} AS jsonb))"
        for i in range(len(batch))
    )
    params = {}
    for i, v in enumerate(batch):
        params[f"sid_{i}"] = v["surah_id"]
        params[f"vn_{i}"] = v["verse_number"]
        params[f"ar_{i}"] = v["text_arabic"]
        params[f"tr_{i}"] = v["text_translation"]
        params[f"tf_{i}"] = v["text_tafsir"]

    session.execute(
        text(f"""INSERT INTO verses (surah_id, verse_number, text_arabic, text_translation, text_tafsir)
                 VALUES {values}
                 ON CONFLICT (surah_id, verse_number) DO UPDATE SET
                     text_arabic = EXCLUDED.text_arabic,
                     text_translation = EXCLUDED.text_translation,
                     text_tafsir = EXCLUDED.text_tafsir"""),
        params,
    )
```

`CAST(:tf_{i} AS jsonb)` wajib — PostgreSQL tidak auto-cast text→jsonb; `text_tafsir` dikirim sebagai stringified JSON (`json.dumps(taf)` dari Task 3 Step 4), CAST mengonversinya ke JSONB.

- [ ] **Step 6: Tambah nawawi40 di `HADITH_ID_FILES` dan `HADITH_COLLECTIONS_ID`**

Update `HADITH_ID_FILES` (line ~148) — tambahkan entry:

```python
    "nawawi40": DATA_RAW / "hadith-id" / "nawawi40.json",
```

Update `HADITH_COLLECTIONS_ID` (line ~160) — tambahkan entry:

```python
    "nawawi40": {"name_eng": "40 Hadith Nawawi", "slug": "nawawi40"},
```

- [ ] **Step 7: Update `_prepare_hadith_row` untuk include `text_syarah`**

Replace existing `_prepare_hadith_row`:

```python
def _prepare_hadith_row(meta: dict, row: dict) -> dict:
    book = _extract_hadith_book(row)
    return {
        "collection_id": meta["collection_id"],
        "chapter_id": book["book_number"] if book else None,
        "hadith_number": str(row.get("number", "")),
        "chapter_name_eng": None,
        "chapter_name_ar": None,
        "text_arabic": row.get("arab", ""),
        "text_translation": row.get("id", ""),
        "grade": None,
        "text_syarah": row.get("syarah") or None,
    }
```

- [ ] **Step 8: Update `_insert_hadith_batch` untuk include `text_syarah`**

Replace `_insert_hadith_batch`:

```python
def _insert_hadith_batch(session: Session, batch: list[dict]) -> None:
    values = ", ".join(
        f"(:cid_{i}, :chid_{i}, :num_{i}, :ar_{i}, :tr_{i}, :sy_{i})" for i in range(len(batch))
    )
    params = {}
    for i, h in enumerate(batch):
        params[f"cid_{i}"] = h["collection_id"]
        params[f"chid_{i}"] = h["chapter_id"]
        params[f"num_{i}"] = h["hadith_number"]
        params[f"ar_{i}"] = h["text_arabic"]
        params[f"tr_{i}"] = h["text_translation"]
        params[f"sy_{i}"] = h["text_syarah"]

    session.execute(
        text(f"""INSERT INTO hadith (collection_id, chapter_id, hadith_number, text_arabic, text_translation, text_syarah)
                 VALUES {values}
                 ON CONFLICT (collection_id, hadith_number) DO UPDATE SET
                     text_arabic = EXCLUDED.text_arabic,
                     text_translation = EXCLUDED.text_translation,
                     text_syarah = EXCLUDED.text_syarah"""),
        params,
    )
```

- [ ] **Step 9: Run tests untuk verify pass**

Run:
```bash
cd backend && python -m pytest tests/test_ingest_hadith_books.py -v
```
Expected: PASS — semua existing + new tests green.

- [ ] **Step 10: Verify linting**

Run:
```bash
ruff check data/scripts/ingest.py
ruff format --check data/scripts/ingest.py
mypy data/scripts/ingest.py --ignore-missing-imports
```
Expected: no errors. Jika ruff format mengubah file moment `mypy`: jalankan `ruff format data/scripts/ingest.py` dan re-run check.

- [ ] **Step 11: Commit**

```bash
git add data/scripts/ingest.py backend/tests/test_ingest_hadith_books.py
git commit -m "feat: add tafsir loader + nawawi40 collection to ingest pipeline"
```

---

## Task 4: API endpoints return tafsir + syarah

**Files:**
- Modify: `backend/app/api/quran.py`
- Modify: `backend/app/api/hadith.py`

**Interfaces:**
- Produces: `GET /quran/{surah}/{verse}` response includes `tafsir: dict | None`
- Produces: `GET /hadith/{slug}/{id}` response includes `text_syarah: str | None`

- [ ] **Step 1: Update `get_verse` di `quran.py` untuk return `tafsir`**

Modify `backend/app/api/quran.py`, dalam `get_verse` function — `VerseResponse(...)` call (line ~98) tambah argument `tafsir=verse.text_tafsir`:

```python
    return VerseResponse(
        id=verse.id,
        surah_name_arabic=surah.name_arabic,
        surah_name_english=surah.name_english,
        surah_number=surah.id,
        verse_number=verse.verse_number,
        text_arabic=verse.text_arabic,
        text_translation=verse.text_translation,
        juz=verse.juz,
        revelation_type=surah.revelation_type,
        tafsir=verse.text_tafsir,
    )
```

- [ ] **Step 2: Update `get_hadith_detail` di `hadith.py` untuk return `text_syarah`**

Modify `backend/app/api/hadith.py`, dalam `get_hadith_detail` — `HadithResponse(...)` call (line ~114) tambah argument `text_syarah=hadith.text_syarah`:

```python
    return HadithResponse(
        id=hadith.id,
        collection_name=hadith.collection.name_eng,
        collection_slug=hadith.collection.slug,
        book_name=hadith.book.name_eng if hadith.book else None,
        hadith_number=hadith.hadith_number,
        chapter_name_eng=hadith.chapter_name_eng,
        chapter_name_ar=hadith.chapter_name_ar,
        text_arabic=hadith.text_arabic,
        text_translation=hadith.text_translation,
        grade=hadith.grade,
        text_syarah=hadith.text_syarah,
    )
```

- [ ] **Step 3: Tambah assertion via AST-based test pattern — write test ke `test_hadith_browse.py` style**

Create `backend/tests/test_detail_tafsir_syarah.py`:

```python
import ast
from pathlib import Path

QURAN_API = Path(__file__).resolve().parents[1] / "app" / "api" / "quran.py"
HADITH_API = Path(__file__).resolve().parents[1] / "app" / "api" / "hadith.py"


def test_verse_response_includes_tafsir() -> None:
    source = QURAN_API.read_text()
    assert "tafsir=verse.text_tafsir" in source, "get_verse harus pass tafsir=verse.text_tafsir ke VerseResponse"


def test_hadith_response_includes_text_syarah() -> None:
    source = HADITH_API.read_text()
    assert "text_syarah=hadith.text_syarah" in source, "get_hadith_detail harus pass text_syarah ke HadithResponse"
```

- [ ] **Step 4: Run tests untuk verify pass**

Run:
```bash
cd backend && python -m pytest tests/test_detail_tafsir_syarah.py -v
```
Expected: PASS.

- [ ] **Step 5: Verify linting**

Run:
```bash
ruff check backend/app/api/quran.py backend/app/api/hadith.py tests/test_detail_tafsir_syarah.py
ruff format --check backend/app/api/quran.py backend/app/api/hadith.py tests/test_detail_tafsir_syarah.py
mypy backend/app/api/ --ignore-missing-imports
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/quran.py backend/app/api/hadith.py backend/tests/test_detail_tafsir_syarah.py
git commit -m "feat: quran detail + hadith detail endpoints return tafsir/syarah"
```

---

## Task 5: Frontend API types + Tafsir tab UI + Syarah section

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/routes/quran.$surahId.$verseNumber.tsx`
- Modify: `frontend/src/routes/hadith.$slug.$hadithId.tsx`

**Interfaces:**
- Consumes: API dari Task 4 (`VerseDetailResponse.tafsir`, `HadithInfo.text_syarah`)
- Produces: Tafsir tab UI (3 sumber, Kemenag toggle ringkas/panjang) di page detail Quran; Syarah section di page detail Hadith

- [ ] **Step 1: Perbarui `VerseDetailResponse` di `api.ts`**

Modify `frontend/src/lib/api.ts` interface `VerseDetailResponse` (line ~113) — tambah `tafsir`:

```typescript
export interface VerseDetailResponse {
  id: number;
  surah_name_arabic: string;
  surah_name_english: string;
  surah_number: number;
  verse_number: number;
  text_arabic: string;
  text_translation: string | null;
  juz: number | null;
  revelation_type: string | null;
  tafsir: {
    kemenag_short: string;
    kemenag_long: string;
    quraish: string;
    jalalayn: string;
  } | null;
}
```

- [ ] **Step 2: Perbarui `HadithInfo` di `api.ts`**

Tambah `text_syarah` ke interface `HadithInfo` (line ~132):

```typescript
export interface HadithInfo {
  id: number;
  collection_name: string;
  collection_slug: string;
  book_name: string | null;
  hadith_number: string;
  chapter_name_eng: string | null;
  chapter_name_ar: string | null;
  text_arabic: string;
  text_translation: string | null;
  grade: string | null;
  text_syarah: string | null;
}
```

- [ ] **Step 3: Ganti placeholder tafsir di `quran.$surahId.$verseNumber.tsx`**

Replace blok placeholder `Tafsir dan Penjelasan` (line ~124-129) dengan UI tabs 3 sumber + Kemenag toggle ringkas/panjang.

Tambah `useState` import di top import block:

```typescript
import { useState } from "react";
```

Lalu import jadinya:
```typescript
import { fetchSurahs, fetchVerseDetail } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Link, createRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { rootRoute } from "./__root";
```

Tambah di dalam component `VerseDetailPage`, setelah `if (!data) return null;` (line ~49), tambah state untuk active tab:

```typescript
  const [tafsirTab, setTafsirTab] = useState<"kemenag" | "quraish" | "jalalayn">("kemenag");
  const [kemenagLong, setKemenagLong] = useState(false);
```

Replace line 124-129 (placeholder block):
```typescript
      <div className="mt-8 p-6 border border-neutral-100 rounded-xl bg-neutral-50">
        <h2 className="font-semibold text-neutral-800 mb-2">Tafsir dan Penjelasan</h2>
        <p className="text-sm text-neutral-400">
          Tafsir untuk ayat ini akan ditambahkan pada fase berikutnya.
        </p>
      </div>
```

Dengan:
```typescript
      <div className="mt-8 p-6 border border-neutral-100 rounded-xl bg-neutral-50">
        <h2 className="font-semibold text-neutral-800 mb-4">Tafsir dan Penjelasan</h2>
        {data.tafsir ? (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {(["kemenag", "quraish", "jalalayn"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTafsirTab(tab)}
                  className={`px-3 py-1 text-sm border rounded-lg transition-all ${
                    tafsirTab === tab
                      ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                      : "border-neutral-200 text-neutral-600 hover:border-emerald-300"
                  }`}
                >
                  {tab === "kemenag" ? "Kemenag" : tab === "quraish" ? "Quraish Shihab" : "Al-Jalalayn"}
                </button>
              ))}
            </div>

            {tafsirTab === "kemenag" && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setKemenagLong(!kemenagLong)}
                  className="px-2 py-0.5 text-xs border border-neutral-200 rounded text-neutral-600 hover:border-emerald-300"
                >
                  {kemenagLong ? "Ringkas" : "Panjang"}
                </button>
              </div>
            )}

            <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
              {tafsirTab === "kemenag"
                ? kemenagLong
                  ? data.tafsir.kemenag_long || data.tafsir.kemenag_short
                  : data.tafsir.kemenag_short || data.tafsir.kemenag_long
                : tafsirTab === "quraish"
                  ? data.tafsir.quraish
                  : data.tafsir.jalalayn}
            </p>
          </>
        ) : (
          <p className="text-sm text-neutral-400">
            Tafsir belum tersedia untuk ayat ini.
          </p>
        )}
      </div>
```

- [ ] **Step 4: Ganti placeholder syarah di `hadith.$slug.$hadithId.tsx`**

Tambah `whitespace-pre-line` ke syarah teks. Replace line 79-84 (placeholder block) di `frontend/src/routes/hadith.$slug.$hadithId.tsx`:

```typescript
      <div className="mt-8 p-6 border border-neutral-100 rounded-xl bg-neutral-50">
        <h2 className="font-semibold text-neutral-800 mb-2">Syarah dan Penjelasan</h2>
        <p className="text-sm text-neutral-400">
          Syarah untuk hadis ini akan ditambahkan pada fase berikutnya.
        </p>
      </div>
```

Dengan:
```typescript
      <div className="mt-8 p-6 border border-neutral-100 rounded-xl bg-neutral-50">
        <h2 className="font-semibold text-neutral-800 mb-2">Syarah dan Penjelasan</h2>
        {data.text_syarah ? (
          <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
            {data.text_syarah}
          </p>
        ) : (
          <p className="text-sm text-neutral-400">
            Syarah belum tersedia untuk hadis ini.
          </p>
        )}
      </div>
```

- [ ] **Step 5: Verify linting frontend**

Run:
```bash
npx biome check frontend/src/lib/api.ts frontend/src/routes/quran.\$surahId.\$verseNumber.tsx frontend/src/routes/hadith.\$slug.\$hadithId.tsx
npx tsc --noEmit -p frontend/
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/routes/quran.\$surahId.\$verseNumber.tsx frontend/src/routes/hadith.\$slug.\$hadithId.tsx
git commit -m "feat: tafsir tab UI + syarah section on detail pages"
```

---

## Task 6: Manual curation nawawi40 terjemahan + syarah (42 entri)

**Files:**
- Modify: `data/raw/hadith-id/nawawi40.json`

**Interfaces:**
- Consumes: `nawawi40.json` dari Task 1 (42 entri dengan `arab` terisi, `id` dan `syarah` string kosong)
- Produces: 42 entri dengan `id` (terjemahan Indonesia) dan `syarah` (syarah ringkas Indonesia) terisi

**Catatan:** Task ini content-curationbukan kode. Teman kerja collaborator/user melakukan curation manual dari sumber Indonesia kredibel (mis. rumaysho.com, muslim.or.id, nu.or.id) dengan attribution. Tidak ada step TDD otomatis untuk konten — pakai assertion count + format check.

- [ ] **Step 1: Verifikasi state awal nawawi40.json**

Run:
```bash
python3 -c "
import json
with open('data/raw/hadith-id/nawawi40.json') as f: d=json.load(f)
empty_id = sum(1 for x in d if not x['id'])
empty_sy = sum(1 for x in d if not x['syarah'])
print(f'Total: {len(d)}, empty id: {empty_id}, empty syarah: {empty_sy}')
"
```
Expected: `Total: 42, empty id: 42, empty syarah: 42`.

- [ ] **Step 2: Manual curation — isi `id` dan `syarah` untuk setiap entri**

Untuk masing-masing 42 hadith:
- Cari terjemahan Bahasa Indonesia kredibel (mis. rumaysho.com, muslim.or.id, nu.or.id, Islamhouse)
- Cari syarah ringkas (1-3 paragraf) dari sumber Indonesia; bila tidak ada, ringkas sendiri dari terjemahan Nahwawiyah Ibnu Daqiq al-'Id atau an-Nawawi
- Isi field `"id"` (terjemahan) dan `"syarah"` (penjelasan ringkas)
- Catat attribution global di atas file sebagai ganti per-entri: tambah key `"_source": "..."` optional; simpler: catat attribution di `README.md` atau `data/raw/hadith-id/README.md`

**Format `id`** — terjemahan penuh dengan sanad dan matan, mis:
```json
"id": "Telah menceritakan kepada kami [Al Humaidi Abdullah bin Az Zubair] dia berkata, Telah menceritakan kepada kami [Sufyan]... saya mendengar Rasulullah shallallahu 'alaihi wasallam bersabda: \"Semua perbuatan tergantung niatnya...\""
```

**Format `syarah`** — penjelasan ringkas (whitespace-separated paragraf), mis:
```json
"syarah": "Hadis ini adalah fondasi amal dalam Islam. Niat menentukan nilai dan jenis perbuatan. Hijrah karena Allah dan Rasul-Nya dibedakan dari hijrah karena dunia atau wanita. Hadis ini mengajarkan bahwa internalitas (hati) lebih menentukan daripada eksternalitas (tubuh)."
```

- [ ] **Step 3: Add attribution global ke `data/raw/hadith-id/README.md`**

Create file:
```markdown
# Hadith Indonesia Data

## 40 Hadith Nawawi

- Arabic source: `data/raw/hadith/nawawi40.json` (Open Hadith Dataset, comb-chain)
- Indonesian translation (`id` field): curated dari rumaysho.com / muslim.or.id / IslamHouse
- Syarah ringkas (`syarah` field): ringkasan dari Ibnu Daqiq al-'Id & an-Nawawi via sumber Indonesia kredibel

Lisensi karya terjemahan & syarah: masing-masing mengikuti sumber aslinya.
```

- [ ] **Step 4: Verifikasi semua entri terisi**

Run:
```bash
python3 -c "
import json
with open('data/raw/hadith-id/nawawi40.json') as f: d=json.load(f)
assert len(d) == 42
for x in d:
    assert x['arab'], f'arab empty for #{x[\"number\"]}'
    assert x['id'], f'id empty for #{x[\"number\"]}'
    assert x['syarah'], f'syarah empty for #{x[\"number\"]}'
print('OK: 42 entries, all fields populated')
"
```
Expected: `OK: 42 entries, all fields populated`.

- [ ] **Step 5: Commit**

```bash
git add data/raw/hadith-id/nawawi40.json data/raw/hadith-id/README.md
git commit -m "content: curate indonesian translation + syarah for 42 hadith nawawi"
```

---

## Task 7: Integration verification — ingest + smoke test end-to-end

**Files:**
- No new files; verification-only task

- [ ] **Step 1: Jalankan migration baseline (fresh DB)**

Run (but DB harus running via docker compose / local pg):
```bash
cd backend && alembic upgrade head
```
Expected: `Running upgrade  -> 0001` (no error).

- [ ] **Step 2: Jalankan ingest full**

Run:
```bash
cd backend && python -m data.scripts.ingest all
```
Atau dari project root:
```bash
python data/scripts/ingest.py all
```
Expected: printed stats:
- Quran: 114 surahs, 6236 verses
- Each hadith collection count matches data
- `nawawi40`: 42 hadith

- [ ] **Step 3: Verifikasi tafsir tersimpan**

Run (via psql atau Python):
```bash
psql "$DATABASE_URL_SYNC" -c "SELECT count(*) FROM verses WHERE text_tafsir IS NOT NULL;"
```
Expected: 6236.

Jika tidak ada psql, pakai:
```bash
python3 -c "
from sqlalchemy import create_engine, text
import os
url = os.environ.get('DATABASE_URL_SYNC', 'postgresql://postgres:postgres@localhost:5432/dalil')
e = create_engine(url)
with e.connect() as c:
    print('verses w/ tafsir:', c.execute(text('SELECT count(*) FROM verses WHERE text_tafsir IS NOT NULL')).scalar())
    print('nawawi40 total:', c.execute(text(\"SELECT count(*) FROM hadith h JOIN hadith_collections c ON h.collection_id=c.id WHERE c.slug='nawawi40'\")).scalar())
"
```
Expected:
- verses w/ tafsir: 6236
- nawawi40 total: 42

(Task 6 syarah curation di-skip — `hadith.text_syarah` akan null untuk nawawi40 dulu, UI tunjukkan placeholder; curate nanti, re-ingest idempotent.)

- [ ] **Step 4: Jalankan embeddings untuk Nawawi40**

42 hadith Nawawi adalah row baru di tabel hadith; embedding pipeline idempotent (LEFT JOIN anti pattern), akan embed otomatis saat `embed_bulk.py --source hadith` dijalankan.

Run:
```bash
python data/scripts/embed_bulk.py --source hadith --batch 32
```
Expected: tambah +42 embeddings (atau +0 kalau sudah pernah di-embed). Bukan target ketat — yang penting pipeline berjalan.

- [ ] **Step 5: Jalankan full test suite**

Run:
```bash
cd backend && python -m pytest -v
```
Expected: PASS semua.

- [ ] **Step 6: Verify frontend type-check dan lint**

Run:
```bash
npx tsc --noEmit -p frontend/
npx biome check frontend/src/
```
Expected: no errors.

- [ ] **Step 7: Manual smoke**

Start dev stack:
```bash
docker compose up -d
cd backend && uvicorn app.main:app --reload &
cd frontend && npm run dev
```

Kunjungi via browser:
- `http://localhost:5173/quran/2/255` — pastikan tab tafsir tampil (Kemenag/Quraish/Jalalayn), isinya muncul
- `http://localhost:5173/hadith/nawawi40/1` — pastikan terjemahan ID + syarah section muncul
- `http://localhost:5173/hadith/bukhari/1` — pastikan syarah placeholder "Syarah belum tersedia untuk hadis ini" muncul (karena bukan Nawawi)

- [ ] **Step 8: Final commit check (kalau ada perubahan terakhir)**

Cek `git status`. Kalau bersih, lewat. Kalau ada perubahan:
```bash
git add -A && git commit -m "chore: integration verification complete"
```

---

## Self-Review Checklist

**Spec coverage:**

| Spec section | Task |
|---|---|
| 3. Arsitektur & komponen | Task 1-5 |
| 4. Data model & migration (verses JSONB, hadith Text, Nawawi collection) | Task 2 |
| 5. Ingestion pipeline (tafsir loader, Nawawi upsert, syarah) | Task 3 |
| 6. API response (VerseResponse.tafsir, HadithResponse.text_syarah) | Task 4 |
| 7. Frontend & UX (tabs tafsir + syarah section) | Task 5 |
| Manual curation Nawawi (terjemahan + syarah) | Task 6 |
| 8. Error handling (null fallback UI) | Task 5 |
| 9. Testing | Tersebar TDD per task + Task 7 integration |
| 2. Sumber data (tafsir dari renomureza, nawawi manual) | Task 1 & 6 |

**Tipe konsistensi check:**

- `text_tafsir` JSONB column (Task 2) → `_load_quran_tafsir` returns `dict[inttuple, dict]` (Task 3) → `VerseResponse.tafsir: dict | None` (Task 2 schemas) → API returns `tafsir=verse.text_tafsir` (Task 4) → frontend `VerseDetailResponse.tafsir` object (Task 5) → UI tabs `(kemenag_short, kemenag_long, quraish, jalalayn)` (Task 5). Konsisten.

- `text_syarah` Text column (Task 2) → `_prepare_hadith_row["text_syarah"]` (Task 3) → `_insert_hadith_batch` `:sy_{i}` params (Task 3) → `HadithResponse.text_syarah` (Task 2 schemas) → API `text_syarah=hadith.text_syarah` (Task 4) → frontend `HadithInfo.text_syarah` (Task 5). Konsisten.

- Nawawi40 koleksi: `HADITH_ID_FILES["nawawi40"]` + `HADITH_COLLECTIONS_ID["nawawi40"]` (Task 3) → ingest loop main iterates `HADITH_BOOKS` (existing, derived from `HADITH_COLLECTIONS_ID`) → DB row di `hadith_collections` id=10 + 42 rows di `hadith` → API hadith detail returns data. Konsisten.

**No placeholders:** Semua code blocks lengkap. Task 6 berisi curation manual (memang harus manual — data tidak ada source terbuka) dengan format dan source list.

**Risk yang diakui di plan:** Task 6 bukan tugas kode — content manual curation. Diserahkan ke collaborator; task 7 mengasumsikan task 6 selesai untuk verifikasi penuh syarah. Task 7 tetap berjalan untuk tafsir & Nawawi arabic tanpa syarah (fallback placeholder muncul).