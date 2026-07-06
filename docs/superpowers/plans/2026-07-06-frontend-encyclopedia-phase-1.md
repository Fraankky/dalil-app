# Frontend Encyclopedia Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current frontend into an Indonesian-language encyclopedia experience for Quran and Hadith evidence, with focused detail pages, fixed routing, pagination, and search-result deep links.

**Architecture:** Keep the existing Vite, React, TanStack Router, React Query, and Tailwind structure. Extend the API client, add focused detail route files, update existing routes in place, and keep public paths as `/quran` and `/hadith` while localizing visible UI text to Indonesian.

**Tech Stack:** React 18, TypeScript 5, Vite 5, TanStack Router, TanStack React Query, Tailwind CSS, FastAPI `/api/v1` browse endpoints.

---

## Scope

In scope:
- Translate frontend UI copy to Indonesian.
- Add Quran verse detail at `/quran/$surahId/$verseNumber`.
- Ensure `/quran/$surahId` displays the full surah in one page.
- Add Hadith detail at `/hadith/$slug/$hadithId`.
- Add pagination UI to `/hadith/$slug`.
- Link search Quran results to verse detail and Hadith results to hadith detail.
- Replace internal `<a href>` links with TanStack `Link`.
- Add Indonesian loading, empty, and error states.

Out of scope:
- Real tafsir or syarah data ingestion.
- Accounts, bookmarks, PWA, SEO, or offline work.
- Backend schema changes.
- Renaming routes to `/alquran` or `/hadis`.

## Files

- Modify `opencode.json`: add `@dietrichgebert/ponytail` beside superpowers.
- Modify `frontend/src/lib/api.ts`: add `VerseDetailResponse`, `fetchVerseDetail`, and `fetchHadithDetail`.
- Modify `frontend/src/routeTree.gen.ts`: register new detail routes.
- Modify `frontend/src/routes/__root.tsx`: Indonesian navbar/footer and SPA links.
- Modify `frontend/src/routes/index.tsx`: Indonesian homepage copy.
- Modify `frontend/src/routes/search.tsx`: Indonesian copy and deep links.
- Modify `frontend/src/routes/quran.tsx`: Indonesian Quran index and query states.
- Modify `frontend/src/routes/quran.$surahId.tsx`: full surah display and clickable ayah cards.
- Create `frontend/src/routes/quran.$surahId.$verseNumber.tsx`: verse detail page with tafsir placeholder.
- Modify `frontend/src/routes/hadith.tsx`: Indonesian collection index and query states.
- Modify `frontend/src/routes/hadith.$slug.tsx`: paginated hadith list and clickable hadith cards.
- Create `frontend/src/routes/hadith.$slug.$hadithId.tsx`: hadith detail page with syarah placeholder.

## Task 1: OpenCode Ponytail Plugin

**Files:**
- Modify: `opencode.json`

- [ ] Add `@dietrichgebert/ponytail` to the existing `plugin` array without removing `superpowers@git+https://github.com/obra/superpowers.git`.
- [ ] Run `node -e "JSON.parse(require('fs').readFileSync('opencode.json','utf8')); console.log('opencode.json valid')"`.
- [ ] Expected output: `opencode.json valid`.
- [ ] Tell the user to restart OpenCode because config is loaded once and is not hot-reloaded.

## Task 2: API Client Detail Fetchers

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] Add `VerseDetailResponse` after `SurahDetailResponse` with fields from backend `VerseResponse`: `id`, `surah_name_arabic`, `surah_name_english`, `surah_number`, `verse_number`, `text_arabic`, `text_translation`, `juz`, `revelation_type`.
- [ ] Add `fetchVerseDetail(surahNumber: number, verseNumber: number): Promise<VerseDetailResponse>` using `GET ${API_BASE}/quran/${surahNumber}/${verseNumber}`.
- [ ] Add `fetchHadithDetail(slug: string, hadithId: number): Promise<HadithInfo>` using `GET ${API_BASE}/hadith/${slug}/${hadithId}`.
- [ ] Keep existing API types and functions unchanged unless TypeScript requires a narrow edit.
- [ ] Run `npx tsc --noEmit` from `frontend`.
- [ ] Expected: exit 0.

## Task 3: Root Layout Localization

**Files:**
- Modify: `frontend/src/routes/__root.tsx`

- [ ] Import `Link` from `@tanstack/react-router` together with `Outlet` and `createRootRoute`.
- [ ] Replace the internal brand and nav anchors with `Link` components.
- [ ] Change visible labels to Indonesian: `Cari`, `Al-Qur'an`, `Hadis`.
- [ ] Change footer copy to `Dalil - Ensiklopedia dalil Islam berbasis pencarian makna.`
- [ ] Run `npx tsc --noEmit` from `frontend`.
- [ ] Expected: exit 0.

## Task 4: Homepage Localization

**Files:**
- Modify: `frontend/src/routes/index.tsx`

- [ ] Change heading to `Temukan Dalil Islam Berdasarkan Makna`.
- [ ] Change description to explain Quran and Hadith search in Indonesian.
- [ ] Change placeholder to `Coba "sabar dalam Islam", "hak tetangga", atau "الصبر"`.
- [ ] Change submit button to `Cari`.
- [ ] Use Indonesian suggestions: `Sabar dalam Islam`, `Hak tetangga`, `الصبر`, `Ampunan`, `Jujur dalam berdagang`.
- [ ] Run `npx tsc --noEmit` from `frontend`.
- [ ] Expected: exit 0.

## Task 5: Quran Index Page

**Files:**
- Modify: `frontend/src/routes/quran.tsx`

- [ ] Destructure React Query result as `{ data: surahs, isLoading, isError }`.
- [ ] Change title to `Jelajahi Al-Qur'an`.
- [ ] Change description to `Pilih surat untuk membaca ayat Arab dan terjemahannya.`
- [ ] Change loading text to `Memuat daftar surat...`.
- [ ] Render an error state: `Gagal memuat daftar surat. Coba muat ulang halaman.`
- [ ] Render an empty state when `surahs?.length === 0`: `Belum ada data surat.`
- [ ] Change suffix from `verses` to `ayat`.
- [ ] Keep each surah card linking to `/quran/$surahId`.
- [ ] Run `npx tsc --noEmit` from `frontend`.
- [ ] Expected: exit 0.

## Task 6: Full Surah Page

**Files:**
- Modify: `frontend/src/routes/quran.$surahId.tsx`

- [ ] Import `Link` from `@tanstack/react-router`.
- [ ] Call `fetchSurahDetail(Number(surahId), 1, 286)` so the full surah fits in one page, including Al-Baqarah.
- [ ] Include `isError` from `useQuery`.
- [ ] Change loading text to `Memuat surat...`.
- [ ] Add error state: `Gagal memuat surat. Coba kembali ke daftar surat.`
- [ ] Replace the back anchor with `Link` to `/quran` and label `Kembali ke daftar surat`.
- [ ] Show metadata: `${data.surah.verses_count} ayat` and `Makkiyah/Madaniyah` when available.
- [ ] Wrap each verse card in `Link` to `/quran/$surahId/$verseNumber` with params from the current verse.
- [ ] Keep Arabic text using `arabic-text` and `dir="rtl"`.
- [ ] Run `npx tsc --noEmit` from `frontend`.
- [ ] Expected: exit 0.

## Task 7: Quran Verse Detail Page

**Files:**
- Create: `frontend/src/routes/quran.$surahId.$verseNumber.tsx`
- Modify: `frontend/src/routeTree.gen.ts`

- [ ] Create route with parent `surahDetailRoute`, path `/$verseNumber`, and component `VerseDetailPage`.
- [ ] Use `useParams({ from: "/quran/$surahId/$verseNumber" })`.
- [ ] Fetch with `useQuery({ queryKey: ["verse", surahId, verseNumber], queryFn: () => fetchVerseDetail(Number(surahId), Number(verseNumber)) })`.
- [ ] Render loading text `Memuat detail ayat...`.
- [ ] Render error state `Gagal memuat detail ayat.`.
- [ ] Render a focused card containing surah name, `Ayat {verse_number}`, Arabic text, translation, `Juz {juz}` when present, and a section titled `Tafsir dan Penjelasan`.
- [ ] Tafsir placeholder text: `Tafsir untuk ayat ini akan ditambahkan pada fase berikutnya.`
- [ ] Add a `Link` back to `/quran/$surahId` labeled `Kembali ke surat`.
- [ ] Register the route in `routeTree.gen.ts` as a child of `surahDetailRoute`.
- [ ] Run `npx tsc --noEmit` from `frontend`.
- [ ] Expected: exit 0.

## Task 8: Hadith Collection Index

**Files:**
- Modify: `frontend/src/routes/hadith.tsx`

- [ ] Destructure React Query result as `{ data: collections, isLoading, isError }`.
- [ ] Change title to `Jelajahi Kitab Hadis`.
- [ ] Change description to `Pilih kitab untuk membaca hadis Arab dan terjemahannya.`
- [ ] Change loading text to `Memuat daftar kitab...`.
- [ ] Render error state: `Gagal memuat daftar kitab. Coba muat ulang halaman.`
- [ ] Render empty state when `collections?.length === 0`: `Belum ada data kitab hadis.`
- [ ] Keep collection cards linking to `/hadith/$slug`.
- [ ] Run `npx tsc --noEmit` from `frontend`.
- [ ] Expected: exit 0.

## Task 9: Paginated Hadith List Page

**Files:**
- Modify: `frontend/src/routes/hadith.$slug.tsx`

- [ ] Import `Link` and `useSearch` from `@tanstack/react-router`.
- [ ] Add `validateSearch` to `hadithCollectionRoute` returning `{ page: Number(params.page) || 1 }`.
- [ ] Read page with `useSearch({ from: "/hadith/$slug" })`.
- [ ] Fetch with `fetchCollectionHadith(slug, page, 20)` and query key `["hadith", slug, page]`.
- [ ] Include `isError` from `useQuery`.
- [ ] Replace back anchor with `Link` to `/hadith` and label `Kembali ke daftar kitab`.
- [ ] Change loading text to `Memuat hadis...`.
- [ ] Render error state: `Gagal memuat hadis.`
- [ ] Render empty state: `Belum ada hadis pada halaman ini.`
- [ ] Make each hadith card a `Link` to `/hadith/$slug/$hadithId` with params `{ slug, hadithId: String(h.id) }`.
- [ ] Add pagination controls with `Sebelumnya`, `Berikutnya`, and `Halaman {data.page} dari {data.total_pages}`.
- [ ] Disable previous when `page <= 1` and next when `page >= data.total_pages`.
- [ ] Run `npx tsc --noEmit` from `frontend`.
- [ ] Expected: exit 0.

## Task 10: Hadith Detail Page

**Files:**
- Create: `frontend/src/routes/hadith.$slug.$hadithId.tsx`
- Modify: `frontend/src/routeTree.gen.ts`

- [ ] Create route with parent `hadithCollectionRoute`, path `/$hadithId`, and component `HadithDetailPage`.
- [ ] Use `useParams({ from: "/hadith/$slug/$hadithId" })`.
- [ ] Fetch with `useQuery({ queryKey: ["hadith-detail", slug, hadithId], queryFn: () => fetchHadithDetail(slug, Number(hadithId)) })`.
- [ ] Render loading text `Memuat detail hadis...`.
- [ ] Render error state `Gagal memuat detail hadis.`.
- [ ] Render a focused card containing collection name, hadith number, book/chapter if present, grade if present, Arabic text, translation, and a section titled `Syarah dan Penjelasan`.
- [ ] Syarah placeholder text: `Syarah untuk hadis ini akan ditambahkan pada fase berikutnya.`
- [ ] Add a `Link` back to `/hadith/$slug` labeled `Kembali ke kitab`.
- [ ] Register the route in `routeTree.gen.ts` as a child of `hadithCollectionRoute`.
- [ ] Run `npx tsc --noEmit` from `frontend`.
- [ ] Expected: exit 0.

## Task 11: Search Page Localization and Deep Links

**Files:**
- Modify: `frontend/src/routes/search.tsx`

- [ ] Change empty query message to `Masukkan kata kunci untuk mulai mencari dalil.`
- [ ] Change filter label to `Filter sumber:`.
- [ ] Change clear button to `Hapus semua`.
- [ ] Change result count text to `{data.total.toLocaleString()} hasil`.
- [ ] Change no-results text to `Tidak ada hasil ditemukan. Coba kata kunci lain atau istilah yang lebih umum.`
- [ ] Change pagination labels to `Sebelumnya` and `Berikutnya`.
- [ ] Change search input placeholder to `Perbaiki pencarian...` and submit button to `Cari`.
- [ ] Change result badge labels to `Al-Qur'an` and `Hadis`.
- [ ] Change `Chapter:` to `Bab:`.
- [ ] For Quran results, link to `/quran/$surahId/$verseNumber` when both `surah_number` and `verse_number` exist; otherwise link to `/quran/$surahId` when `surah_number` exists.
- [ ] For Hadith results, link to `/hadith/$slug/$hadithId` when `collection_slug` and `source_id` exist; otherwise link to `/hadith/$slug` when `collection_slug` exists.
- [ ] Use TanStack `Link` with typed `to` and `params`, not raw interpolated path strings.
- [ ] Run `npx tsc --noEmit` from `frontend`.
- [ ] Expected: exit 0.

## Task 12: Verification and Quality Gates

**Files:**
- No direct edits unless verification reveals failures.

- [ ] Run `node -e "JSON.parse(require('fs').readFileSync('opencode.json','utf8')); console.log('opencode.json valid')"` from repo root.
- [ ] Expected: `opencode.json valid`.
- [ ] Run `npx tsc --noEmit` from `frontend`.
- [ ] Expected: exit 0.
- [ ] Run `npx biome check src/` from `frontend`.
- [ ] Expected: exit 0. If Biome reports formatting or lint issues, fix only the files touched by this plan.
- [ ] If Ponytail is available after restarting OpenCode, run its recommended code-quality review against the touched frontend files and address issues that improve correctness, efficiency, or maintainability without expanding scope.
- [ ] Manually smoke-test these routes in the browser: `/`, `/search?q=sabar`, `/quran`, `/quran/1`, `/quran/1/1`, `/hadith`, `/hadith/bukhari`, and one `/hadith/bukhari/{id}` from a visible hadith card.

## Self-Review

- Spec coverage: all requested areas are covered: Indonesian UI, Quran detail ayat with tafsir placeholder, full surah page, Hadith paginated kitab page, Hadith detail page, route fixes, and encyclopedia direction.
- Placeholder scan: tafsir and syarah placeholders are intentional product placeholders because actual content is out of scope for this phase.
- Type consistency: route names and params match existing route style: `/quran/$surahId`, `/quran/$surahId/$verseNumber`, `/hadith/$slug`, and `/hadith/$slug/$hadithId`.
- Scope check: this is a single frontend phase with no backend schema changes.

## Execution Options

Plan complete. Recommended execution is task-by-task with verification after each task. Use subagent-driven development for parallel review if available, or inline execution with checkpoints if keeping all changes in this session.
