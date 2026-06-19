import { BookOpenIcon, SearchIcon, StarIcon } from "@/components/icons";
import { type SearchResponse, type SearchResult, fetchSearch } from "@/lib/api";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { rootRoute } from "./__root";

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

  const doSearch = useCallback(async (query: string) => {
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSearch({ q: query, limit: 20 });
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
      doSearch(q);
    }
  }, [q, doSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setQ(inputValue.trim());
      navigate({
        to: "/search",
        search: { q: inputValue.trim() },
      });
    }
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
      <SearchBar value={inputValue} onChange={setInputValue} onSubmit={handleSubmit} />

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
  return (
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
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 mt-6 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton, never reorders
        <div key={i} className="border border-neutral-200 rounded-xl p-5">
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
