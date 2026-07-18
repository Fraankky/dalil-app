import type { VerseInfo } from "@/lib/api";
import { Link } from "@tanstack/react-router";

export function VerseCard({
  verse,
  surahId,
}: {
  verse: VerseInfo;
  surahId: number | string;
}) {
  return (
    <Link
      to="/quran/$surahId/$verseNumber"
      params={{ surahId: String(surahId), verseNumber: String(verse.verse_number) }}
      search={{ tafsirTab: "kemenag" as const, kemenagLong: false }}
      className="block p-5 border border-[var(--border)] rounded-card hover:border-[var(--accent-soft)] hover:shadow-sm transition-all bg-[var(--surface)]"
    >
      <span className="inline-flex items-center justify-center w-7 h-7 text-xs font-medium text-[var(--accent)] bg-[var(--accent-soft)] rounded-full mb-3">
        {verse.verse_number}
      </span>
      <p
        className="arabic-text text-xl leading-relaxed text-[var(--text)] mb-3 text-right"
        dir="rtl"
      >
        {verse.text_arabic}
      </p>
      {verse.text_translation && (
        <p className="text-sm text-[var(--text-2)] leading-relaxed border-l-2 border-[var(--accent-soft)] pl-3">
          {verse.text_translation}
        </p>
      )}
    </Link>
  );
}
