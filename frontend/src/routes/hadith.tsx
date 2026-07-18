import { PageHeader } from "@/components/PageHeader";
import { CollectionCard, CollectionListSkeleton } from "@/components/hadith/CollectionCard";
import { fetchCollections } from "@/lib/api";
import { useDocumentTitle } from "@/lib/hooks";
import { useQuery } from "@tanstack/react-query";
import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";

function HadithPage() {
  useDocumentTitle("Hadis — Dalil");
  const {
    data: collections,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["collections"],
    queryFn: fetchCollections,
  });

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <PageHeader
        title="Jelajahi Kitab Hadis"
        subtitle="Pilih kitab untuk membaca hadis Arab dan terjemahannya."
      />

      {isLoading && <CollectionListSkeleton />}
      {isError && <p className="text-red-500">Gagal memuat daftar kitab. Coba muat ulang.</p>}
      {!isError && collections && collections.length === 0 && (
        <p className="text-[var(--text-3)]">Belum ada data kitab hadis.</p>
      )}

      {collections && collections.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {collections.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </div>
      )}
    </div>
  );
}

export const hadithRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/hadith",
  component: HadithPage,
});
