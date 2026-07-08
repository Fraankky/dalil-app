interface PaginationProps {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
}

function buildPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [];

  pages.push(1, 2, 3);

  if (current > 5) pages.push("...");

  const start = Math.max(4, current - 1);
  const end = Math.min(total - 3, current + 1);
  if (start <= end) {
    for (let i = start; i <= end; i++) pages.push(i);
  }

  if (current < total - 4) pages.push("...");

  pages.push(total - 2, total - 1, total);

  const set = new Set(pages);
  const deduped: (number | "...")[] = [];
  let lastWasEllipsis = false;
  for (const p of set) {
    if (p === "...") {
      if (!lastWasEllipsis) deduped.push(p);
      lastWasEllipsis = true;
    } else {
      deduped.push(p);
      lastWasEllipsis = false;
    }
  }
  return deduped;
}

const baseBtn =
  "px-3 py-1.5 text-sm border border-neutral-200 rounded-lg hover:border-emerald-300 hover:text-emerald-700 transition-all";
const activeBtn =
  "px-3 py-1.5 text-sm border border-emerald-500 bg-emerald-50 text-emerald-700 rounded-lg font-medium";
const disabledBtn = "px-3 py-1.5 text-sm border border-neutral-200 rounded-lg opacity-30";

export function Pagination({ currentPage, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = buildPageNumbers(currentPage, totalPages);

  return (
    <div className="flex items-center justify-center gap-1.5 mt-8 flex-wrap">
      <a
        href={buildHref(currentPage - 1)}
        className={`${baseBtn} ${currentPage <= 1 ? disabledBtn : ""}`}
        aria-disabled={currentPage <= 1}
        onClick={(e) => currentPage <= 1 && e.preventDefault()}
      >
        &larr; Sebelumnya
      </a>

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="px-2 text-neutral-400 select-none">
            &hellip;
          </span>
        ) : (
          <a key={p} href={buildHref(p)} className={p === currentPage ? activeBtn : baseBtn}>
            {p}
          </a>
        ),
      )}

      <a
        href={buildHref(currentPage + 1)}
        className={`${baseBtn} ${currentPage >= totalPages ? disabledBtn : ""}`}
        aria-disabled={currentPage >= totalPages}
        onClick={(e) => currentPage >= totalPages && e.preventDefault()}
      >
        Berikutnya &rarr;
      </a>
    </div>
  );
}
