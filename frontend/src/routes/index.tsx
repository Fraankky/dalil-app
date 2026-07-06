import { SearchIcon } from "@/components/icons";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { rootRoute } from "./__root";

function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) return;
      navigate({
        to: "/search",
        search: { q: query.trim() },
      });
    },
    [query, navigate],
  );

  const handleSuggestion = (q: string) => {
    setQuery(q);
    navigate({
      to: "/search",
      search: { q },
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 mb-3">
          Temukan Dalil Islam Berdasarkan Makna
        </h1>
        <p className="text-lg text-neutral-500 max-w-xl mx-auto">
          Cari ayat Al-Qur'an dan hadis dalam bahasa Arab, Inggris, atau transliterasi. Didukung
          oleh AI semantik yang memahami maksud Anda.
        </p>
      </div>

      <form onSubmit={handleSearch} className="relative mb-8">
        <div className="flex items-center border-2 border-neutral-200 rounded-xl shadow-sm focus-within:border-emerald-500 focus-within:shadow-md transition-all">
          <span className="pl-4 text-neutral-400">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Coba "sabar dalam Islam", "hak tetangga", atau "الصبر"'
            className="w-full px-4 py-4 text-lg bg-transparent outline-none placeholder:text-neutral-300"
          />
          <button
            type="submit"
            disabled={!query.trim()}
            className="m-2 px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cari
          </button>
        </div>
      </form>

      <div className="flex flex-wrap justify-center gap-3">
        {["Sabar dalam Islam", "Hak tetangga", "الصبر", "Ampunan", "Jujur dalam berdagang"].map(
          (suggestion) => (
            <button
              type="button"
              key={suggestion}
              onClick={() => handleSuggestion(suggestion)}
              className="px-4 py-1.5 text-sm bg-neutral-100 text-neutral-600 rounded-full hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
            >
              {suggestion}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});
