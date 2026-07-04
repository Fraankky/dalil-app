import { useQuery } from "@tanstack/react-query";
import { createRoute, useParams } from "@tanstack/react-router";
import { fetchCollectionHadith } from "@/lib/api";
import { hadithRoute } from "./hadith";

function HadithCollectionPage() {
  const { slug } = useParams({ from: "/hadith/$slug" });
  const { data, isLoading } = useQuery({
    queryKey: ["hadith", slug],
    queryFn: () => fetchCollectionHadith(slug),
  });

  if (isLoading) {
    return <div className="max-w-4xl mx-auto px-4 py-8 text-neutral-400">Loading...</div>;
  }

  if (!data) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <a href="/hadith" className="text-sm text-emerald-600 hover:text-emerald-700 mb-4 inline-block">
          &larr; Back to collections
        </a>
        <h1 className="text-2xl font-bold text-neutral-900">{data.collection.name_eng}</h1>
        <p className="text-lg text-neutral-500 mt-1">{data.collection.name_ar}</p>
        <p className="text-sm text-neutral-400 mt-1">{data.total} hadith</p>
      </div>

      <div className="space-y-4">
        {data.hadiths.map((h) => (
          <div key={h.id} className="p-4 border border-neutral-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                #{h.hadith_number}
              </span>
              {h.grade && (
                <span className="text-xs text-neutral-400">{h.grade}</span>
              )}
              {h.book_name && (
                <span className="text-xs text-neutral-400">{h.book_name}</span>
              )}
            </div>
            <p className="arabic-text text-lg leading-relaxed text-neutral-900 mb-3 text-right" dir="rtl">
              {h.text_arabic}
            </p>
            {h.text_translation && (
              <p className="text-sm text-neutral-600 leading-relaxed border-l-2 border-emerald-200 pl-3">
                {h.text_translation}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export const hadithCollectionRoute = createRoute({
  getParentRoute: () => hadithRoute,
  path: "/$slug",
  component: HadithCollectionPage,
});
