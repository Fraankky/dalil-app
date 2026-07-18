import type { HadithInfo } from "@/lib/api";
import { Link } from "@tanstack/react-router";

export function HadithCard({ hadith, slug }: { hadith: HadithInfo; slug: string }) {
  return (
    <Link
      to="/hadith/$slug/$hadithId"
      params={{ slug, hadithId: String(hadith.id) }}
      className="block p-4 border border-[var(--border)] rounded-card hover:border-[var(--accent-soft)] hover:shadow-sm transition-all bg-[var(--surface)]"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 rounded-full">
          #{hadith.hadith_number}
        </span>
        {hadith.grade && <span className="text-xs text-[var(--text-3)]">{hadith.grade}</span>}
        {hadith.book_name && (
          <span className="text-xs text-[var(--text-3)]">{hadith.book_name}</span>
        )}
      </div>
      <p
        className="arabic-text text-lg leading-relaxed text-[var(--text)] mb-3 text-right"
        dir="rtl"
      >
        {hadith.text_arabic}
      </p>
      {hadith.text_translation && (
        <p className="text-sm text-[var(--text-2)] leading-relaxed border-l-2 border-[var(--accent-soft)] pl-3">
          {hadith.text_translation}
        </p>
      )}
    </Link>
  );
}
