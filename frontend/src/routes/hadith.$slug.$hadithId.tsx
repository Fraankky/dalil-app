import { fetchHadithDetail } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Link, createRoute, useParams } from "@tanstack/react-router";
import { hadithCollectionRoute } from "./hadith.$slug";

function HadithDetailPage() {
  const { slug, hadithId } = useParams({ from: "/hadith/$slug/$hadithId" });
  const { data, isLoading, isError } = useQuery({
    queryKey: ["hadith-detail", slug, hadithId],
    queryFn: () => fetchHadithDetail(slug, Number(hadithId)),
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-neutral-400">Memuat detail hadis...</div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          to="/hadith/$slug"
          params={{ slug }}
          search={{ page: 1 }}
          className="text-sm text-emerald-600 hover:text-emerald-700 mb-4 inline-block"
        >
          &larr; Kembali ke kitab
        </Link>
        <p className="text-neutral-500">Gagal memuat detail hadis.</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        to="/hadith/$slug"
        params={{ slug }}
        search={{ page: 1 }}
        className="text-sm text-emerald-600 hover:text-emerald-700 mb-4 inline-block"
      >
        &larr; Kembali ke kitab
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-900">{data.collection_name}</h1>
        <p className="text-sm text-neutral-500 mt-1">Hadis #{data.hadith_number}</p>
        {data.book_name && <p className="text-sm text-neutral-400 mt-1">{data.book_name}</p>}
        {data.chapter_name_eng && (
          <p className="text-sm text-neutral-400 mt-1">Bab: {data.chapter_name_eng}</p>
        )}
      </div>

      {data.grade && (
        <div className="mb-4">
          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">
            {data.grade}
          </span>
        </div>
      )}

      <div className="p-6 border border-neutral-200 rounded-xl">
        <p
          className="arabic-text text-2xl leading-loose text-neutral-900 mb-4 text-right"
          dir="rtl"
        >
          {data.text_arabic}
        </p>
        {data.text_translation && (
          <p className="text-base text-neutral-600 leading-relaxed border-t border-neutral-200 pt-4">
            {data.text_translation}
          </p>
        )}
      </div>

      <div className="mt-8 p-6 border border-neutral-100 rounded-xl bg-neutral-50">
        <h2 className="font-semibold text-neutral-800 mb-2">Syarah dan Penjelasan</h2>
        <p className="text-sm text-neutral-400">
          Syarah untuk hadis ini akan ditambahkan pada fase berikutnya.
        </p>
      </div>
    </div>
  );
}

export const hadithDetailRoute = createRoute({
  getParentRoute: () => hadithCollectionRoute,
  path: "/$hadithId",
  validateSearch: (params: Record<string, unknown>) => ({
    page: params.page ? Number(params.page) : 1,
  }),
  component: HadithDetailPage,
});
