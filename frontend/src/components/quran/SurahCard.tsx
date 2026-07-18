import { Skeleton } from "@/components/ui";
import type { SurahInfo } from "@/lib/api";
import { Link } from "@tanstack/react-router";

export function SurahCard({ surah }: { surah: SurahInfo }) {
  return (
    <Link
      to="/quran/$surahId"
      search={{ page: 1 }}
      params={{ surahId: String(surah.id) }}
      className="flex items-center justify-between p-4 border border-[var(--border)] rounded-card hover:border-[var(--accent-soft)] hover:shadow-sm transition-all bg-[var(--surface)]"
    >
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)] rounded-full text-xs font-medium">
          {surah.id}
        </span>
        <div>
          <p className="font-medium text-[var(--text)]">{surah.name_english}</p>
          <p className="text-xs text-[var(--text-3)]">{surah.name_arabic}</p>
        </div>
      </div>
      <span className="text-xs text-[var(--text-3)]">{surah.verses_count} ayat</span>
    </Link>
  );
}

export function SurahListSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders don't reorder
        <Skeleton key={`surah-skel-${i}`} className="h-16 w-full rounded-card" />
      ))}
    </div>
  );
}
