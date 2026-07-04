import { API_BASE } from "./constants";

export interface SearchParams {
  q: string;
  sources?: string;
  limit?: number;
  offset?: number;
  min_score?: number;
}

export interface SearchResult {
  type: "quran" | "hadith";
  source_id: number;
  score: number;
  relevance: number;
  surah_name?: string;
  surah_number?: number;
  verse_number?: number;
  collection_slug?: string;
  collection_name?: string;
  book_name?: string;
  hadith_number?: string;
  chapter_name?: string;
  grade?: string;
  text_arabic: string;
  text_translation?: string;
}

export interface SearchResponse {
  query: string;
  query_lang: string;
  total: number;
  results: SearchResult[];
  took_ms: number;
  page: number;
  pages: number;
}

export async function fetchSearch(params: SearchParams): Promise<SearchResponse> {
  const sp = new URLSearchParams();
  sp.set("q", params.q);
  if (params.sources) sp.set("sources", params.sources);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.offset) sp.set("offset", String(params.offset));
  if (params.min_score) sp.set("min_score", String(params.min_score));

  const res = await fetch(`${API_BASE}/search?${sp.toString()}`);
  if (!res.ok) throw new Error(`Search failed: ${res.statusText}`);
  return res.json();
}

export interface SurahInfo {
  id: number;
  name_arabic: string;
  name_english: string;
  revelation_type: string;
  verses_count: number;
}

export interface VerseInfo {
  id: number;
  verse_number: number;
  text_arabic: string;
  text_translation: string | null;
  juz: number | null;
}

export interface SurahDetailResponse {
  surah: SurahInfo;
  verses: VerseInfo[];
  page: number;
  per_page: number;
  total_verses: number;
  total_pages: number;
}

export interface HadithCollectionInfo {
  id: number;
  name_eng: string;
  name_ar: string;
  slug: string;
}

export interface HadithInfo {
  id: number;
  collection_name: string;
  collection_slug: string;
  book_name: string | null;
  hadith_number: string;
  chapter_name_eng: string | null;
  chapter_name_ar: string | null;
  text_arabic: string;
  text_translation: string | null;
  grade: string | null;
}

export interface HadithListResponse {
  collection: HadithCollectionInfo;
  hadiths: HadithInfo[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export async function fetchSurahs(): Promise<SurahInfo[]> {
  const res = await fetch(`${API_BASE}/quran/surahs`);
  if (!res.ok) throw new Error(`Failed to fetch surahs: ${res.statusText}`);
  return res.json();
}

export async function fetchSurahDetail(
  surahNumber: number,
  page = 1,
  perPage = 50,
): Promise<SurahDetailResponse> {
  const sp = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  const res = await fetch(`${API_BASE}/quran/${surahNumber}?${sp.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch surah: ${res.statusText}`);
  return res.json();
}

export async function fetchCollections(): Promise<HadithCollectionInfo[]> {
  const res = await fetch(`${API_BASE}/hadith/collections`);
  if (!res.ok) throw new Error(`Failed to fetch collections: ${res.statusText}`);
  return res.json();
}

export async function fetchCollectionHadith(
  slug: string,
  page = 1,
  perPage = 20,
): Promise<HadithListResponse> {
  const sp = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  const res = await fetch(`${API_BASE}/hadith/${slug}?${sp.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch hadith: ${res.statusText}`);
  return res.json();
}
