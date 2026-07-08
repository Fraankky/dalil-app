import { Pagination } from "@/components/Pagination";
import { fetchCollectionHadith } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Link, createRoute, useParams } from "@tanstack/react-router";
import { rootRoute } from "./__root";

function getPageParam(): number {
  const params = new URLSearchParams(window.location.search);
  return Math.max(1, Number(params.get("page")) || 1);
}

function HadithCollectionPage() {
  const { slug } = useParams({ from: "/hadith/$slug" });
  const page = getPageParam();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["hadith", slug, page],
    queryFn: () => fetchCollectionHadith(slug, page, 20),
  });

  if (isLoading) {
    return <div className="max-w-4xl mx-auto px-4 py-8 text-neutral-400">Memuat hadis...</div>;
  }

  if (isError) {
    return <p className="max-w-4xl mx-auto px-4 py-8 text-red-500">Gagal memuat hadis.</p>;
  }

  if (!data) return null;

  if (data.hadiths.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <a
          href="/hadith"
          className="text-sm text-emerald-600 hover:text-emerald-700 mb-4 inline-block"
        >
          &larr; Kembali ke daftar kitab
        </a>
        <p className="text-neutral-400">Belum ada hadis pada halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <a
          href="/hadith"
          className="text-sm text-emerald-600 hover:text-emerald-700 mb-4 inline-block"
        >
          &larr; Kembali ke daftar kitab
        </a>
        <h1 className="text-2xl font-bold text-neutral-900">{data.collection.name_eng}</h1>
        <p className="text-lg text-neutral-500 mt-1">{data.collection.name_ar}</p>
        <p className="text-sm text-neutral-400 mt-1">{data.total} hadis</p>
      </div>

      <div className="space-y-4">
        {data.hadiths.map((h) => (
          <a
            key={h.id}
            href={`/hadith/${slug}/${h.id}`}
            className="block p-4 border border-neutral-200 rounded-lg hover:border-emerald-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                #{h.hadith_number}
              </span>
              {h.grade && <span className="text-xs text-neutral-400">{h.grade}</span>}
              {h.book_name && <span className="text-xs text-neutral-400">{h.book_name}</span>}
            </div>
            <p
              className="arabic-text text-lg leading-relaxed text-neutral-900 mb-3 text-right"
              dir="rtl"
            >
              {h.text_arabic}
            </p>
            {h.text_translation && (
              <p className="text-sm text-neutral-600 leading-relaxed border-l-2 border-emerald-200 pl-3">
                {h.text_translation}
              </p>
            )}
          </a>
        ))}
      </div>

      {data.total_pages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={data.total_pages}
          to="/hadith/$slug"
          params={{ slug }}
          search={(p) => ({ page: p })}
        />
      )}
    </div>
  );
}

export const hadithCollectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/hadith/$slug",
  component: HadithCollectionPage,
});
