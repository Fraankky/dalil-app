import { useQuery } from "@tanstack/react-query";
import { createRoute, Link } from "@tanstack/react-router";
import { fetchCollections } from "@/lib/api";
import { rootRoute } from "./__root";

function HadithPage() {
  const { data: collections, isLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: fetchCollections,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Browse Hadith Collections</h1>
      <p className="text-neutral-500 mb-8">
        Select a collection to browse its hadith in Arabic with Indonesian translation.
      </p>

      {isLoading && <p className="text-neutral-400">Loading collections...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {collections?.map((c) => (
          <Link
            key={c.id}
            to="/hadith/$slug"
            params={{ slug: c.slug }}
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
    </div>
  );
}

export const hadithRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/hadith",
  component: HadithPage,
});