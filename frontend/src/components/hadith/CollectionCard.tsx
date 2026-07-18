import { Skeleton } from "@/components/ui";
import type { HadithCollectionInfo } from "@/lib/api";
import { Link } from "@tanstack/react-router";

export function CollectionCard({ collection }: { collection: HadithCollectionInfo }) {
  return (
    <Link
      to="/hadith/$slug"
      params={{ slug: collection.slug }}
      search={{ page: 1 }}
      className="flex items-center gap-3 p-4 border border-[var(--border)] rounded-card hover:border-[var(--accent-soft)] hover:shadow-sm transition-all bg-[var(--surface)]"
    >
      <span className="w-9 h-9 flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)] rounded-full text-xs font-medium">
        {collection.id}
      </span>
      <div>
        <p className="font-medium text-[var(--text)]">{collection.name_eng}</p>
        <p className="text-xs text-[var(--text-3)]">{collection.name_ar}</p>
      </div>
    </Link>
  );
}

export function CollectionListSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders don't reorder
        <Skeleton key={`collection-skel-${i}`} className="h-16 w-full rounded-card" />
      ))}
    </div>
  );
}
