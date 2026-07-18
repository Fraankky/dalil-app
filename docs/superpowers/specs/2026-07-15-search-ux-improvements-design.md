# Search UX Improvements

## Overview

Three UX improvements to the search results page: category filter tabs (Quran/Hadith/All), keyword highlighting in translation text, and better metadata badges in result cards.

## Files Changed

| File | What |
|---|---|
| `frontend/src/lib/utils.ts` | New `highlightMatch` helper |
| `frontend/src/routes/search.tsx` | Tabs state, conditional chip rendering, ResultCard header redesign, highlight usage |

No backend changes.

## 1. Category Filter (3 Tabs)

Segmented control above results header: **Semua / Qur'an / Hadits**.

**State:**
- `activeTab: "all" | "quran" | "hadith"` — new state in `SearchPage`
- Default: `"all"`

**Behavior per tab:**
- **Semua** → `sources: null` (status quo — both Quran + all hadith)
- **Qur'an** → `sources: ["quran"]`
- **Hadits** → `sources: all 9 hadith slugs by default` (same as current "all hadith filter on" behavior). Existing collection chips show **below the tabs** only when `activeTab === "hadith"`. Selecting/deselecting chips updates `sources` within the hadith scope.

**Source param construction logic** (replace current `sources` in search fetch):
```
if (activeTab === "all") sources = null
else if (activeTab === "quran") sources = ["quran"]
else if (activeTab === "hadith") sources = selectedHadithSlugs
```

Existing pagination, relevance, `_source_flags` all work unchanged because backend already handles `"quran"` as a source value.

**UI:**
- Three equally-wide pills in a row, `rounded-full` or segmented control style using existing `clsx` patterns
- Active tab: brand accent (`bg-emerald-600`/`text-white`), inactive tabs: muted (`bg-gray-100`)
- Collection chips (existing design) only visible when `activeTab === "hadith"`.

## 2. Keyword Highlighting in Translation

**Approach:** Frontend-only. Backend returns plain text as-is. Frontend highlights the query substring in `text_translation` before rendering.

**Helper** — `highlightMatch(text: string, query: string): ReactNode`:

```
function highlightMatch(text: string | null, query: string): ReactNode {
  if (!text || !query) return text ?? null
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-200">{part}</mark>
      : part
  )
}
```

**Usage in `ResultCard`** — only for `text_translation`:
```
<HighlightedText text={result.text_translation} query={query} />
```

Arabic text (`text_arabic`) remains unhighlighted. Only applies to keywords in translation field.

### Skipped (ponytail)
- Backend `ts_headline` snippet — add when semantic search path is used more heavily and query-result gaps emerge.
- Arabic text highlighting — add when requested.

## 3. Metadata Badge Redesign

Replace current header text with two pill badges inline:

**Quran result:**
```
[ QS 2:255 ] Al-Baqarah
```
- Pill: `bg-emerald-100 text-emerald-800` (soft green), label: `QS {surah_number}:{verse_number}`
- Text label: `{surah_name}` (English, as returned)
- Relevance pill stays top-right, unchanged

**Hadith result:**
```
[ No. 1234 ] Shahih Bukhari • Shahih
```
- Pill: `bg-amber-100 text-amber-800` (soft amber), label: `No. {hadith_number}`
- Text label: `{collection_name}` + `• {grade}` (same grade pill as existing)

**Layout:**
- First row: pill badge + source label (inline, left), relevance (right)
- Then Arabic text (full width)
- Then translation text
- Then chapter (hadith only)

## Implementation Order

1. `highlightMatch` helper in `utils.ts`
2. Tabs state + param logic in `search.tsx`
3. Conditional collection chip rendering
4. ResultCard header redesign with pill badges + highlight

## Self-Review Check

- No placeholders: all states explicitly covered (all/quran/hadith, empty results, no query)
- No backend changes required
- Backward compatible: existing URL params + default tab = "all" preserves current behavior
- Filter construction: `"quran"` source value already supported by `_source_flags` in backend
- Highlight edge cases: null text, empty query, regex-special characters all handled
- No ambiguity: tabs are radio-style (three states), collection chips nested under hadith tab
