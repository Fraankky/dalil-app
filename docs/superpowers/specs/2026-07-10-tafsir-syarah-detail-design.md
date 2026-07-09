# Tafsir Quran & Syarah 40 Hadith Nawawi — Design

## 1. Ringkasan

Sebelum deploy, tambahkan dua fitur konten di page detail:

1. **Tafsir Quran** — 3 sumber tafsir Bahasa Indonesia per-ayat (Kemenag, Quraish Shihab, Al-Jalalayn), ditampilkan via tabs di `/quran/{surah}/{verse}`.
2. **Syarah 40 Hadith Nawawi** — 42 hadith Nawawi sebagai koleksi baru dengan terjemahan Indonesia + syarah ringkas, ditampilkan di `/hadith/nawawi40/{id}`.

PRD mencatat tafsir/sharh sebagai out-of-scope MVP (Section 8), tapi data source tafsir Quran sudah tersedia (MIT) dan UI placeholder sudah ada, jadi fitur ini feasible pre-deploy.

## 2. Sumber Data

| Fitur | Sumber | Lisensi | Status |
|---|---|---|---|
| Tafsir Quran (3 sumber ID) | `renomureza/quran-api-id` `src/data/quran.json` (25MB, 114 surah, per-ayat: `tafsir.{kemenag,quraish,jalalayn}`) | MIT | Siap pakai, di-bundle ke repo |
| Terjemahan ID 40 Nawawi | Tidak ada dataset terbuka terstruktur | — | Manual curate (42 entri bounded) |
| Syarah 40 Nawawi | Tidak ada dataset terbuka terstruktur | — | Manual curate dari sumber Indonesia kredibel (rumaysho.com, muslim.or.id, NU) dengan attribution |

**Catatan:** syarah full untuk kitab lain (Bukhari, Muslim, dll) tidak realistis sebelum deploy — karya asli (Fath al-Bari, Syarh an-Nawawi) belum terdigitalisasi per-hadith dalam bahasa Indonesia. Syarah hadith selain Nawawi tetap placeholder di UI.

## 3. Arsitektur & Komponen

Approach: static curated JSON + DB column. Data dibundel dengan app, no runtime API eksternal, mengikuti pattern existing `data/raw/*.json → ingest → DB → API`.

```
data/raw/
├── quran/
│   └── quran-tafsir.json        ← BARU (25MB, dari renomureza/quran-api-id)
├── hadith-id/
│   ├── nawawi40.json            ← BARU (curated manual: 42 entri {number,arab,id,syarah})
│   └── list.json                ← DIUBAH (tambah entry nawawi40)

backend/
├── alembic/versions/0001_initial_schema.py  ← DIUBAH (pre-deploy, tambah kolom)
├── app/models/models.py                     ← DIUBAH (+text_tafsir, +text_syarah)
├── app/models/schemas.py                    ← DIUBAH (response +field)
├── app/api/quran.py                         ← DIUBAH (get_verse +tafsir)
├── app/api/hadith.py                        ← DIUBAH (get_hadith_detail +syarah)
└── data/scripts/ingest.py                   ← DIUBAH (load tafsir, +nawawi40 koleksi)

frontend/src/
├── lib/api.ts                               ← DIUBAH (type +field)
└── routes/
    ├── quran.$surahId.$verseNumber.tsx      ← DIUBAH (tab tafsir UI)
    └── hadith.$slug.$hadithId.tsx           ← DIUBAH (syarah section UI)
```

**Boundary:** tafsir/syarah hanya di-return oleh detail endpoint, tidak ikut search results / listing payload (tetap ringan). Tafsir Quran tidak di-embed (konteks tambahan, bukan dokumen search). 42 hadith Nawawi di-embed seperti hadith lain (bagian dari koleksi yang di-search).

**Tidak ada komponen/library baru** — semua modifikasi file existing, conditional render + Tailwind classes yang sudah dipakai.

## 4. Data Model & Migration

Baseline 0001 masih pre-deploy (squashed, belum prod), jadi modifikasi langsung tanpa migration tambahan.

### Verses table

```sql
ALTER TABLE verses ADD COLUMN text_tafsir JSONB DEFAULT NULL;
-- struktur: {"kemenag_short": str, "kemenag_long": str, "quraish": str, "jalalayn": str}
```

Alasan 1 kolom JSONB, bukan 4 kolom: tafsir selalu di-fetch bersamaan, tidak pernah di-query per-field, dan ringkas. JSONB mudah bertambah key (mis. Saadi nanti). `ponytail: JSONB aggregation, 3 string columns if query-per-field needed`.

### Hadith table

```sql
ALTER TABLE hadith ADD COLUMN text_syarah Text DEFAULT NULL;
```

Hanya 42 entri Nawawi yang terisi; null untuk kitab lain.

### Nawawi40 collection

Pattern sama dengan 9 kitab lain — pakai tabel `hadith_collections` + `hadith` existing, id 10:

```python
# ingest.py HADITH_COLLECTIONS_ID
"nawawi40": {"name_eng": "40 Hadith Nawawi", "slug": "nawawi40"},
```

Tidak ada perubahan schema untuk Nawawi — `syarah` field masuk ke `hadith.text_syarah`.

### File format nawawi40.json

Sama dengan format hadith-id lain (`number`, `arab`, `id`) + field `syarah`:

```json
[
  {
    "number": 1,
    "arab": "عَنْ أَمِيرِ الْمُؤْمِنِينَ أَبِي حَفْصٍ... (arabic text)",
    "id": "Telah menceritakan kepadaku... (indonesian translation)",
    "syarah": "Syarah ringkas: Hadis ini... (penjelasan bahasa Indonesia)"
  }
]
```

## 5. Ingestion Pipeline

### Tafsir Quran

| Langkah | Detail |
|---|---|
| Source | `data/raw/quran/quran-tafsir.json` |
| Load | `_load_quran_tafsir()` baru — map `(surah, verse) → {kemenag_short, kemenag_long, quraish, jalalayn}` |
| Upsert | `ON CONFLICT (surah_id, verse_number) DO UPDATE SET text_tafsir = EXCLUDED.text_tafsir` |
| Embedding | Tidak — tafsir bukan dokumen search |

### Nawawi40

| Langkah | Detail |
|---|---|
| Source | `data/raw/hadith-id/nawawi40.json` |
| Load | Loop hadiths existing + field `syarah` |
| Upsert | `_prepare_hadith_row` + `text_syarah` di `_insert_hadith_batch` |
| Embedding | Ya — 42 hadith di-embed seperti hadith lain |

`ingest.py` idempotent (ON CONFLICT DO UPDATE) — aman re-run.

## 6. API Response

### VerseResponse (quran.py `get_verse`)

```python
tafsir: dict | None = None
# {"kemenag_short", "kemenag_long", "quraish", "jalalayn"}
```

### HadithResponse (hadith.py `get_hadith_detail`)

```python
text_syarah: str | None = None
```

Listing/browsing endpoint tidak return tafsir/syarah (tetap ringan).

## 7. Frontend & UX

### Tafsir Quran — `/quran/{surah}/{verse}`

Ganti placeholder (line 124-129) dengan tabs 3 sumber:

```
┌─────────────────────────────────────────┐
│ Tafsir dan Penjelasan                    │
│ ┌──────┐ ┌────────┐ ┌──────────┐        │
│ │Kemenag│ │Quraish │ │Al-Jalalayn│       │
│ └──────┘ └────────┘ └──────────┘        │
│ [Konten tafsir tab terpilih]            │
│ Untuk Kemenag: toggle Ringkas ⇄ Panjang │
└─────────────────────────────────────────┘
```

- State: `useState` lokal untuk active tab
- Kemenag sub-toggle Ringkas/Panjang
- Button group + conditional render (Tailwind classes existing, no library)
- Empty: kalau `data.tafsir` null → "Tafsir belum tersedia untuk ayat ini"

### Syarah Hadith — `/hadith/{slug}/{id}`

Ganti placeholder (line 79-84):

```
┌─────────────────────────────────────────┐
│ Syarah dan Penjelasan                    │
│ [Teks syarah — whitespace-pre-line]     │
└─────────────────────────────────────────┘
```

- Render `data.text_syarah` dengan `whitespace-pre-line`
- Null/empty (semua kecuali Nawawi40) → "Syarah belum tersedia untuk hadis ini"
- Attribution global di README, tidak perlu per-entri UI

## 8. Error Handling

- Tafsir null untuk ayat tertentu (source tidak lengkap) → UI fallback ringkas, tidak crash
- Syarah null untuk hadith non-Nawawi → placeholder teks, konsisten UX sekarang
- Ingest partial failure → idempotent re-run (ON CONFLICT DO UPDATE)

## 9. Testing

- Backend: pytest existing pattern — test ingest tafsir + nawawi40 count assertions
- Self-check untuk nawawi40.json: assert len == 42 (bounded, trivial)
- Frontend: smoke test render detail page dengan tafsir/syarah mock data

## 10. Out of Scope

- Syarah untuk kitab hadith selain 40 Nawawi
- Tafsir bahasa selain Indonesia
- User annotation / bookmark tafsir
- Search inside tafsir/syarah content