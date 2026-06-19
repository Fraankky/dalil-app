import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";

function QuranPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Browse the Qur&apos;an</h1>
      <p className="text-neutral-500">Surah listing will be implemented in the next phase.</p>
    </div>
  );
}

export const quranRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/quran",
  component: QuranPage,
});
