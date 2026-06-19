import { rootRoute } from "./routes/__root";
import { indexRoute } from "./routes/index";
import { searchRoute } from "./routes/search";
import { quranRoute } from "./routes/quran";
import { hadithRoute } from "./routes/hadith";

export const routeTree = rootRoute.addChildren([
  indexRoute,
  searchRoute,
  quranRoute,
  hadithRoute,
]);
