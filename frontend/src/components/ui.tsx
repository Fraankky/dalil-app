import type { ReactNode } from "react";

export function Badge({
  children,
  variant = "quran",
}: { children: ReactNode; variant?: "quran" | "hadith" | "grade" | "source" }) {
  const base = "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full";
  const colors = {
    quran: "text-[var(--accent)] bg-[var(--accent-soft)]",
    hadith: "text-amber-700 bg-amber-50",
    grade: "text-emerald-600 bg-emerald-50",
    source: "text-sky-700 bg-sky-50",
  };
  return <span className={`${base} ${colors[variant]}`}>{children}</span>;
}

export function Chip({
  children,
  active = false,
  onClick,
}: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 text-xs leading-relaxed font-medium rounded-full transition-colors ${
        active
          ? "text-white bg-[var(--accent)]"
          : "text-[var(--text-2)] bg-[var(--surface-2)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
      }`}
    >
      {children}
    </button>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-[var(--surface-2)] rounded-md ${className}`} />;
}

export function PageContainer({
  children,
  className = "",
}: { children: ReactNode; className?: string }) {
  return <div className={`max-w-5xl mx-auto px-5 py-10 ${className}`}>{children}</div>;
}
