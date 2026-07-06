import { fetchCollectionHadith } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Link, createRoute, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { hadithRoute } from "./hadith";

function HadithCollectionPage() {
  const { slug } = useParams({ from: "/hadith/$slug" });
  const page = useSearch({ from: "/hadith/$slug" }).page;
  const navigate = useNavigate();
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
        <Link
          to="/hadith"
          className="text-sm text-emerald-600 hover:text-emerald-700 mb-4 inline-block"
        >
          &larr; Kembali ke daftar kitab
        </Link>
        <p className="text-neutral-400">Belum ada hadis pada halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          to="/hadith"
          className="text-sm text-emerald-600 hover:text-emerald-700 mb-4 inline-block"
        >
          &larr; Kembali ke daftar kitab
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">{data.collection.name_eng}</h1>
        <p className="text-lg text-neutral-500 mt-1">{data.collection.name_ar}</p>
        <p className="text-sm text-neutral-400 mt-1">{data.total} hadis</p>
      </div>

      <div className="space-y-4">
        {data.hadiths.map((h) => (
          <Link
            key={h.id}
            to="/hadith/$slug/$hadithId"
            params={{ slug, hadithId: String(h.id) }}
            search={{ page: 1 }}
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
          </Link>
        ))}
      </div>

      {data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() =>
              navigate({ to: "/hadith/$slug", params: { slug }, search: { page: page - 1 } })
            }
            className="px-4 py-2 text-sm border border-neutral-200 rounded-lg disabled:opacity-40 hover:border-emerald-300 transition-all"
          >
            Sebelumnya
          </button>
          <span className="text-sm text-neutral-500">
            Halaman {data.page} dari {data.total_pages}
          </span>
          <button
            type="button"
            disabled={page >= data.total_pages}
            onClick={() =>
              navigate({ to: "/hadith/$slug", params: { slug }, search: { page: page + 1 } })
            }
            className="px-4 py-2 text-sm border border-neutral-200 rounded-lg disabled:opacity-40 hover:border-emerald-300 transition-all"
          >
            Berikutnya
          </button>
        </div>
      )}
    </div>
  );
}

export const hadithCollectionRoute = createRoute({
  getParentRoute: () => hadithRoute,
  path: "/$slug",
  validateSearch: (params: Record<string, unknown>) => ({
    page: params.page ? Number(params.page) : 1,
  }),
  component: HadithCollectionPage,
});
