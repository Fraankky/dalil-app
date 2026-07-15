import { API_BASE } from "./constants";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const signals: AbortSignal[] = [AbortSignal.timeout(10_000)];
  if (init?.signal) signals.push(init.signal);
  try {
    return await fetch(url, { ...init, signal: AbortSignal.any(signals) });
  } catch (e) {
    if (e instanceof DOMException && e.name === "TimeoutError") {
      throw new ApiError("Permintaan waktu habis. Coba lagi.", 0);
    }
    if (e instanceof DOMException && e.name === "AbortError" && !signals[0].aborted) {
      throw new ApiError("Permintaan dibatalkan.", 0);
    }
    throw new ApiError("Gagal terhubung ke server.", 0);
  }
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError("Respon tidak valid dari server.", res.status);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError("Respon tidak valid dari server.", res.status);
  }
}

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
  search_type?: "keyword" | "semantic";
}

export async function fetchSearch(params: SearchParams): Promise<SearchResponse> {
  const sp = new URLSearchParams();
  sp.set("q", params.q);
  if (params.sources) sp.set("sources", params.sources);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.offset) sp.set("offset", String(params.offset));
  if (params.min_score) sp.set("min_score", String(params.min_score));

  const res = await apiFetch(`${API_BASE}/search?${sp.toString()}`);
  if (!res.ok) throw new ApiError("Gagal memuat data. Coba lagi nanti.", res.status);
  return readJson<SearchResponse>(res);
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

export interface VerseDetailResponse {
  id: number;
  surah_name_arabic: string;
  surah_name_english: string;
  surah_number: number;
  verse_number: number;
  text_arabic: string;
  text_translation: string | null;
  juz: number | null;
  revelation_type: string | null;
  tafsir: {
    kemenag_short: string;
    kemenag_long: string;
    quraish: string;
    jalalayn: string;
  } | null;
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
  text_syarah: string | null;
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
  const res = await apiFetch(`${API_BASE}/quran/surahs`);
  if (!res.ok) throw new ApiError("Gagal memuat data. Coba lagi nanti.", res.status);
  return readJson<SurahInfo[]>(res);
}

export async function fetchSurahDetail(
  surahNumber: number,
  page = 1,
  perPage = 50,
): Promise<SurahDetailResponse> {
  const sp = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  const res = await apiFetch(`${API_BASE}/quran/${surahNumber}?${sp.toString()}`);
  if (!res.ok) throw new ApiError("Gagal memuat data. Coba lagi nanti.", res.status);
  return readJson<SurahDetailResponse>(res);
}

export async function fetchVerseDetail(
  surahNumber: number,
  verseNumber: number,
): Promise<VerseDetailResponse> {
  const res = await apiFetch(`${API_BASE}/quran/${surahNumber}/${verseNumber}`);
  if (!res.ok) throw new ApiError("Gagal memuat data. Coba lagi nanti.", res.status);
  return readJson<VerseDetailResponse>(res);
}

export async function fetchHadithDetail(slug: string, hadithId: number): Promise<HadithInfo> {
  const res = await apiFetch(`${API_BASE}/hadith/${slug}/${hadithId}`);
  if (!res.ok) throw new ApiError("Gagal memuat data. Coba lagi nanti.", res.status);
  return readJson<HadithInfo>(res);
}

export async function fetchCollections(): Promise<HadithCollectionInfo[]> {
  const res = await apiFetch(`${API_BASE}/hadith/collections`);
  if (!res.ok) throw new ApiError("Gagal memuat data. Coba lagi nanti.", res.status);
  return readJson<HadithCollectionInfo[]>(res);
}

export async function fetchCollectionHadith(
  slug: string,
  page = 1,
  perPage = 20,
): Promise<HadithListResponse> {
  const sp = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  const res = await apiFetch(`${API_BASE}/hadith/${slug}?${sp.toString()}`);
  if (!res.ok) throw new ApiError("Gagal memuat data. Coba lagi nanti.", res.status);
  return readJson<HadithListResponse>(res);
}

export interface StatsResponse {
  total_verses: number;
  total_surahs: number;
  total_hadith: number;
  total_collections: number;
  total_embeddings: number;
  quran_embeddings: number;
  hadith_embeddings: number;
  model_name: string;
  model_dim: number;
}

export async function fetchStats(): Promise<StatsResponse> {
  const res = await apiFetch(`${API_BASE}/stats`);
  if (!res.ok) throw new ApiError("Gagal memuat data. Coba lagi nanti.", res.status);
  return readJson<StatsResponse>(res);
}
