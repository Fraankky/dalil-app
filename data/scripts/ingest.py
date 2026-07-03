"""
Ingestion script: Quran + Hadith → PostgreSQL.

Usage:
    python ingest.py quran
    python ingest.py hadith
    python ingest.py all

Requires PostgreSQL running (via docker compose or local).
Set DATABASE_URL in .env or environment.

Data sources:
    data/raw/quran/quran.json       — risan/quran-json
    data/raw/quran/chapters.json    — surah metadata (en)
    data/raw/hadith/{book}.json     — AhmedBaset/hadith-json
"""

import json
import os
import sys
import hashlib
from pathlib import Path
from typing import Optional

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parent.parent.parent
DATA_RAW = ROOT / "data" / "raw"

# ── Quran Data ────────────────────────────────────────────────────────

QURAN_JSON = DATA_RAW / "quran" / "quran.json"
CHAPTERS_JSON = DATA_RAW / "quran" / "chapters.json"

QURAN_SURAH_NAMES = {
    1: ("الفاتحة", "Al-Fatihah", "Meccan"),
    2: ("البقرة", "Al-Baqarah", "Medinan"),
    3: ("آل عمران", "Ali 'Imran", "Medinan"),
    4: ("النساء", "An-Nisa", "Medinan"),
    5: ("المائدة", "Al-Ma'idah", "Medinan"),
    6: ("الأنعام", "Al-An'am", "Meccan"),
    7: ("الأعراف", "Al-A'raf", "Meccan"),
    8: ("الأنفال", "Al-Anfal", "Medinan"),
    9: ("التوبة", "At-Tawbah", "Medinan"),
    10: ("يونس", "Yunus", "Meccan"),
    11: ("هود", "Hud", "Meccan"),
    12: ("يوسف", "Yusuf", "Meccan"),
    13: ("الرعد", "Ar-Ra'd", "Medinan"),
    14: ("ابراهيم", "Ibrahim", "Meccan"),
    15: ("الحجر", "Al-Hijr", "Meccan"),
    16: ("النحل", "An-Nahl", "Meccan"),
    17: ("الإسراء", "Al-Isra", "Meccan"),
    18: ("الكهف", "Al-Kahf", "Meccan"),
    19: ("مريم", "Maryam", "Meccan"),
    20: ("طه", "Taha", "Meccan"),
    21: ("الأنبياء", "Al-Anbiya", "Meccan"),
    22: ("الحج", "Al-Hajj", "Medinan"),
    23: ("المؤمنون", "Al-Mu'minun", "Meccan"),
    24: ("النور", "An-Nur", "Medinan"),
    25: ("الفرقان", "Al-Furqan", "Meccan"),
    26: ("الشعراء", "Ash-Shu'ara", "Meccan"),
    27: ("النمل", "An-Naml", "Meccan"),
    28: ("القصص", "Al-Qasas", "Meccan"),
    29: ("العنكبوت", "Al-'Ankabut", "Meccan"),
    30: ("الروم", "Ar-Rum", "Meccan"),
    31: ("لقمان", "Luqman", "Meccan"),
    32: ("السجدة", "As-Sajdah", "Meccan"),
    33: ("الأحزاب", "Al-Ahzab", "Medinan"),
    34: ("سبإ", "Saba", "Meccan"),
    35: ("فاطر", "Fatir", "Meccan"),
    36: ("يس", "Ya-Sin", "Meccan"),
    37: ("الصافات", "As-Saffat", "Meccan"),
    38: ("ص", "Sad", "Meccan"),
    39: ("الزمر", "Az-Zumar", "Meccan"),
    40: ("غافر", "Ghafir", "Meccan"),
    41: ("فصلت", "Fussilat", "Meccan"),
    42: ("الشورى", "Ash-Shura", "Meccan"),
    43: ("الزخرف", "Az-Zukhruf", "Meccan"),
    44: ("الدخان", "Ad-Dukhan", "Meccan"),
    45: ("الجاثية", "Al-Jathiyah", "Meccan"),
    46: ("الأحقاف", "Al-Ahqaf", "Meccan"),
    47: ("محمد", "Muhammad", "Medinan"),
    48: ("الفتح", "Al-Fath", "Medinan"),
    49: ("الحجرات", "Al-Hujurat", "Medinan"),
    50: ("ق", "Qaf", "Meccan"),
    51: ("الذاريات", "Adh-Dhariyat", "Meccan"),
    52: ("الطور", "At-Tur", "Meccan"),
    53: ("النجم", "An-Najm", "Meccan"),
    54: ("القمر", "Al-Qamar", "Meccan"),
    55: ("الرحمن", "Ar-Rahman", "Medinan"),
    56: ("الواقعة", "Al-Waqi'ah", "Meccan"),
    57: ("الحديد", "Al-Hadid", "Medinan"),
    58: ("المجادلة", "Al-Mujadilah", "Medinan"),
    59: ("الحشر", "Al-Hashr", "Medinan"),
    60: ("الممتحنة", "Al-Mumtahanah", "Medinan"),
    61: ("الصف", "As-Saff", "Medinan"),
    62: ("الجمعة", "Al-Jumu'ah", "Medinan"),
    63: ("المنافقون", "Al-Munafiqun", "Medinan"),
    64: ("التغابن", "At-Taghabun", "Medinan"),
    65: ("الطلاق", "At-Talaq", "Medinan"),
    66: ("التحريم", "At-Tahrim", "Medinan"),
    67: ("الملك", "Al-Mulk", "Meccan"),
    68: ("القلم", "Al-Qalam", "Meccan"),
    69: ("الحاقة", "Al-Haqqah", "Meccan"),
    70: ("المعارج", "Al-Ma'arij", "Meccan"),
    71: ("نوح", "Nuh", "Meccan"),
    72: ("الجن", "Al-Jinn", "Meccan"),
    73: ("المزمل", "Al-Muzzammil", "Meccan"),
    74: ("المدثر", "Al-Muddaththir", "Meccan"),
    75: ("القيامة", "Al-Qiyamah", "Meccan"),
    76: ("الانسان", "Al-Insan", "Medinan"),
    77: ("المرسلات", "Al-Mursalat", "Meccan"),
    78: ("النبإ", "An-Naba", "Meccan"),
    79: ("النازعات", "An-Nazi'at", "Meccan"),
    80: ("عبس", "'Abasa", "Meccan"),
    81: ("التكوير", "At-Takwir", "Meccan"),
    82: ("الإنفطار", "Al-Infitar", "Meccan"),
    83: ("المطففين", "Al-Mutaffifin", "Meccan"),
    84: ("الإنشقاق", "Al-Inshiqaq", "Meccan"),
    85: ("البروج", "Al-Buruj", "Meccan"),
    86: ("الطارق", "At-Tariq", "Meccan"),
    87: ("الأعلى", "Al-A'la", "Meccan"),
    88: ("الغاشية", "Al-Ghashiyah", "Meccan"),
    89: ("الفجر", "Al-Fajr", "Meccan"),
    90: ("البلد", "Al-Balad", "Meccan"),
    91: ("الشمس", "Ash-Shams", "Meccan"),
    92: ("الليل", "Al-Layl", "Meccan"),
    93: ("الضحى", "Ad-Duha", "Meccan"),
    94: ("الشرح", "Ash-Sharh", "Meccan"),
    95: ("التين", "At-Tin", "Meccan"),
    96: ("العلق", "Al-'Alaq", "Meccan"),
    97: ("القدر", "Al-Qadr", "Meccan"),
    98: ("البينة", "Al-Bayyinah", "Medinan"),
    99: ("الزلزلة", "Az-Zalzalah", "Medinan"),
    100: ("العاديات", "Al-'Adiyat", "Meccan"),
    101: ("القارعة", "Al-Qari'ah", "Meccan"),
    102: ("التكاثر", "At-Takathur", "Meccan"),
    103: ("العصر", "Al-'Asr", "Meccan"),
    104: ("الهمزة", "Al-Humazah", "Meccan"),
    105: ("الفيل", "Al-Fil", "Meccan"),
    106: ("قريش", "Quraysh", "Meccan"),
    107: ("الماعون", "Al-Ma'un", "Meccan"),
    108: ("الكوثر", "Al-Kawthar", "Meccan"),
    109: ("الكافرون", "Al-Kafirun", "Meccan"),
    110: ("النصر", "An-Nasr", "Medinan"),
    111: ("المسد", "Al-Masad", "Meccan"),
    112: ("الإخلاص", "Al-Ikhlas", "Meccan"),
    113: ("الفلق", "Al-Falaq", "Meccan"),
    114: ("الناس", "An-Nas", "Meccan"),
}

# ── Hadith Book Metadata ──────────────────────────────────────────────

HADITH_BOOKS = {
    "bukhari": {
        "name_eng": "Sahih al-Bukhari",
        "name_ar": "صحيح البخاري",
        "slug": "bukhari",
        "collection_id": 1,
    },
    "muslim": {
        "name_eng": "Sahih Muslim",
        "name_ar": "صحيح مسلم",
        "slug": "muslim",
        "collection_id": 2,
    },
    "abudawud": {
        "name_eng": "Sunan Abu Dawud",
        "name_ar": "سنن أبي داود",
        "slug": "abudawud",
        "collection_id": 3,
    },
    "tirmidhi": {
        "name_eng": "Jami' at-Tirmidhi",
        "name_ar": "جامع الترمذي",
        "slug": "tirmidhi",
        "collection_id": 4,
    },
    "nasai": {
        "name_eng": "Sunan an-Nasa'i",
        "name_ar": "سنن النسائي",
        "slug": "nasai",
        "collection_id": 5,
    },
    "ibnmajah": {
        "name_eng": "Sunan Ibn Majah",
        "name_ar": "سنن ابن ماجه",
        "slug": "ibnmajah",
        "collection_id": 6,
    },
    "malik": {
        "name_eng": "Muwatta Malik",
        "name_ar": "موطأ مالك",
        "slug": "malik",
        "collection_id": 7,
    },
    "nawawi40": {
        "name_eng": "Forty Hadith of an-Nawawi",
        "name_ar": "الأربعون النووية",
        "slug": "nawawi40",
        "collection_id": 8,
    },
}

HADITH_FILES = {
    "bukhari": DATA_RAW / "hadith" / "bukhari.json",
    "muslim": DATA_RAW / "hadith" / "muslim.json",
    "abudawud": DATA_RAW / "hadith" / "abudawud.json",
    "tirmidhi": DATA_RAW / "hadith" / "tirmidhi.json",
    "nasai": DATA_RAW / "hadith" / "nasai.json",
    "ibnmajah": DATA_RAW / "hadith" / "ibnmajah.json",
    "malik": DATA_RAW / "hadith" / "malik.json",
    "nawawi40": DATA_RAW / "hadith" / "nawawi40.json",
}


def get_db_url() -> str:
    """Get database URL from environment or default."""
    url = os.environ.get(
        "DATABASE_URL_SYNC",
        "postgresql://postgres:postgres@localhost:5432/dalil",
    )
    return url


def get_engine(db_url: Optional[str] = None):
    url = db_url or get_db_url()
    return create_engine(url, echo=False)


# ── Quran Ingestion ───────────────────────────────────────────────────

def ingest_quran(session: Session) -> dict:
    """Ingest Quran data from quran.json."""
    print("\n=== INGEST QURAN ===")
    assert QURAN_JSON.exists(), f"File not found: {QURAN_JSON}"

    with open(QURAN_JSON) as f:
        quran_data = json.load(f)

    stats = {"surahs": 0, "verses": 0}

    # Insert surahs
    for surah_num_str, verses_list in quran_data.items():
        surah_num = int(surah_num_str)
        if surah_num in QURAN_SURAH_NAMES:
            name_ar, name_en, rev_type = QURAN_SURAH_NAMES[surah_num]
        else:
            continue

        session.execute(
            text(
                """INSERT INTO surahs (id, name_arabic, name_english, revelation_type, verses_count)
                   VALUES (:id, :name_ar, :name_en, :rev_type, :count)
                   ON CONFLICT (id) DO UPDATE SET
                       name_arabic = EXCLUDED.name_arabic,
                       name_english = EXCLUDED.name_english,
                       revelation_type = EXCLUDED.revelation_type,
                       verses_count = EXCLUDED.verses_count"""
            ),
            {
                "id": surah_num,
                "name_ar": name_ar,
                "name_en": name_en,
                "rev_type": rev_type,
                "count": len(verses_list),
            },
        )
        stats["surahs"] += 1

    session.commit()
    print(f"  Inserted {stats['surahs']} surahs")

    # Insert verses in batches
    batch = []
    total = 0
    for surah_num_str, verses_list in quran_data.items():
        surah_num = int(surah_num_str)
        for v in verses_list:
            batch.append({
                "surah_id": surah_num,
                "verse_number": v["verse"],
                "text_arabic": v["text"],
            })
            total += 1
            if len(batch) >= 500:
                _insert_verses_batch(session, batch)
                stats["verses"] += len(batch)
                batch = []

    if batch:
        _insert_verses_batch(session, batch)
        stats["verses"] += len(batch)

    session.commit()
    print(f"  Inserted {stats['verses']} verses (total: {total})")
    return stats


def _insert_verses_batch(session: Session, batch: list[dict]) -> None:
    """Bulk insert verses using raw SQL."""
    values = ", ".join(
        f"(:surah_id_{i}, :verse_number_{i}, :text_arabic_{i})"
        for i in range(len(batch))
    )
    params = {}
    for i, v in enumerate(batch):
        params[f"surah_id_{i}"] = v["surah_id"]
        params[f"verse_number_{i}"] = v["verse_number"]
        params[f"text_arabic_{i}"] = v["text_arabic"]

    session.execute(
        text(
            f"""INSERT INTO verses (surah_id, verse_number, text_arabic)
                VALUES {values}
                ON CONFLICT (surah_id, verse_number) DO UPDATE
                SET text_arabic = EXCLUDED.text_arabic"""
        ),
        params,
    )


# ── Hadith Ingestion ──────────────────────────────────────────────────

def ingest_hadith(session: Session, book_slug: str) -> dict:
    """Ingest a single hadith book."""
    filepath = HADITH_FILES.get(book_slug)
    if not filepath or not filepath.exists():
        print(f"  SKIP {book_slug}: file not found at {filepath}")
        return {"collections": 0, "books": 0, "chapters": 0, "hadith": 0}

    meta = HADITH_BOOKS[book_slug]
    print(f"\n  === {meta['name_eng']} ({book_slug}) ===")

    with open(filepath) as f:
        data = json.load(f)

    stats = {"collections": 0, "books": 0, "chapters": 0, "hadith": 0}

    # Insert or update collection
    session.execute(
        text(
            """INSERT INTO hadith_collections (id, name_eng, name_ar, slug)
               VALUES (:id, :name_eng, :name_ar, :slug)
               ON CONFLICT (id) DO UPDATE SET
                   name_eng = EXCLUDED.name_eng,
                   name_ar = EXCLUDED.name_ar,
                   slug = EXCLUDED.slug"""
        ),
        {
            "id": meta["collection_id"],
            "name_eng": meta["name_eng"],
            "name_ar": meta["name_ar"],
            "slug": meta["slug"],
        },
    )
    stats["collections"] = 1

    # Insert chapters as "books" (hadith_books table)
    chapters = data.get("chapters", [])
    for ch in chapters:
        session.execute(
            text(
                """INSERT INTO hadith_books (collection_id, name_eng, name_ar, book_number)
                   VALUES (:coll_id, :name_eng, :name_ar, :book_number)
                   ON CONFLICT DO NOTHING"""
            ),
            {
                "coll_id": meta["collection_id"],
                "name_eng": ch.get("english", ""),
                "name_ar": ch.get("arabic", ""),
                "book_number": ch.get("id", 0),
            },
        )
        stats["books"] += 1

    # Insert hadiths in batches
    hadiths = data.get("hadiths", [])
    batch = []
    for h in hadiths:
        english = h.get("english", {})
        if isinstance(english, dict):
            text_en = (english.get("narrator", "") + " " + english.get("text", "")).strip()
        elif isinstance(english, str):
            text_en = english
        else:
            text_en = ""

        chapter_id_raw = h.get("chapterId")
        chapter_id = int(chapter_id_raw) if chapter_id_raw is not None else 0

        batch.append({
            "collection_id": meta["collection_id"],
            "chapter_id": h.get("chapterId"),
            "hadith_number": str(h.get("idInBook", h.get("id", ""))),
            "chapter_name_eng": chapters[chapter_id].get("english", "") if chapter_id < len(chapters) else "",
            "chapter_name_ar": chapters[chapter_id].get("arabic", "") if chapter_id < len(chapters) else "",
            "text_arabic": h.get("arabic", ""),
            "text_english": text_en,
            "grade": h.get("grade"),
        })

        if len(batch) >= 500:
            _insert_hadith_batch(session, batch)
            stats["hadith"] += len(batch)
            batch = []

    if batch:
        _insert_hadith_batch(session, batch)
        stats["hadith"] += len(batch)

    session.commit()
    print(f"    Collections: {stats['collections']}, Books: {stats['books']}, Hadith: {stats['hadith']}")
    return stats


def _insert_hadith_batch(session: Session, batch: list[dict]) -> None:
    """Bulk insert hadith entries."""
    values = ", ".join(
        f"(:cid_{i}, :chid_{i}, :num_{i}, :cheng_{i}, :char_{i}, :ar_{i}, :en_{i}, :grade_{i})"
        for i in range(len(batch))
    )
    params = {}
    for i, h in enumerate(batch):
        params[f"cid_{i}"] = h["collection_id"]
        params[f"chid_{i}"] = h["chapter_id"]
        params[f"num_{i}"] = h["hadith_number"]
        params[f"cheng_{i}"] = h["chapter_name_eng"]
        params[f"char_{i}"] = h["chapter_name_ar"]
        params[f"ar_{i}"] = h["text_arabic"]
        params[f"en_{i}"] = h["text_english"]
        params[f"grade_{i}"] = h.get("grade")

    session.execute(
        text(
            f"""INSERT INTO hadith (collection_id, chapter_id, hadith_number,
                    chapter_name_eng, chapter_name_ar, text_arabic,
                    text_english, grade)
                VALUES {values}
                ON CONFLICT (collection_id, hadith_number) DO UPDATE SET
                    chapter_id = EXCLUDED.chapter_id,
                    text_arabic = EXCLUDED.text_arabic,
                    text_english = EXCLUDED.text_english,
                    grade = EXCLUDED.grade"""
        ),
        params,
    )


# ── Main ──────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("Usage: python ingest.py [quran|hadith|all]")
        print("  quran   — Ingest Quran only")
        print("  hadith  — Ingest Hadith only (all 8 books)")
        print("  all     — Ingest everything")
        sys.exit(1)

    cmd = sys.argv[1]
    db_url = get_db_url()
    print(f"Database: {db_url}")
    engine = get_engine(db_url)

    total = {}

    with Session(engine) as session:
        if cmd in ("quran", "all"):
            total["quran"] = ingest_quran(session)

        if cmd in ("hadith", "all"):
            total["hadith"] = {}
            for slug in HADITH_BOOKS:
                total["hadith"][slug] = ingest_hadith(session, slug)

    print("\n=== INGESTION COMPLETE ===")
    print(json.dumps(total, indent=2, default=str))

    # Print summary
    if "quran" in total:
        q = total["quran"]
        print(f"Quran: {q['surahs']} surahs, {q['verses']} verses")
    if "hadith" in total:
        for slug, stats in total["hadith"].items():
            print(f"  {slug}: {stats.get('hadith', 0)} hadith")


if __name__ == "__main__":
    main()
