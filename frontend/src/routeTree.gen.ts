import { rootRoute } from "./routes/__root";
import { indexRoute } from "./routes/index";
import { searchRoute } from "./routes/search";
import { quranRoute } from "./routes/quran";
import { surahDetailRoute } from "./routes/quran.$surahId";
import { hadithRoute } from "./routes/hadith";
import { hadithCollectionRoute } from "./routes/hadith.$slug";

export const routeTree = rootRoute.addChildren([
  indexRoute,
  searchRoute,
  quranRoute.addChildren([surahDetailRoute]),
  hadithRoute.addChildren([hadithCollectionRoute]),
]);