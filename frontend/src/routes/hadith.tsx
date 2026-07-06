import { fetchCollections } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Link, createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";

function HadithPage() {
  const {
    data: collections,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["collections"],
    queryFn: fetchCollections,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Jelajahi Kitab Hadis</h1>
      <p className="text-neutral-500 mb-8">
        Pilih kitab untuk membaca hadis Arab dan terjemahannya.
      </p>

      {isLoading && <p className="text-neutral-400">Memuat daftar kitab...</p>}

      {isError && (
        <p className="text-red-500">Gagal memuat daftar kitab. Coba muat ulang halaman.</p>
      )}

      {!isError && collections && collections.length === 0 && (
        <p className="text-neutral-400">Belum ada data kitab hadis.</p>
      )}

      {collections && collections.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {collections?.map((c) => (
            <Link
              key={c.id}
              to="/hadith/$slug"
              params={{ slug: c.slug }}
              search={{ page: 1 }}
              className="flex items-center gap-3 p-4 border border-neutral-200 rounded-lg hover:border-emerald-300 hover:shadow-sm transition-all"
            >
              <span className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">
                {c.id}
              </span>
              <div>
                <p className="font-medium text-neutral-900">{c.name_eng}</p>
                <p className="text-xs text-neutral-400">{c.name_ar}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export const hadithRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/hadith",
  component: HadithPage,
});
