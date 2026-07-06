import { BookOpenIcon } from "@/components/icons";
import { Link, Outlet, createRootRoute } from "@tanstack/react-router";

function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-200 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-lg text-emerald-700">
            <BookOpenIcon />
            Dalil
          </Link>
          <nav className="flex items-center gap-6 text-sm text-neutral-600">
            <Link
              to="/search"
              search={{ q: "" }}
              className="hover:text-neutral-900 transition-colors"
            >
              Cari
            </Link>
            <Link to="/quran" className="hover:text-neutral-900 transition-colors">
              Al-Qur'an
            </Link>
            <Link to="/hadith" className="hover:text-neutral-900 transition-colors">
              Hadis
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-neutral-200 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-neutral-400">
          Dalil &mdash; Ensiklopedia dalil Islam berbasis pencarian makna.
        </div>
      </footer>
    </div>
  );
}

export const rootRoute = createRootRoute({
  component: RootLayout,
});
