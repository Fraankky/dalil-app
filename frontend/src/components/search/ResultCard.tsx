import { BookOpenIcon, StarIcon } from "@/components/icons";
import { Badge } from "@/components/ui";
import type { SearchResult } from "@/lib/api";
import { highlightMatch } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

type LinkProps =
  | { to: "/quran/$surahId/$verseNumber"; params: { surahId: string; verseNumber: string } }
  | { to: "/quran/$surahId"; params: { surahId: string } }
  | { to: "/hadith/$slug/$hadithId"; params: { slug: string; hadithId: string } }
  | { to: "/hadith/$slug"; params: { slug: string } };

function buildLink(result: SearchResult): LinkProps | null {
  if (result.type === "quran" && result.surah_number && result.verse_number) {
    return {
      to: "/quran/$surahId/$verseNumber",
      params: { surahId: String(result.surah_number), verseNumber: String(result.verse_number) },
    };
  }
  if (result.type === "quran" && result.surah_number) {
    return {
      to: "/quran/$surahId",
      params: { surahId: String(result.surah_number) },
    };
  }
  if (result.type === "hadith" && result.collection_slug && result.source_id) {
    return {
      to: "/hadith/$slug/$hadithId",
      params: { slug: result.collection_slug, hadithId: String(result.source_id) },
    };
  }
  if (result.type === "hadith" && result.collection_slug) {
    return {
      to: "/hadith/$slug",
      params: { slug: result.collection_slug },
    };
  }
  return null;
}

export function ResultCard({ result, query }: { result: SearchResult; query: string }) {
  const linkProps = buildLink(result);

  const card = (
    <div className="border border-[var(--border)] rounded-card p-5 hover:border-[var(--accent-soft)] hover:shadow-sm transition-all bg-[var(--surface)]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {result.type === "quran" && (
            <>
              <Badge variant="quran">
                <BookOpenIcon className="size-3" />
                QS {result.surah_number}:{result.verse_number}
              </Badge>
              {result.surah_name && (
                <span className="text-sm font-medium text-[var(--text-2)]">
                  {result.surah_name}
                </span>
              )}
            </>
          )}
          {result.type === "hadith" && result.hadith_number && (
            <>
              <Badge variant="hadith">
                <BookOpenIcon className="size-3" />
                No. {result.hadith_number}
              </Badge>
              <span className="text-sm font-medium text-[var(--text-2)]">
                {result.collection_name}
              </span>
              {result.grade && <Badge variant="grade">{result.grade}</Badge>}
            </>
          )}
          {result.type === "hadith" && !result.hadith_number && (
            <span className="text-sm font-medium text-[var(--text-2)]">
              {result.collection_name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs shrink-0 text-[var(--text-3)]">
          <StarIcon className="text-amber-400 size-3.5" />
          <span className="font-medium">{result.relevance}%</span>
        </div>
      </div>

      <p className="arabic-text mb-3 text-[var(--text)]" dir="rtl">
        {result.text_arabic}
      </p>

      {result.text_translation && (
        <p className="text-sm text-[var(--text-2)] border-t border-[var(--border)] pt-3 leading-relaxed">
          {highlightMatch(result.text_translation, query)}
        </p>
      )}

      {result.type === "hadith" && result.chapter_name && (
        <p className="text-xs text-[var(--text-3)] mt-2">Bab: {result.chapter_name}</p>
      )}
    </div>
  );

  if (linkProps) {
    return <Link {...linkProps}>{card}</Link>;
  }
  return card;
}
