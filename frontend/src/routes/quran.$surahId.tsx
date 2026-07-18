import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { VerseCard } from "@/components/quran/VerseCard";
import { Skeleton } from "@/components/ui";
import { fetchSurahDetail } from "@/lib/api";
import { useDocumentTitle } from "@/lib/hooks";
import { useQuery } from "@tanstack/react-query";
import { createRoute, useParams, useSearch } from "@tanstack/react-router";
import { rootRoute } from "./__root";

const PER_PAGE = 10;

function SurahDetailPage() {
  const { surahId } = useParams({ from: "/quran/$surahId" });
  const { page } = useSearch({ from: "/quran/$surahId" });
  const { data, isLoading, isError } = useQuery({
    queryKey: ["surah", surahId, page],
    queryFn: () => fetchSurahDetail(Number(surahId), page, PER_PAGE),
  });
  useDocumentTitle(data ? `${data.surah.name_english} — Al-Qur'an — Dalil` : "Al-Qur'an — Dalil");

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-5 py-10">
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-48 mb-8" />
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders don't reorder
            <Skeleton key={`s-${i}`} className="h-32 w-full rounded-card" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto px-5 py-10">
        <BackLink to="/quran">&larr; Kembali ke daftar surat</BackLink>
        <p className="text-[var(--text-3)] mt-4">
          Gagal memuat surat. Coba kembali ke daftar surat.
        </p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <BackLink to="/quran">&larr; Kembali ke daftar surat</BackLink>
      <PageHeader
        title={data.surah.name_english}
        subtitle={data.surah.name_arabic}
        meta={`${data.surah.verses_count} ayat &middot; Halaman ${data.page} dari ${data.total_pages}`}
        className="mt-4"
      />

      <div className="space-y-5">
        {data.verses.map((verse) => (
          <VerseCard key={verse.id} verse={verse} surahId={data.surah.id} />
        ))}
      </div>

      {data.total_pages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={data.total_pages}
          to="/quran/$surahId"
          params={{ surahId }}
          search={(p) => ({ page: p })}
        />
      )}
    </div>
  );
}

export const surahDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/quran/$surahId",
  component: SurahDetailPage,
  validateSearch: (search: Record<string, string>) => ({
    page: Number(search.page) || 1,
  }),
});
