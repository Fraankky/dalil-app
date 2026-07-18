import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { HadithCard } from "@/components/hadith/HadithCard";
import { Skeleton } from "@/components/ui";
import { fetchCollectionHadith } from "@/lib/api";
import { useDocumentTitle } from "@/lib/hooks";
import { useQuery } from "@tanstack/react-query";
import { createRoute, useParams, useSearch } from "@tanstack/react-router";
import { rootRoute } from "./__root";

function HadithCollectionPage() {
  const { slug } = useParams({ from: "/hadith/$slug" });
  const { page } = useSearch({ from: "/hadith/$slug" });
  const { data, isLoading, isError } = useQuery({
    queryKey: ["hadith", slug, page],
    queryFn: () => fetchCollectionHadith(slug, page, 20),
  });
  useDocumentTitle(data ? `${data.collection.name_eng} — Hadis — Dalil` : "Hadis — Dalil");

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-5 py-10">
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-40 mb-8" />
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
    return <p className="max-w-4xl mx-auto px-5 py-10 text-red-500">Gagal memuat hadis.</p>;
  }

  if (!data) return null;

  if (data.hadiths.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-5 py-10">
        <BackLink to="/hadith">&larr; Kembali ke daftar kitab</BackLink>
        <p className="text-[var(--text-3)] mt-4">Belum ada hadis pada halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <BackLink to="/hadith">&larr; Kembali ke daftar kitab</BackLink>
      <PageHeader
        title={data.collection.name_eng}
        subtitle={data.collection.name_ar}
        meta={`${data.total} hadis`}
        className="mt-4"
      />

      <div className="space-y-4">
        {data.hadiths.map((h) => (
          <HadithCard key={h.id} hadith={h} slug={slug} />
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
  validateSearch: (search: Record<string, string>) => ({
    page: Number(search.page) || 1,
  }),
});
