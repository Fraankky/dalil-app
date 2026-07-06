import { rootRoute } from "./routes/__root";
import { indexRoute } from "./routes/index";
import { searchRoute } from "./routes/search";
import { quranRoute } from "./routes/quran";
import { surahDetailRoute } from "./routes/quran.$surahId";
import { verseDetailRoute } from "./routes/quran.$surahId.$verseNumber";
import { hadithRoute } from "./routes/hadith";
import { hadithCollectionRoute } from "./routes/hadith.$slug";
import { hadithDetailRoute } from "./routes/hadith.$slug.$hadithId";

export const routeTree = rootRoute.addChildren([
  indexRoute,
  searchRoute,
  quranRoute,
  surahDetailRoute,
  verseDetailRoute,
  hadithRoute,
  hadithCollectionRoute,
  hadithDetailRoute,
]);
