import { useQuery } from "@tanstack/react-query";
import { createRoute, Link } from "@tanstack/react-router";
import { fetchSurahs } from "@/lib/api";
import { rootRoute } from "./__root";

function QuranPage() {
  const { data: surahs, isLoading } = useQuery({
    queryKey: ["surahs"],
    queryFn: fetchSurahs,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Browse the Qur&apos;an</h1>
      <p className="text-neutral-500 mb-8">
        Select a surah to read its verses in Arabic with Indonesian translation.
      </p>

      {isLoading && <p className="text-neutral-400">Loading surahs...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {surahs?.map((surah) => (
          <Link
            key={surah.id}
            to="/quran/$surahId"
            params={{ surahId: String(surah.id) }}
            className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg hover:border-emerald-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">
                {surah.id}
              </span>
              <div>
                <p className="font-medium text-neutral-900">{surah.name_english}</p>
                <p className="text-xs text-neutral-400">{surah.name_arabic}</p>
              </div>
            </div>
            <span className="text-xs text-neutral-400">{surah.verses_count} verses</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export const quranRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/quran",
  component: QuranPage,
});