import { type ClassValue, clsx } from "clsx";
import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function highlightMatch(text: string | null, query: string): ReactNode {
  if (!text || !query) return text ?? null;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  if (parts.length <= 1) return text;
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: index is the natural key for split-string parts
      <mark key={i} className="bg-[var(--mark)] rounded-sm">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}
