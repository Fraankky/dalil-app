import { fetchSurahDetail } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Link, createRoute, useParams } from "@tanstack/react-router";
import { quranRoute } from "./quran";

function SurahDetailPage() {
  const { surahId } = useParams({ from: "/quran/$surahId" });
  const { data, isLoading, isError } = useQuery({
    queryKey: ["surah", surahId],
    queryFn: () => fetchSurahDetail(Number(surahId), 1, 286),
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
        <p className="text-sm text-neutral-400 mt-1">{data.surah.verses_count} ayat</p>
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
    </div>
  );
}

export const surahDetailRoute = createRoute({
  getParentRoute: () => quranRoute,
  path: "/$surahId",
  component: SurahDetailPage,
});
