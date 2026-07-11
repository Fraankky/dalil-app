# Hero Stats Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 2-row stats bar below the hero search section showing loaded data counts and available tafsir features.

**Architecture:** Fetch stats from existing `GET /api/v1/stats` endpoint using `useQuery`, display numbers + feature tags. Tafsir sources hardcoded on frontend since they're fixed pipeline outputs.

**Tech Stack:** React 18, TanStack Query 5, Tailwind CSS 3, FastAPI

**Global Constraints**
- Arabic text uses `.arabic-text` CSS class with `direction: rtl`
- API base: `/api/v1` (from `API_BASE` constant)
- Follow existing patterns in `frontend/src/lib/api.ts` for API functions
- No new backend changes needed
- Stats bar hidden on error (graceful degradation)
- Loading state shows skeleton cards

---

### Task 1: Add fetchStats to API client

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Produces: `StatsResponse` type, `fetchStats()` function

- [ ] **Step 1: Add StatsResponse type and fetchStats to api.ts**

Add after the `fetchCollectionHadith` function at the end of the file:

```typescript
export interface StatsResponse {
  total_verses: number;
  total_surahs: number;
  total_hadith: number;
  total_collections: number;
  total_embeddings: number;
  quran_embeddings: number;
  hadith_embeddings: number;
  model_name: string;
  model_dim: number;
}

export async function fetchStats(): Promise<StatsResponse> {
  const res = await apiFetch(`${API_BASE}/stats`);
  if (!res.ok) throw new ApiError("Gagal memuat data. Coba lagi nanti.", res.status);
  return readJson<StatsResponse>(res);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add fetchStats API client"
```

---

### Task 2: Render stats bar in hero section

**Files:**
- Modify: `frontend/src/routes/index.tsx`

**Interfaces:**
- Consumes: `fetchStats()` + `StatsResponse` from `api.ts`

- [ ] **Step 1: Update imports in index.tsx**

Add `useQuery` and fetchStats to existing imports:

```typescript
import { SearchIcon } from "@/components/icons";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStats, type StatsResponse } from "@/lib/api";
import { rootRoute } from "./__root";
```

- [ ] **Step 2: Add fetchStats query inside HomePage component**

Add after `const [query, setQuery] = useState("");`:

```typescript
const { data: stats } = useQuery({
  queryKey: ["stats"],
  queryFn: fetchStats,
  staleTime: 5 * 60 * 1000,
});
```

- [ ] **Step 3: Add stats bar JSX between search form and suggestion pills**

After the closing `</form>` tag (line 62) and before the suggestion pills `<div>` (line 64), insert:

```tsx
{stats && (
  <div className="mb-8">
    <div className="flex flex-wrap justify-center gap-4 mb-3">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-neutral-200 shadow-sm">
        <BookOpenIcon className="size-5 text-emerald-600" />
        <div>
          <span className="font-bold text-neutral-900">{stats.total_surahs}</span>
          <span className="text-sm text-neutral-500 ml-1">Surah</span>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-neutral-200 shadow-sm">
        <BookOpenIcon className="size-5 text-emerald-600" />
        <div>
          <span className="font-bold text-neutral-900">{stats.total_verses.toLocaleString("id")}</span>
          <span className="text-sm text-neutral-500 ml-1">Ayat</span>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-neutral-200 shadow-sm">
        <BookOpenIcon className="size-5 text-emerald-600" />
        <div>
          <span className="font-bold text-neutral-900">{stats.total_collections}</span>
          <span className="text-sm text-neutral-500 ml-1">Koleksi</span>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-neutral-200 shadow-sm">
        <BookOpenIcon className="size-5 text-emerald-600" />
        <div>
          <span className="font-bold text-neutral-900">{stats.total_hadith.toLocaleString("id")}</span>
          <span className="text-sm text-neutral-500 ml-1">Hadits</span>
        </div>
      </div>
    </div>
    <div className="flex flex-wrap justify-center gap-2">
      <span className="px-3 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full">
        Tafsir Kemenag
      </span>
      <span className="px-3 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full">
        Tafsir Quraish Shihab
      </span>
      <span className="px-3 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full">
        Tafsir Jalalayn
      </span>
    </div>
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/index.tsx
git commit -m "feat: add stats bar to hero section"
```
