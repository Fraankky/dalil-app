import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { TafsirTabs } from "@/components/quran/TafsirTabs";
import { Skeleton } from "@/components/ui";
import { fetchSurahs, fetchVerseDetail } from "@/lib/api";
import { useDocumentTitle } from "@/lib/hooks";
import { useQuery } from "@tanstack/react-query";
import { Link, createRoute, useParams, useSearch } from "@tanstack/react-router";
import { rootRoute } from "./__root";

function VerseDetailPage() {
  const { surahId, verseNumber } = useParams({ from: "/quran/$surahId/$verseNumber" });
  const { tafsirTab, kemenagLong } = useSearch({ from: "/quran/$surahId/$verseNumber" });
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

  useDocumentTitle(
    data
      ? `${data.surah_name_english} Ayat ${data.verse_number} — Al-Qur'an — Dalil`
      : "Al-Qur'an — Dalil",
  );

  const surahMeta = surahs?.find((s) => s.id === numSurah);
  const totalVerses = surahMeta?.verses_count ?? 0;
  const hasPrev = numVerse > 1;
  const hasNext = numVerse < totalVerses;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-5 py-10">
        <Skeleton className="h-5 w-40 mb-4" />
        <Skeleton className="h-8 w-64 mb-8" />
        <Skeleton className="h-48 w-full rounded-card mb-8" />
        <Skeleton className="h-32 w-full rounded-card" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto px-5 py-10">
        <BackLink to="/quran/$surahId" params={{ surahId }} search={{ page: 1 }}>
          &larr; Kembali ke surat
        </BackLink>
        <p className="text-[var(--text-3)] mt-4">Gagal memuat detail ayat.</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <div className="flex items-center justify-between mb-6">
        <BackLink to="/quran/$surahId" params={{ surahId }} search={{ page: 1 }}>
          &larr; Kembali ke surat
        </BackLink>
        <nav className="flex items-center gap-2" aria-label="Navigasi ayat">
          {hasPrev ? (
            <Link
              to="/quran/$surahId/$verseNumber"
              params={{ surahId: String(numSurah), verseNumber: String(numVerse - 1) }}
              search={{ tafsirTab, kemenagLong }}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-btn text-[var(--text-2)] hover:border-[var(--accent)] transition-all"
            >
              &larr; Sebelumnya
            </Link>
          ) : (
            <span
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-btn opacity-30"
              aria-disabled="true"
            >
              &larr; Sebelumnya
            </span>
          )}
          {hasNext ? (
            <Link
              to="/quran/$surahId/$verseNumber"
              params={{ surahId: String(numSurah), verseNumber: String(numVerse + 1) }}
              search={{ tafsirTab, kemenagLong }}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-btn text-[var(--text-2)] hover:border-[var(--accent)] transition-all"
            >
              Berikutnya &rarr;
            </Link>
          ) : (
            <span
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-btn opacity-30"
              aria-disabled="true"
            >
              Berikutnya &rarr;
            </span>
          )}
        </nav>
      </div>

      <PageHeader
        title={`${data.surah_name_english} — Ayat ${data.verse_number}`}
        subtitle={`${data.surah_name_arabic} (${data.surah_number}:${data.verse_number})`}
        meta={data.juz ? `Juz ${data.juz}` : undefined}
      />

      <div className="p-6 border border-[var(--border)] rounded-card bg-[var(--surface)]">
        <p
          className="arabic-text text-2xl leading-loose text-[var(--text)] mb-4 text-right"
          dir="rtl"
        >
          {data.text_arabic}
        </p>
        {data.text_translation && (
          <p className="text-base text-[var(--text-2)] leading-relaxed border-t border-[var(--border)] pt-4">
            {data.text_translation}
          </p>
        )}
      </div>

      {data.tafsir ? (
        <TafsirTabs
          tafsir={data.tafsir}
          surahId={numSurah}
          verseNumber={numVerse}
          tab={tafsirTab}
          kemenagLong={kemenagLong}
        />
      ) : (
        <div className="mt-8 p-6 border border-[var(--border)] rounded-card bg-[var(--surface-2)]">
          <h2 className="font-serif text-lg font-medium text-[var(--text)] mb-2">
            Tafsir dan Penjelasan
          </h2>
          <p className="text-sm text-[var(--text-3)]">Tafsir belum tersedia untuk ayat ini.</p>
        </div>
      )}
    </div>
  );
}

export const verseDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/quran/$surahId/$verseNumber",
  component: VerseDetailPage,
  validateSearch: (params: Record<string, unknown>) => ({
    tafsirTab: ["kemenag", "quraish", "jalalayn"].includes(params.tafsirTab as string)
      ? (params.tafsirTab as "kemenag" | "quraish" | "jalalayn")
      : ("kemenag" as const),
    kemenagLong: params.kemenagLong === "true" || params.kemenagLong === true || false,
  }),
});
