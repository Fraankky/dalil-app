import { FilterIcon } from "@/components/icons";
import { ResultCard } from "@/components/search/ResultCard";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchSkeleton } from "@/components/search/SearchSkeleton";
import { fetchSearch } from "@/lib/api";
import { useDocumentTitle } from "@/lib/hooks";
import { useQuery } from "@tanstack/react-query";
import { createRoute, useNavigate, useSearch } from "@tanstack/react-router";
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
const TAB_LABELS = ["Semua", "Qur'an", "Hadits"] as const;

function SearchPage() {
  const navigate = useNavigate();
  const { q, page, activeTab, sources, showFilters } = useSearch({ from: "/search" });
  useDocumentTitle(q ? `Cari: ${q} — Dalil` : "Cari — Dalil");

  const selectedSources = sources ? sources.split(",").filter(Boolean) : [];
  const sourcesParam =
    activeTab === "all"
      ? undefined
      : activeTab === "quran"
        ? "quran"
        : selectedSources.length > 0
          ? selectedSources.join(",")
          : HADITH_SLUGS.join(",");

  const { data, isLoading, error } = useQuery({
    queryKey: ["search", q, page, activeTab, sources],
    queryFn: () => fetchSearch({ q, limit: 20, offset: (page - 1) * 20, sources: sourcesParam }),
    enabled: !!q,
  });

  const nav = (
    overrides: Partial<{
      q: string;
      page: number;
      activeTab: typeof activeTab;
      sources: string;
      showFilters: boolean;
    }>,
  ) => {
    navigate({
      to: "/search",
      search: { q, page: 1, activeTab, sources, showFilters, ...overrides },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = (e.target as HTMLFormElement).querySelector<HTMLInputElement>(
      'input[name="q"]',
    )?.value;
    if (val?.trim()) {
      navigate({
        to: "/search",
        search: { q: val.trim(), page: 1, activeTab, sources, showFilters },
      });
    }
  };

  const handleTabChange = (tab: typeof activeTab) => {
    nav({
      activeTab: tab,
      showFilters: tab === "hadith" ? showFilters : false,
      sources: "",
      page: 1,
    });
  };

  const toggleSource = (slug: string) => {
    if (activeTab !== "hadith") return;
    const next =
      selectedSources.length === 0
        ? HADITH_SLUGS.filter((s) => s !== slug).join(",")
        : selectedSources.includes(slug)
          ? selectedSources.filter((s) => s !== slug).join(",")
          : [...selectedSources, slug].join(",");
    nav({ sources: next });
  };

  if (!q) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-8">
        <SearchBar onSubmit={handleSubmit} />
        <div className="text-center pt-20 text-[var(--text-3)]">
          Masukkan kata kunci untuk mulai mencari dalil.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-8">
      <div className="flex items-center gap-2 mb-5">
        <div className="flex-1">
          <SearchBar onSubmit={handleSubmit} />
        </div>
        <button
          type="button"
          onClick={() => nav({ showFilters: !showFilters })}
          className={`p-3 border rounded-btn transition-all text-[var(--text-2)] ${
            showFilters
              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
              : "border-[var(--border)]"
          }`}
        >
          <FilterIcon />
        </button>
      </div>

      <div className="flex gap-1 mb-6 p-1 bg-[var(--surface-2)] rounded-btn">
        {(["all", "quran", "hadith"] as const).map((tab, i) => (
          <button
            key={tab}
            type="button"
            onClick={() => handleTabChange(tab)}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab
                ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                : "text-[var(--text-2)] hover:text-[var(--text)]"
            }`}
          >
            {TAB_LABELS[i]}
          </button>
        ))}
      </div>

      {showFilters && activeTab === "hadith" && (
        <div className="mb-6 p-4 border border-[var(--border)] rounded-btn bg-[var(--surface-2)]">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-3)] mb-3">
            Filter sumber hadits:
          </p>
          <div className="flex flex-wrap gap-2">
            {HADITH_SOURCES.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => toggleSource(s.slug)}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                  selectedSources.length === 0 || selectedSources.includes(s.slug)
                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                    : "bg-[var(--surface)] text-[var(--text-2)] border-[var(--border)] hover:border-[var(--accent)]"
                }`}
              >
                {s.label}
              </button>
            ))}
            {selectedSources.length > 0 && (
              <button
                type="button"
                onClick={() => nav({ sources: "" })}
                className="px-3 py-1 text-xs rounded-full border border-red-200 text-red-500 hover:bg-red-50"
              >
                Hapus semua
              </button>
            )}
          </div>
        </div>
      )}

      {isLoading && <SearchSkeleton />}
      {error && <div className="text-red-500 mt-4">{error.message}</div>}

      {data && (
        <>
          <div className="flex items-center justify-between text-sm text-[var(--text-3)] mt-4 mb-5">
            <span>
              {data.total.toLocaleString()} hasil &middot; {data.took_ms}ms
            </span>
          </div>

          <div className="space-y-4">
            {data.results.map((result, i) => (
              <ResultCard
                key={`${result.type}-${result.source_id}-${i}`}
                result={result}
                query={q}
              />
            ))}
          </div>

          {data.results.length === 0 && (
            <div className="text-center py-20 text-[var(--text-3)]">
              <p className="font-serif text-lg text-[var(--text-2)] mb-2">Tidak ada hasil</p>
              <p className="text-sm">Coba kata kunci lain atau istilah yang lebih umum.</p>
            </div>
          )}

          {data.pages > 1 && <SearchPagination total={data.pages} current={page} nav={nav} />}
        </>
      )}
    </div>
  );
}

function SearchPagination({
  total,
  current,
  nav,
}: {
  total: number;
  current: number;
  nav: (overrides: { page: number }) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        type="button"
        disabled={current <= 1}
        onClick={() => nav({ page: current - 1 })}
        className="px-4 py-2 text-sm border border-[var(--border)] rounded-btn disabled:opacity-30 hover:border-[var(--accent)] text-[var(--text-2)] transition-all"
      >
        Sebelumnya
      </button>
      {Array.from({ length: Math.min(total, 10) }, (_, i) => {
        const start = Math.max(1, current - 4);
        const p = start + i;
        if (p > total) return null;
        return (
          <button
            key={p}
            type="button"
            onClick={() => nav({ page: p })}
            className={`w-9 h-9 text-sm rounded-btn transition-all ${
              p === current
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--border)] text-[var(--text-2)] hover:border-[var(--accent)]"
            }`}
          >
            {p}
          </button>
        );
      })}
      <button
        type="button"
        disabled={current >= total}
        onClick={() => nav({ page: current + 1 })}
        className="px-4 py-2 text-sm border border-[var(--border)] rounded-btn disabled:opacity-30 hover:border-[var(--accent)] text-[var(--text-2)] transition-all"
      >
        Berikutnya
      </button>
    </div>
  );
}

export const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  validateSearch: (params: Record<string, unknown>) => ({
    q: typeof params.q === "string" ? params.q : "",
    page: Number(params.page) || 1,
    activeTab: (["all", "quran", "hadith"] as string[]).includes(params.activeTab as string)
      ? (params.activeTab as "all" | "quran" | "hadith")
      : ("all" as const),
    sources: typeof params.sources === "string" ? params.sources : "",
    showFilters: params.showFilters === "true" || params.showFilters === true,
  }),
  component: SearchPage,
});
