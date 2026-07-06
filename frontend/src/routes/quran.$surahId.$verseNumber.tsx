import { fetchSurahs, fetchVerseDetail } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Link, createRoute, useParams } from "@tanstack/react-router";
import { rootRoute } from "./__root";

function VerseDetailPage() {
  const { surahId, verseNumber } = useParams({ from: "/quran/$surahId/$verseNumber" });
  const numSurah = Number(surahId);
  const numVerse = Number(verseNumber);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["verse", surahId, verseNumber],
    queryFn: () => fetchVerseDetail(numSurah, numVerse),
  });

  const { data: surahs } = useQuery({
    queryKey: ["surahs"],
    queryFn: fetchSurahs,
    staleTime: 5 * 60 * 1000,
  });

  const surahMeta = surahs?.find((s) => s.id === numSurah);
  const totalVerses = surahMeta?.verses_count ?? 0;
  const hasPrev = numVerse > 1;
  const hasNext = numVerse < totalVerses;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-neutral-400">Memuat detail ayat...</div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <a
          href={`/quran/${surahId}`}
          className="text-sm text-emerald-600 hover:text-emerald-700 mb-4 inline-block"
        >
          &larr; Kembali ke surat
        </a>
        <p className="text-neutral-500">Gagal memuat detail ayat.</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <a
          href={`/quran/${surahId}`}
          className="text-sm text-emerald-600 hover:text-emerald-700 inline-block"
        >
          &larr; Kembali ke surat
        </a>
        <div className="flex items-center gap-2">
          <a
            href={`/quran/${surahId}/${numVerse - 1}`}
            className={`px-3 py-1 text-sm border border-neutral-200 rounded-lg hover:border-emerald-300 transition-all ${!hasPrev ? "pointer-events-none opacity-30" : ""}`}
          >
            &larr; Sebelumnya
          </a>
          <a
            href={`/quran/${surahId}/${numVerse + 1}`}
            className={`px-3 py-1 text-sm border border-neutral-200 rounded-lg hover:border-emerald-300 transition-all ${!hasNext ? "pointer-events-none opacity-30" : ""}`}
          >
            Berikutnya &rarr;
          </a>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-900">
          {data.surah_name_english} &mdash; Ayat {data.verse_number}
        </h1>
        <p className="text-base text-neutral-500 mt-1">
          {data.surah_name_arabic} ({data.surah_number}:{data.verse_number})
        </p>
        {data.juz && <p className="text-sm text-neutral-400 mt-1">Juz {data.juz}</p>}
      </div>

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
        <h2 className="font-semibold text-neutral-800 mb-2">Tafsir dan Penjelasan</h2>
        <p className="text-sm text-neutral-400">
          Tafsir untuk ayat ini akan ditambahkan pada fase berikutnya.
        </p>
      </div>
    </div>
  );
}

export const verseDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/quran/$surahId/$verseNumber",
  component: VerseDetailPage,
});
