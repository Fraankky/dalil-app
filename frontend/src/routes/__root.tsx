import { BookOpenIcon } from "@/components/icons";
import { Outlet, createRootRoute } from "@tanstack/react-router";

function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-200 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-semibold text-lg text-emerald-700">
            <BookOpenIcon />
            Dalil
          </a>
          <nav className="flex items-center gap-6 text-sm text-neutral-600">
            <a href="/search?q=" className="hover:text-neutral-900 transition-colors">
              Search
            </a>
            <a href="/quran" className="hover:text-neutral-900 transition-colors">
              Qur&apos;an
            </a>
            <a href="/hadith" className="hover:text-neutral-900 transition-colors">
              Hadith
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-neutral-200 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-neutral-400">
          Dalil &mdash; Semantic search for Islamic texts. All content sourced from open, verified
          datasets.
        </div>
      </footer>
    </div>
  );
}

export const rootRoute = createRootRoute({
  component: RootLayout,
});
