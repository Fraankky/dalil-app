import { fetchSurahDetail } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Link, createRoute, useParams } from "@tanstack/react-router";
import { rootRoute } from "./__root";

const PER_PAGE = 10;

function getPageParam(): number {
  const params = new URLSearchParams(window.location.search);
  return Math.max(1, Number(params.get("page")) || 1);
}

function SurahDetailPage() {
  const { surahId } = useParams({ from: "/quran/$surahId" });
  const page = getPageParam();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["surah", surahId, page],
    queryFn: () => fetchSurahDetail(Number(surahId), page, PER_PAGE),
  });

  if (isLoading) {
    return <div className="max-w-4xl mx-auto px-4 py-8 text-neutral-400">Memuat surat...</div>;
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          to="/quran"
          className="text-sm text-emerald-600 hover:text-emerald-700 mb-4 inline-block"
        >
          &larr; Kembali ke daftar surat
        </Link>
        <p className="text-neutral-500">Gagal memuat surat. Coba kembali ke daftar surat.</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          to="/quran"
          className="text-sm text-emerald-600 hover:text-emerald-700 mb-4 inline-block"
        >
          &larr; Kembali ke daftar surat
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">{data.surah.name_english}</h1>
        <p className="text-lg text-neutral-500 mt-1">{data.surah.name_arabic}</p>
        <p className="text-sm text-neutral-400 mt-1">
          {data.surah.verses_count} ayat &middot; Halaman {data.page} dari {data.total_pages}
        </p>
      </div>

      <div className="space-y-6">
        {data.verses.map((verse) => (
          <Link
            key={verse.id}
            to="/quran/$surahId/$verseNumber"
            params={{ surahId: String(data.surah.id), verseNumber: String(verse.verse_number) }}
            className="block p-4 border border-neutral-200 rounded-lg hover:border-emerald-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 flex items-center justify-center bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                {verse.verse_number}
              </span>
            </div>
            <p
              className="arabic-text text-xl leading-relaxed text-neutral-900 mb-3 text-right"
              dir="rtl"
            >
              {verse.text_arabic}
            </p>
            {verse.text_translation && (
              <p className="text-sm text-neutral-600 leading-relaxed border-l-2 border-emerald-200 pl-3">
                {verse.text_translation}
              </p>
            )}
          </Link>
        ))}
      </div>

      {data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <a
            href={`/quran/${surahId}?page=${page - 1}`}
            className={`px-4 py-2 text-sm border border-neutral-200 rounded-lg hover:border-emerald-300 transition-all ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
          >
            Sebelumnya
          </a>
          <span className="text-sm text-neutral-500">
            {data.page} / {data.total_pages}
          </span>
          <a
            href={`/quran/${surahId}?page=${page + 1}`}
            className={`px-4 py-2 text-sm border border-neutral-200 rounded-lg hover:border-emerald-300 transition-all ${page >= data.total_pages ? "pointer-events-none opacity-40" : ""}`}
          >
            Berikutnya
          </a>
        </div>
      )}
    </div>
  );
}

export const surahDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/quran/$surahId",
  component: SurahDetailPage,
});
