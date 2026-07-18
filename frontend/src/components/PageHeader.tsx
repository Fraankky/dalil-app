import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  meta,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-8 ${className}`}>
      <h1 className="font-serif text-2xl font-medium text-[var(--text)] mb-1">{title}</h1>
      {subtitle && <p className="text-sm text-[var(--text-3)] mb-1">{subtitle}</p>}
      {meta && <p className="text-xs text-[var(--text-3)] mt-1">{meta}</p>}
    </div>
  );
}
