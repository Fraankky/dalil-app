import { BookOpenIcon, FilterIcon, SearchIcon, StarIcon } from "@/components/icons";
import { type SearchResponse, type SearchResult, fetchSearch } from "@/lib/api";
import { Link, createRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
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

function getQueryParam(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("q") || "";
}

function SearchPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState(getQueryParam);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState(q || "");
  const [page, setPage] = useState(1);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const doSearch = useCallback(async (query: string, p: number, sources: string[]) => {
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const params = {
        q: query,
        limit: 20,
        offset: (p - 1) * 20,
        sources: sources.length > 0 ? sources.join(",") : undefined,
      };
      const res = await fetchSearch(params);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (q) {
      setInputValue(q);
      doSearch(q, page, selectedSources);
    }
  }, [q, page, selectedSources, doSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setPage(1);
      setQ(inputValue.trim());
      navigate({ to: "/search", search: { q: inputValue.trim() } });
    }
  };

  const toggleSource = (slug: string) => {
    setSelectedSources((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
    setPage(1);
  };

  if (!q) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <SearchBar value={inputValue} onChange={setInputValue} onSubmit={handleSubmit} />
        <div className="text-center pt-16 text-neutral-400">Enter a search query to begin.</div>
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

      {showFilters && (
        <div className="mb-6 p-4 border border-neutral-200 rounded-xl bg-neutral-50">
          <p className="text-sm font-medium text-neutral-700 mb-2">Filter by source:</p>
          <div className="flex flex-wrap gap-2">
            {HADITH_SOURCES.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => toggleSource(s.slug)}
                className={`px-3 py-1 text-xs rounded-full border transition-all ${
                  selectedSources.includes(s.slug)
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
                  setPage(1);
                }}
                className="px-3 py-1 text-xs rounded-full border border-red-200 text-red-500 hover:bg-red-50"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {loading && <LoadingSkeleton />}
      {error && <div className="text-red-500 mt-4">{error}</div>}

      {data && (
        <>
          <div className="flex items-center justify-between text-sm text-neutral-500 mt-6 mb-4">
            <span>
              {data.total.toLocaleString()} result{data.total !== 1 ? "s" : ""} &middot;{" "}
              {data.took_ms}ms
            </span>
          </div>

          <div className="space-y-4">
            {data.results.map((result, i) => (
              <ResultCard key={`${result.type}-${result.source_id}-${i}`} result={result} />
            ))}
          </div>

          {data.results.length === 0 && (
            <div className="text-center py-16 text-neutral-400">
              No results found. Try different keywords or a more general query.
            </div>
          )}

          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-4 py-2 text-sm border border-neutral-200 rounded-lg disabled:opacity-40 hover:border-emerald-300 transition-all"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(data.pages, 10) }, (_, i) => {
                const start = Math.max(1, page - 4);
                const p = start + i;
                if (p > data.pages) return null;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
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
                onClick={() => setPage(page + 1)}
                className="px-4 py-2 text-sm border border-neutral-200 rounded-lg disabled:opacity-40 hover:border-emerald-300 transition-all"
              >
                Next
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
          placeholder="Refine your search..."
        />
      </div>
      <button
        type="submit"
        className="px-5 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
      >
        Search
      </button>
    </form>
  );
}

function ResultCard({ result }: { result: SearchResult }) {
  const linkTo =
    result.type === "quran" && result.surah_number
      ? `/quran/${result.surah_number}`
      : result.type === "hadith" && result.collection_slug
        ? `/hadith/${result.collection_slug}`
        : null;

  const card = (
    <div className="border border-neutral-200 rounded-xl p-5 hover:border-emerald-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              result.type === "quran"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            <BookOpenIcon className="w-3 h-3" />
            {result.type === "quran" ? "Qur'an" : "Hadith"}
          </span>
          {result.type === "quran" && result.surah_name && (
            <span className="text-sm font-medium text-neutral-700">
              {result.surah_name}{" "}
              {result.verse_number && `(${result.surah_number}:${result.verse_number})`}
            </span>
          )}
          {result.type === "hadith" && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-neutral-700">{result.collection_name}</span>
              {result.grade && (
                <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                  {result.grade}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs shrink-0">
          <StarIcon className="text-amber-400 w-3.5 h-3.5" />
          <span className="font-medium text-neutral-600">{result.relevance}%</span>
        </div>
      </div>

      <p className="arabic-text mb-3 text-neutral-800">{result.text_arabic}</p>

      {result.text_translation && (
        <p className="text-sm text-neutral-600 border-t border-neutral-100 pt-3 leading-relaxed">
          {result.text_translation}
        </p>
      )}

      {result.type === "hadith" && result.chapter_name && (
        <p className="text-xs text-neutral-400 mt-2">Chapter: {result.chapter_name}</p>
      )}
    </div>
  );

  if (linkTo) {
    return <Link to={linkTo}>{card}</Link>;
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
  validateSearch: (params: Record<string, unknown>): { q: string } => {
    return { q: (params.q as string) || "" };
  },
  component: SearchPage,
});
