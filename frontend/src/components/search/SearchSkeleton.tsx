import { Skeleton } from "@/components/ui";

export function SearchSkeleton() {
  return (
    <div className="space-y-4 mt-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={`skel-${i}`}
          className="border border-[var(--border)] rounded-card p-5 bg-[var(--surface)]"
        >
          <Skeleton className="h-4 w-1/3 mb-4" />
          <Skeleton className="h-16 w-full mb-3" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}
