import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Skeleton } from "@/components/ui";
import { fetchHadithDetail } from "@/lib/api";
import { useDocumentTitle } from "@/lib/hooks";
import { useQuery } from "@tanstack/react-query";
import { createRoute, useParams } from "@tanstack/react-router";
import { rootRoute } from "./__root";

function HadithDetailPage() {
  const { slug, hadithId } = useParams({ from: "/hadith/$slug/$hadithId" });
  const { data, isLoading, isError } = useQuery({
    queryKey: ["hadith-detail", slug, hadithId],
    queryFn: () => fetchHadithDetail(slug, Number(hadithId)),
  });
  useDocumentTitle(
    data ? `Hadis #${data.hadith_number} — ${data.collection_name} — Dalil` : "Hadis — Dalil",
  );

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-5 py-10">
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-48 mb-8" />
        <Skeleton className="h-48 w-full rounded-card mb-8" />
        <Skeleton className="h-32 w-full rounded-card" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto px-5 py-10">
        <BackLink to="/hadith/$slug" params={{ slug }} search={{ page: 1 }}>
          &larr; Kembali ke kitab
        </BackLink>
        <p className="text-[var(--text-3)] mt-4">Gagal memuat detail hadis.</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <BackLink to="/hadith/$slug" params={{ slug }} search={{ page: 1 }}>
        &larr; Kembali ke kitab
      </BackLink>
      <PageHeader title={data.collection_name} subtitle={`Hadis #${data.hadith_number}`} />

      {data.book_name && <p className="text-xs text-[var(--text-3)] mb-2">{data.book_name}</p>}
      {data.chapter_name_eng && (
        <p className="text-xs text-[var(--text-3)] mb-4">Bab: {data.chapter_name_eng}</p>
      )}
      {data.grade && (
        <div className="mb-4">
          <Badge variant="grade">{data.grade}</Badge>
        </div>
      )}

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

      <div className="mt-8 p-6 border border-[var(--border)] rounded-card bg-[var(--surface-2)]">
        <h2 className="font-serif text-lg font-medium text-[var(--text)] mb-2">
          Syarah dan Penjelasan
        </h2>
        {data.text_syarah ? (
          <p className="text-sm text-[var(--text-2)] leading-relaxed whitespace-pre-line">
            {data.text_syarah}
          </p>
        ) : (
          <p className="text-sm text-[var(--text-3)]">Syarah belum tersedia untuk hadis ini.</p>
        )}
      </div>
    </div>
  );
}

export const hadithDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/hadith/$slug/$hadithId",
  component: HadithDetailPage,
});
