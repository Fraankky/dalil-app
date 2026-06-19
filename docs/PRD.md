# Product Requirements Document (PRD) — Dalil App

## 1. Product Overview

**Dalil** (دليل — "evidence/guide") is a semantic search platform for Islamic textual sources: the Qur'an, Hadith collections, and classical scholarly works. Unlike traditional keyword-based search, Dalil understands the **meaning** behind a user's query — whether typed in Arabic, English, or transliteration — and returns the most contextually relevant verses, narrations, and scholarly citations.

---

## 2. Problem Statement

Existing Islamic digital libraries suffer from:
- **Keyword-only search** — users must know exact Arabic phrasing to find relevant texts.
- **Language barrier** — non-Arabic speakers cannot query Arabic source texts effectively.
- **No conceptual linking** — a query about "kindness to neighbors" fails to surface verses using different wording with the same theme.
- **Fragmented sources** — Qur'an, Hadith, and scholarly works live in separate silos.

---

## 3. Target Users

| Persona | Need |
|---|---|
| **General Muslim** | "Is X halal/haram?" — quick, evidence-backed answers |
| **Student of Knowledge** | Deep cross-referencing across sources |
| **Imam/Khatib** | Finding relevant verses & hadith for Friday sermons |
| **Researcher/Academic** | Exhaustive search across classical texts |
| **Dawah Worker** | Sharing authentic, sourced Islamic guidance |

---

## 4. Core Features (MVP v1)

### 4.1 Semantic Search
- Natural-language query in **Arabic**, **English**, or **transliteration**.
- Returns top-K ranked results with relevance scores.
- Multi-source unified search (Qur'an → Hadith → Scholarly).

### 4.2 Source Corpus (Initial)
| Source | Content | Language |
|---|---|---|
| **Qur'an** | Full 6236 verses | Arabic + translations |
| **Sahih al-Bukhari** | ~7,500 hadith | Arabic + English |
| **Sahih Muslim** | ~7,500 hadith | Arabic + English |
| **Riyad as-Salihin** | ~1,900 hadith | Arabic + English |
| **40 Hadith Nawawi** | 42 hadith | Arabic + English |

### 4.3 Search Results Display
- Source badge (Qur'an / Bukhari / Muslim / etc.)
- Arabic text + translation side-by-side
- Chapter/Book name & number
- Relevance score (0–100%)
- Direct link / share button

### 4.4 Filtering & Narrowing
- Filter by source (Qur'an only, specific Hadith book, etc.)
- Filter by theme/category
- Language toggle for results display

### 4.5 Browsing
- Browse Qur'an by Surah
- Browse Hadith by Book/Chapter
- Paginated listing

### 4.6 Saved Items (optional for MVP)
- Bookmark verses/hadith
- Lightweight user accounts (optional)

---

## 5. User Stories (MVP)

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US1 | General Muslim | Type "what does Islam say about backbiting" in English | I get relevant verses and hadith about ghiba |
| US2 | General Muslim | Search "الصلاة" in Arabic | I see all references to prayer |
| US3 | Student | Filter results to Sahih al-Bukhari only | I focus on hadith sources |
| US4 | Non-Arabic speaker | Type "patience" in English | I find verses about "sabr" even though I don't know the Arabic word |
| US5 | Researcher | See Arabic text alongside translation | I can verify the original wording |
| US6 | User | Share a specific verse/hadith via link | I can send it to others |
| US7 | User | Browse the Qur'an surah by surah | I can read in order |
| US8 | User | Type a query in Latin transliteration (e.g., "sabrun jameel") | I still find relevant results |

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Search response < 500ms (p95) |
| **Accuracy** | Top-5 results must contain at least 1 relevant hit for 90% of queries |
| **Availability** | 99.5% uptime |
| **Scalability** | Support up to 10,000 concurrent users |
| **Languages** | Arabic (primary), English, Indonesian (future) |
| **Accessibility** | WCAG 2.1 AA |
| **Mobile** | Responsive PWA; mobile-first design |

---

## 7. Success Metrics

| Metric | Target |
|---|---|
| Daily Active Users (DAU) | 1,000 (month 3) |
| Average Search to Click Rate | > 60% |
| User Satisfaction Score | > 4.2/5 |
| Search Abandonment Rate | < 20% |

---

## 8. Out of Scope (MVP)

- User-generated content or annotations
- Real-time multi-user collaboration
- Arabic tashkeel (diacritic) auto-completion
- Voice search
- Offline mode
- Advanced scholarly commentary (tafsir/sharh)
- Mobile native apps (PWA only for MVP)

---

## 9. Roadmap

| Phase | Timeline | Deliverables |
|---|---|---|
| **Phase 1 — Foundation** | Weeks 1–3 | Data pipeline, vector embeddings, backend API, basic UI shell |
| **Phase 2 — Core Search** | Weeks 4–6 | Semantic search engine, search UI, filtering, results page |
| **Phase 3 — Browse & Polish** | Weeks 7–8 | Surah/Hadith browsing, share links, PWA, SEO |
| **Phase 4 — Launch** | Week 9 | Soft launch, monitoring, user feedback loop |
