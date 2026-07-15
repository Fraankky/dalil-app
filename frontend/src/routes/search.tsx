import { BookOpenIcon, FilterIcon, SearchIcon, StarIcon } from "@/components/icons";
import { type SearchResult, fetchSearch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Link, createRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { rootRoute } from "./__root";

const HADITH_SOURCES = [
  { slug: "abudawud", label: "Abu Dawud" },
  { slug: "ahmad", label: "Ahmad" },
  { slug: "bukhari", label: "Bukhari" },
  { slug: "darimi", label: "Darimi" },
  { slug: "ibnmajah", label: "Ibnu Majah" },
  { slug: "malik", label: "Malik" },
  { slug: "muslim", label: "Muslim" },
  { slug: "nasai", label: "Nasai" },
  { slug: "tirmidhi", label: "Tirmidzi" },
];

const HADITH_SLUGS = HADITH_SOURCES.map((s) => s.slug);

function highlightMatch(text: string | null, query: string): ReactNode {
  if (!text || !query) return text ?? null;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  if (parts.length <= 1) return text;
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? <mark key={i} className="bg-yellow-200 rounded-sm">{part}</mark> : part,
  );
}

function SearchPage() {
  const navigate = useNavigate();
  const { q, page } = useSearch({ from: "/search" });
  const [inputValue, setInputValue] = useState(q || "");
  const [activeTab, setActiveTab] = useState<"all" | "quran" | "hadith">("all");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const sourcesParam = (() => {
    if (activeTab === "all") return undefined;
    if (activeTab === "quran") return "quran";
    return selectedSources.length > 0 ? selectedSources.join(",") : HADITH_SLUGS.join(",");
  })();

  const { data, isLoading, error } = useQuery({
    queryKey: ["search", q, page, activeTab, selectedSources],
    queryFn: () =>
      fetchSearch({
        q,
        limit: 20,
        offset: (page - 1) * 20,
        sources: sourcesParam,
      }),
    enabled: !!q,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      navigate({ to: "/search", search: { q: inputValue.trim(), page: 1 } });
    }
  };

  const handleTabChange = (tab: "all" | "quran" | "hadith") => {
    setActiveTab(tab);
    if (tab !== "hadith") setShowFilters(false);
    navigate({ to: "/search", search: { q, page: 1 } });
  };

  const toggleSource = (slug: string) => {
    if (activeTab !== "hadith") return;
    setSelectedSources((prev) => {
      if (prev.length === 0) return HADITH_SLUGS.filter((s) => s !== slug);
      if (prev.includes(slug)) {
        const next = prev.filter((s) => s !== slug);
        return next.length === 0 ? [] : next;
      }
      return [...prev, slug];
    });
    navigate({ to: "/search", search: { q, page: 1 } });
  };

  if (!q) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <SearchBar value={inputValue} onChange={setInputValue} onSubmit={handleSubmit} />
        <div className="text-center pt-16 text-neutral-400">
          Masukkan kata kunci untuk mulai mencari dalil.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1">
          <SearchBar value={inputValue} onChange={setInputValue} onSubmit={handleSubmit} />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`p-3 border-2 rounded-xl transition-all ${
            showFilters ? "border-emerald-500 bg-emerald-50" : "border-neutral-200"
          }`}
        >
          <FilterIcon />
        </button>
      </div>

      <div className="flex gap-1 mb-5 p-1 bg-neutral-100 rounded-xl">
        {(["all", "quran", "hadith"] as const).map((tab) => {
          const label = tab === "all" ? "Semua" : tab === "quran" ? "Qur'an" : "Hadits";
          return (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab ? "bg-white text-emerald-700 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {showFilters && activeTab === "hadith" && (
        <div className="mb-6 p-4 border border-neutral-200 rounded-xl bg-neutral-50">
          <p className="text-sm font-medium text-neutral-700 mb-2">Filter sumber:</p>
          <div className="flex flex-wrap gap-2">
            {HADITH_SOURCES.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => toggleSource(s.slug)}
                className={`px-3 py-1 text-xs rounded-full border transition-all ${
                  selectedSources.length === 0 || selectedSources.includes(s.slug)
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-neutral-600 border-neutral-300 hover:border-emerald-400"
                }`}
              >
                {s.label}
              </button>
            ))}
            {selectedSources.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSources([]);
                  navigate({ to: "/search", search: { q, page: 1 } });
                }}
                className="px-3 py-1 text-xs rounded-full border border-red-200 text-red-500 hover:bg-red-50"
              >
                Hapus semua
              </button>
            )}
          </div>
        </div>
      )}

      {isLoading && <LoadingSkeleton />}
      {error && <div className="text-red-500 mt-4">{error.message}</div>}

      {data && (
        <>
          <div className="flex items-center justify-between text-sm text-neutral-500 mt-6 mb-4">
            <span>
              {data.total.toLocaleString()} hasil &middot; {data.took_ms}ms
            </span>
          </div>

          <div className="space-y-4">
            {data.results.map((result, i) => (
              <ResultCard key={`${result.type}-${result.source_id}-${i}`} result={result} query={q} />
            ))}
          </div>

          {data.results.length === 0 && (
            <div className="text-center py-16 text-neutral-400">
              Tidak ada hasil ditemukan. Coba kata kunci lain atau istilah yang lebih umum.
            </div>
          )}

          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => navigate({ to: "/search", search: { q, page: page - 1 } })}
                className="px-4 py-2 text-sm border border-neutral-200 rounded-lg disabled:opacity-40 hover:border-emerald-300 transition-all"
              >
                Sebelumnya
              </button>
              {Array.from({ length: Math.min(data.pages, 10) }, (_, i) => {
                const start = Math.max(1, page - 4);
                const p = start + i;
                if (p > data.pages) return null;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => navigate({ to: "/search", search: { q, page: p } })}
                    className={`w-9 h-9 text-sm rounded-lg transition-all ${
                      p === page
                        ? "bg-emerald-600 text-white"
                        : "border border-neutral-200 hover:border-emerald-300"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={page >= data.pages}
                onClick={() => navigate({ to: "/search", search: { q, page: page + 1 } })}
                className="px-4 py-2 text-sm border border-neutral-200 rounded-lg disabled:opacity-40 hover:border-emerald-300 transition-all"
              >
                Berikutnya
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SearchBar({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <div className="flex-1 flex items-center border-2 border-neutral-200 rounded-xl focus-within:border-emerald-500 transition-all">
        <span className="pl-3 text-neutral-400">
          <SearchIcon />
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-3 bg-transparent outline-none"
          aria-label="Cari dalil"
          placeholder="Perbaiki pencarian..."
        />
      </div>
      <button
        type="submit"
        className="px-5 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
      >
        Cari
      </button>
    </form>
  );
}

function ResultCard({ result, query }: { result: SearchResult; query: string }) {
  const linkProps:
    | { to: "/quran/$surahId/$verseNumber"; params: { surahId: string; verseNumber: string } }
    | { to: "/quran/$surahId"; params: { surahId: string } }
    | { to: "/hadith/$slug/$hadithId"; params: { slug: string; hadithId: string } }
    | { to: "/hadith/$slug"; params: { slug: string } }
    | null = (() => {
    if (result.type === "quran" && result.surah_number && result.verse_number) {
      return {
        to: "/quran/$surahId/$verseNumber",
        params: { surahId: String(result.surah_number), verseNumber: String(result.verse_number) },
      };
    }
    if (result.type === "quran" && result.surah_number) {
      return {
        to: "/quran/$surahId",
        params: { surahId: String(result.surah_number) },
      };
    }
    if (result.type === "hadith" && result.collection_slug && result.source_id) {
      return {
        to: "/hadith/$slug/$hadithId",
        params: { slug: result.collection_slug, hadithId: String(result.source_id) },
      };
    }
    if (result.type === "hadith" && result.collection_slug) {
      return {
        to: "/hadith/$slug",
        params: { slug: result.collection_slug },
      };
    }
    return null;
  })();

  const card = (
    <div className="border border-neutral-200 rounded-xl p-5 hover:border-emerald-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {result.type === "quran" && (
            <>
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                <BookOpenIcon className="w-3 h-3" />
                QS {result.surah_number}:{result.verse_number}
              </span>
              {result.surah_name && (
                <span className="text-sm font-medium text-neutral-700">{result.surah_name}</span>
              )}
            </>
          )}
          {result.type === "hadith" && result.hadith_number && (
            <>
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                <BookOpenIcon className="w-3 h-3" />
                No. {result.hadith_number}
              </span>
              <span className="text-sm font-medium text-neutral-700">{result.collection_name}</span>
              {result.grade && (
                <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                  {result.grade}
                </span>
              )}
            </>
          )}
          {result.type === "hadith" && !result.hadith_number && (
            <span className="text-sm font-medium text-neutral-700">{result.collection_name}</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs shrink-0">
          <StarIcon className="text-amber-400 w-3.5 h-3.5" />
          <span className="font-medium text-neutral-600">{result.relevance}%</span>
        </div>
      </div>

      <p className="arabic-text mb-3 text-neutral-800" dir="rtl">
        {result.text_arabic}
      </p>

      {result.text_translation && (
        <p className="text-sm text-neutral-600 border-t border-neutral-100 pt-3 leading-relaxed">
          {highlightMatch(result.text_translation, query)}
        </p>
      )}

      {result.type === "hadith" && result.chapter_name && (
        <p className="text-xs text-neutral-400 mt-2">Bab: {result.chapter_name}</p>
      )}
    </div>
  );

  if (linkProps) {
    return <Link {...linkProps}>{card}</Link>;
  }
  return card;
}

function LoadingSkeleton() {
  const skeletonKeys = ["first", "second", "third", "fourth", "fifth"];

  return (
    <div className="space-y-4 mt-6 animate-pulse">
      {skeletonKeys.map((key) => (
        <div key={key} className="border border-neutral-200 rounded-xl p-5">
          <div className="h-4 bg-neutral-100 rounded w-1/3 mb-3" />
          <div className="h-16 bg-neutral-50 rounded mb-3" />
          <div className="h-4 bg-neutral-100 rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}

export const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  validateSearch: (params: Record<string, unknown>): { q: string; page: number } => {
    return {
      q: typeof params.q === "string" ? params.q : "",
      page: Number(params.page) || 1,
    };
  },
  component: SearchPage,
});
