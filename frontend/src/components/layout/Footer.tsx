import { BookOpenIcon } from "@/components/icons";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] py-8 mt-16">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-[var(--text-3)]">
            <BookOpenIcon className="size-4" />
            <span className="font-serif">Dalil</span>
            <span className="text-xs">
              &mdash; Ensiklopedia dalil Islam berbasis pencarian makna.
            </span>
          </div>
          <p className="text-xs text-[var(--text-3)]">
            <a
              href="/tentang"
              className="hover:text-[var(--text-2)] underline underline-offset-2 transition-colors mr-3"
            >
              Tentang &amp; Disclaimer
            </a>
            &copy; {new Date().getFullYear()} Dalil
          </p>
        </div>
      </div>
    </footer>
  );
}
