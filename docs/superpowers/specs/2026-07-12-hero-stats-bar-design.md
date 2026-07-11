# Hero Stats Bar — Design Spec

Add a stats bar below the hero search section showing what data has been loaded and what features are available.

## Layout

Two rows between the search form and the suggestion pills on the homepage (`frontend/src/routes/index.tsx`).

### Row 1: Stats Cards

4 cards horizontal (flex-wrap on mobile), centered, with subtle styling:

| Icon | Number | Label |
|------|--------|-------|
| BookOpenIcon | 114 | Surah |
| BookOpenIcon | 6.236 | Ayat |
| BookOpenIcon | 10 | Koleksi |
| BookOpenIcon | 30.000+ | Hadits |

### Row 2: Feature Tags

Small pill badges showing available tafsir sources:

`Tafsir Kemenag` `Tafsir Quraish Shihab` `Tafsir Jalalayn`

## Data

### Backend (`GET /api/v1/stats`)

No changes needed. Existing endpoint returns all needed numbers.

### Frontend

Add `fetchStats()` function and `StatsResponse` type to `frontend/src/lib/api.ts`.

Use `useQuery` from TanStack Query in the hero component to fetch stats.

Tafsir sources are fixed (from ingest pipeline: `kemenag_short`, `kemenag_long`, `quraish`, `jalalayn`). Hardcode them on frontend, only shown when `total_verses > 0`.

## States

- **Loading**: 4 skeleton cards (gray shimmer)
- **Error**: Stats bar hidden entirely, rest of hero unaffected (graceful degradation)
- **Success**: Stats cards + feature tags rendered

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/lib/api.ts` | Add `fetchStats()` + `StatsResponse` |
| `frontend/src/routes/index.tsx` | Fetch stats, render 2-row stats bar |
