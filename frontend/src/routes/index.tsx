import { BookOpenIcon, SearchIcon } from "@/components/icons";
import { Chip } from "@/components/ui";
import { fetchStats } from "@/lib/api";
import { useDocumentTitle } from "@/lib/hooks";
import { useQuery } from "@tanstack/react-query";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { rootRoute } from "./__root";

const SEARCH_DEFAULTS = { activeTab: "all" as const, sources: "", showFilters: false };

function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  useDocumentTitle("Dalil — Cari Ayat & Hadits");

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    staleTime: 5 * 60 * 1000,
  });

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) return;
      navigate({
        to: "/search",
        search: {
          ...SEARCH_DEFAULTS,
          q: query.trim(),
          page: 1,
        },
      });
    },
    [query, navigate],
  );

  const handleSuggestion = (q: string) => {
    setQuery(q);
    navigate({ to: "/search", search: { ...SEARCH_DEFAULTS, q, page: 1 } });
  };

  return (
    <div className="max-w-3xl mx-auto px-5 pt-28 pb-16">
      <div className="text-center mb-12">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--text-3)] mb-4">
          Ensiklopedia Dalil Islam
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl font-light tracking-tight text-[var(--text)] leading-[1.15] mb-4">
          Temukan Dalil Berdasarkan Makna
        </h1>
        <p className="text-base sm:text-lg text-[var(--text-2)] max-w-lg mx-auto leading-relaxed">
          Cari ayat Al-Qur'an dan hadis dalam bahasa Arab, Inggris, atau transliterasi. Didukung AI
          semantik.
        </p>
      </div>

      <form onSubmit={handleSearch} className="relative mb-12">
        <div className="flex items-center border border-[var(--border)] rounded-btn bg-white dark:bg-[var(--surface)] shadow-sm focus-within:border-[var(--accent)] focus-within:shadow-sm transition-all">
          <span className="pl-4 text-[var(--text-3)]">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Coba "sabar dalam Islam", "hak tetangga", atau "الصبر"'
            className="w-full px-4 py-3.5 text-base bg-transparent outline-none placeholder:text-[var(--text-3)]"
          />
          <button
            type="submit"
            disabled={!query.trim()}
            className="m-1.5 px-5 py-2 text-sm font-medium text-white bg-[var(--accent)] rounded-btn hover:bg-[var(--accent-strong)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Cari
          </button>
        </div>
      </form>

      <div className="text-center mb-4">
        <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--text-3)] block mb-3">
          Populer
        </span>
        <div className="flex flex-wrap justify-center gap-2">
          {["Sabar", "Puasa", "Sholat", "Tawakal", "Sedekah", "Taubat", "Syukur", "Ikhlas"].map(
            (topic) => (
              <Chip key={topic} onClick={() => handleSuggestion(topic)}>
                {topic}
              </Chip>
            ),
          )}
        </div>
      </div>

      {stats && (
        <div className="mt-14 pt-10 border-t border-[var(--border)]">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
            <StatCard value={stats.total_surahs} label="Surah" />
            <StatCard value={stats.total_verses.toLocaleString("id")} label="Ayat" />
            <StatCard value={stats.total_collections} label="Koleksi" />
            <StatCard value={stats.total_hadith.toLocaleString("id")} label="Hadits" />
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            <span className="px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-full text-[var(--text-3)] border border-[var(--border)]">
              Tafsir Kemenag
            </span>
            <span className="px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-full text-[var(--text-3)] border border-[var(--border)]">
              Tafsir Quraish Shihab
            </span>
            <span className="px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-full text-[var(--text-3)] border border-[var(--border)]">
              Tafsir Jalalayn
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-serif text-2xl font-medium text-[var(--text)]">{value}</span>
      <span className="text-sm text-[var(--text-3)]">{label}</span>
    </div>
  );
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});
