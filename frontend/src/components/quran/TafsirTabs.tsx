import type { VerseDetailResponse } from "@/lib/api";
import { useNavigate } from "@tanstack/react-router";

type TafsirTabValue = "kemenag" | "quraish" | "jalalayn";

const TABS: { id: TafsirTabValue; label: string }[] = [
  { id: "kemenag", label: "Kemenag" },
  { id: "quraish", label: "Quraish Shihab" },
  { id: "jalalayn", label: "Al-Jalalayn" },
];

export function TafsirTabs({
  tafsir,
  surahId,
  verseNumber,
  tab,
  kemenagLong,
}: {
  tafsir: NonNullable<VerseDetailResponse["tafsir"]>;
  surahId: number;
  verseNumber: number;
  tab: TafsirTabValue;
  kemenagLong: boolean;
}) {
  const navigate = useNavigate();
  const go = (nextTab: TafsirTabValue, nextLong?: boolean) =>
    navigate({
      to: "/quran/$surahId/$verseNumber",
      params: { surahId: String(surahId), verseNumber: String(verseNumber) },
      search: {
        tafsirTab: nextTab,
        kemenagLong: nextLong ?? (nextTab === "kemenag" ? kemenagLong : false),
      },
    });

  const content =
    tab === "kemenag"
      ? kemenagLong
        ? tafsir.kemenag_long || tafsir.kemenag_short
        : tafsir.kemenag_short || tafsir.kemenag_long
      : tab === "quraish"
        ? tafsir.quraish
        : tafsir.jalalayn;

  return (
    <div className="mt-8 p-6 border border-[var(--border)] rounded-card bg-[var(--surface-2)]">
      <h2 className="font-serif text-lg font-medium text-[var(--text)] mb-4">
        Tafsir dan Penjelasan
      </h2>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => go(t.id)}
            className={`px-3 py-1 text-sm rounded-btn transition-all ${
              tab === t.id
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--border)] text-[var(--text-2)] hover:border-[var(--accent)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "kemenag" && (
        <button
          type="button"
          onClick={() => go("kemenag", !kemenagLong)}
          className="px-2 py-0.5 text-xs border border-[var(--border)] rounded text-[var(--text-2)] hover:border-[var(--accent)] mb-3"
        >
          {kemenagLong ? "Ringkas" : "Panjang"}
        </button>
      )}

      <p className="text-sm text-[var(--text-2)] leading-relaxed whitespace-pre-line">{content}</p>
    </div>
  );
}
