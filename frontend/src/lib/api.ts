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
