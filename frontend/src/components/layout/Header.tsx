import { ThemeToggle } from "@/components/ThemeToggle";
import { BookOpenIcon, MenuIcon, XIcon } from "@/components/icons";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

const SEARCH_DEFAULTS = {
  q: "",
  page: 1,
  activeTab: "all" as const,
  sources: "",
  showFilters: false,
};

export function Header() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-[var(--text)] no-underline">
          <span className="font-serif text-xl font-semibold tracking-tight">Dalil Islam</span>
          <span className="hidden sm:inline text-xs text-[var(--text-3)] font-sans font-normal tracking-wider uppercase ml-1">
            دليل
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm text-[var(--text-2)]">
          <Link
            to="/search"
            search={SEARCH_DEFAULTS}
            className="hover:text-[var(--text)] transition-colors"
          >
            Cari
          </Link>
          <Link to="/quran" className="hover:text-[var(--text)] transition-colors">
            Al-Qur'an
          </Link>
          <Link to="/hadith" className="hover:text-[var(--text)] transition-colors">
            Hadis
          </Link>
          <Link to="/tentang" className="hover:text-[var(--text)] transition-colors">
            Tentang
          </Link>
          <ThemeToggle />
        </nav>

        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setNavOpen((v) => !v)}
            className="p-2 text-[var(--text-2)] hover:text-[var(--text)]"
            aria-label={navOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={navOpen}
          >
            {navOpen ? <XIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {navOpen && <MobileNav onClose={() => setNavOpen(false)} />}
    </header>
  );
}

function MobileNav({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div
        className="fixed inset-0 top-16 z-40 bg-black/20 md:hidden"
        onClick={onClose}
        onKeyDown={onClose}
        role="presentation"
      />
      <nav className="fixed top-16 right-0 z-50 w-56 h-[calc(100vh-4rem)] bg-[var(--bg)] border-l border-[var(--border)] p-6 flex flex-col gap-5 text-sm md:hidden">
        <Link
          to="/search"
          search={SEARCH_DEFAULTS}
          onClick={onClose}
          className="text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
        >
          Cari
        </Link>
        <Link
          to="/quran"
          onClick={onClose}
          className="text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
        >
          Al-Qur'an
        </Link>
        <Link
          to="/hadith"
          onClick={onClose}
          className="text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
        >
          Hadis
        </Link>
        <Link
          to="/tentang"
          onClick={onClose}
          className="text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
        >
          Tentang
        </Link>
      </nav>
    </>
  );
}
