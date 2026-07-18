import { Link } from "@tanstack/react-router";

export function BackLink(props: {
  to: string;
  params?: Record<string, unknown>;
  search?: Record<string, unknown>;
  className?: string;
  children?: React.ReactNode;
}) {
  const { className, children, ...rest } = props;
  const base = "text-sm text-[var(--accent)] hover:text-[var(--accent-strong)] inline-block";
  return (
    <Link
      // biome-ignore lint/suspicious/noExplicitAny: Link's generic typing doesn't survive a wrapper; runtime types come from `to`/`params`/`search`.
      {...(rest as any)}
      className={className ? `${base} ${className}` : base}
    >
      {children ?? "\u2190 Kembali"}
    </Link>
  );
}
