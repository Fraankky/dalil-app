import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";

function HadithPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Browse Hadith Collections</h1>
      <p className="text-neutral-500">
        Hadith collection listing will be implemented in the next phase.
      </p>
    </div>
  );
}

export const hadithRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/hadith",
  component: HadithPage,
});
