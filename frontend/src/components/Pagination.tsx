import { Link } from "@tanstack/react-router";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  to: string;
  search?: (page: number) => Record<string, unknown>;
  params?: Record<string, unknown>;
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

export function Pagination({ currentPage, totalPages, to, search, params }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = buildPageNumbers(currentPage, totalPages);

  return (
    <div className="flex items-center justify-center gap-1.5 mt-8 flex-wrap">
      {currentPage <= 1 ? (
        <span aria-disabled="true" className={`${baseBtn} ${disabledBtn}`}>
          &larr; Sebelumnya
        </span>
      ) : (
        <Link to={to} params={params} search={search?.(currentPage - 1) ?? {}} className={baseBtn}>
          &larr; Sebelumnya
        </Link>
      )}

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`gap-after-${pages[i - 1]}`} className="px-2 text-neutral-400 select-none">
            &hellip;
          </span>
        ) : p === currentPage ? (
          <span key={p} aria-current="page" className={activeBtn}>
            {p}
          </span>
        ) : (
          <Link key={p} to={to} params={params} search={search?.(p) ?? {}} className={baseBtn}>
            {p}
          </Link>
        ),
      )}

      {currentPage >= totalPages ? (
        <span aria-disabled="true" className={`${baseBtn} ${disabledBtn}`}>
          Berikutnya &rarr;
        </span>
      ) : (
        <Link to={to} params={params} search={search?.(currentPage + 1) ?? {}} className={baseBtn}>
          Berikutnya &rarr;
        </Link>
      )}
    </div>
  );
}
