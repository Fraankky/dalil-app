import { PageHeader } from "@/components/PageHeader";
import { SurahCard, SurahListSkeleton } from "@/components/quran/SurahCard";
import { fetchSurahs } from "@/lib/api";
import { useDocumentTitle } from "@/lib/hooks";
import { useQuery } from "@tanstack/react-query";
import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";

function QuranPage() {
  useDocumentTitle("Al-Qur'an — Dalil");
  const {
    data: surahs,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["surahs"],
    queryFn: fetchSurahs,
  });

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <PageHeader
        title="Jelajahi Al-Qur'an"
        subtitle="Pilih surat untuk membaca ayat Arab dan terjemahannya."
      />

      {isLoading && <SurahListSkeleton />}
      {isError && <p className="text-red-500">Gagal memuat daftar surat. Coba muat ulang.</p>}
      {surahs && surahs.length === 0 && (
        <p className="text-[var(--text-3)]">Belum ada data surat.</p>
      )}

      {surahs && surahs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {surahs.map((surah) => (
            <SurahCard key={surah.id} surah={surah} />
          ))}
        </div>
      )}
    </div>
  );
}

export const quranRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/quran",
  component: QuranPage,
});
