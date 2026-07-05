"""
Ingestion script: Quran + Hadith → PostgreSQL.

Usage:
    python ingest.py quran
    python ingest.py hadith
    python ingest.py all

Requires PostgreSQL running (via docker compose or local).
Set DATABASE_URL in .env or environment.
"""

import json
import os
import sys
from pathlib import Path
from typing import Optional

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parent.parent.parent
DATA_RAW = ROOT / "data" / "raw"

# ── Quran Data ────────────────────────────────────────────────────────

QURAN_JSON = DATA_RAW / "quran" / "quran.json"

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

# ── Hadith Book Metadata (Indonesian) ──────────────────────────────────

HADITH_ID_FILES = {
    "abudawud": DATA_RAW / "hadith-id" / "abu-dawud.json",
    "ahmad": DATA_RAW / "hadith-id" / "ahmad.json",
    "bukhari": DATA_RAW / "hadith-id" / "bukhari.json",
    "darimi": DATA_RAW / "hadith-id" / "darimi.json",
    "ibnmajah": DATA_RAW / "hadith-id" / "ibnu-majah.json",
    "malik": DATA_RAW / "hadith-id" / "malik.json",
    "muslim": DATA_RAW / "hadith-id" / "muslim.json",
    "nasai": DATA_RAW / "hadith-id" / "nasai.json",
    "tirmidhi": DATA_RAW / "hadith-id" / "tirmidzi.json",
}

HADITH_COLLECTIONS_ID = {
    "abudawud": {"name_eng": "Abu Dawud", "slug": "abudawud"},
    "ahmad": {"name_eng": "Ahmad", "slug": "ahmad"},
    "bukhari": {"name_eng": "Bukhari", "slug": "bukhari"},
    "darimi": {"name_eng": "Darimi", "slug": "darimi"},
    "ibnmajah": {"name_eng": "Ibnu Majah", "slug": "ibnmajah"},
    "malik": {"name_eng": "Malik", "slug": "malik"},
    "muslim": {"name_eng": "Muslim", "slug": "muslim"},
    "nasai": {"name_eng": "Nasai", "slug": "nasai"},
    "tirmidhi": {"name_eng": "Tirmidzi", "slug": "tirmidhi"},
}

HADITH_BOOKS = {
    slug: {"name_eng": info["name_eng"], "name_ar": "", "slug": info["slug"], "collection_id": idx + 1}
    for idx, (slug, info) in enumerate(HADITH_COLLECTIONS_ID.items())
}

HADITH_FILES = HADITH_ID_FILES


def get_db_url() -> str:
    url = os.environ.get(
        "DATABASE_URL_SYNC",
        "postgresql://postgres:postgres@localhost:5432/dalil",
    )
    return url


def get_engine(db_url: Optional[str] = None):
    url = db_url or get_db_url()
    return create_engine(url, echo=False)


# ── Quran Ingestion ───────────────────────────────────────────────────


def _load_quran_arabic(path: Path) -> dict[tuple[int, int], str]:
    with open(path) as f:
        data = json.load(f)
    result = {}
    for surah_str, verses in data.items():
        surah = int(surah_str)
        for v in verses:
            result[(surah, v["verse"])] = v["text"]
    return result


def _load_quran_translation(path: Path) -> dict[tuple[int, int], str]:
    with open(path) as f:
        data = json.load(f)
    result = {}
    if isinstance(data, dict) and "quran" in data:
        for v in data["quran"]:
            result[(v["chapter"], v["verse"])] = v["text"]
    elif isinstance(data, list):
        for v in data:
            result[(v["chapter"], v["verse"])] = v["text"]
    return result


def ingest_quran(session: Session) -> dict:
    print("\n=== INGEST QURAN ===")
    arabic = _load_quran_arabic(QURAN_JSON)
    translation = _load_quran_translation(DATA_RAW / "quran" / "quran-id.json")

    stats = {"surahs": 0, "verses": 0}

    for surah_num in sorted(set(k[0] for k in arabic)):
        if surah_num in QURAN_SURAH_NAMES:
            name_ar, name_en, rev_type = QURAN_SURAH_NAMES[surah_num]
        else:
            continue
        surah_verses = sorted(k[1] for k in arabic if k[0] == surah_num)
        session.execute(
            text("""INSERT INTO surahs (id, name_arabic, name_english, revelation_type, verses_count)
                     VALUES (:id, :name_ar, :name_en, :rev_type, :count)
                     ON CONFLICT (id) DO UPDATE SET
                         name_arabic = EXCLUDED.name_arabic,
                         name_english = EXCLUDED.name_english,
                         revelation_type = EXCLUDED.revelation_type,
                         verses_count = EXCLUDED.verses_count"""),
            {"id": surah_num, "name_ar": name_ar, "name_en": name_en, "rev_type": rev_type, "count": len(surah_verses)},
        )
        stats["surahs"] += 1

    session.commit()
    print(f"  Inserted {stats['surahs']} surahs")

    batch = []
    for (surah, verse), arabic_text in sorted(arabic.items()):
        trans = translation.get((surah, verse), "")
        batch.append({"surah_id": surah, "verse_number": verse, "text_arabic": arabic_text, "text_translation": trans})
        if len(batch) >= 500:
            _insert_verses_batch(session, batch)
            stats["verses"] += len(batch)
            batch = []

    if batch:
        _insert_verses_batch(session, batch)
        stats["verses"] += len(batch)

    session.commit()
    print(f"  Inserted {stats['verses']} verses")
    return stats


def _insert_verses_batch(session: Session, batch: list[dict]) -> None:
    values = ", ".join(f"(:sid_{i}, :vn_{i}, :ar_{i}, :tr_{i})" for i in range(len(batch)))
    params = {}
    for i, v in enumerate(batch):
        params[f"sid_{i}"] = v["surah_id"]
        params[f"vn_{i}"] = v["verse_number"]
        params[f"ar_{i}"] = v["text_arabic"]
        params[f"tr_{i}"] = v["text_translation"]
    session.execute(
        text(f"""INSERT INTO verses (surah_id, verse_number, text_arabic, text_translation)
                 VALUES {values}
                 ON CONFLICT (surah_id, verse_number) DO UPDATE SET
                     text_arabic = EXCLUDED.text_arabic,
                     text_translation = EXCLUDED.text_translation"""),
        params,
    )


# ── Hadith Ingestion ──────────────────────────────────────────────────


def ingest_hadith(session: Session, book_slug: str) -> dict:
    filepath = HADITH_FILES.get(book_slug)
    if not filepath or not filepath.exists():
        print(f"  SKIP {book_slug}: file not found")
        return {"collections": 0, "books": 0, "chapters": 0, "hadith": 0}

    meta = HADITH_BOOKS[book_slug]
    print(f"\n  === {meta['name_eng']} ({book_slug}) ===")

    with open(filepath) as f:
        hadiths = json.load(f)

    stats = {"collections": 0, "books": 0, "chapters": 0, "hadith": 0}

    session.execute(
        text("""INSERT INTO hadith_collections (id, name_eng, name_ar, slug)
                 VALUES (:id, :name_eng, :name_ar, :slug)
                 ON CONFLICT (id) DO UPDATE SET
                     name_eng = EXCLUDED.name_eng, name_ar = EXCLUDED.name_ar, slug = EXCLUDED.slug"""),
        {"id": meta["collection_id"], "name_eng": meta["name_eng"], "name_ar": meta["name_ar"], "slug": meta["slug"]},
    )
    stats["collections"] = 1

    books = {}
    batch = []
    for h in hadiths:
        book = _extract_hadith_book(h)
        if book is not None:
            books[book["book_number"]] = book
        batch.append(_prepare_hadith_row(meta, h))
        if len(batch) >= 500:
            _insert_hadith_batch(session, batch)
            stats["hadith"] += len(batch)
            batch = []

    if batch:
        _insert_hadith_batch(session, batch)
        stats["hadith"] += len(batch)

    if books:
        _insert_hadith_books_batch(session, meta["collection_id"], list(books.values()))
        stats["books"] = len(books)

    session.commit()
    print(f"    Collections: {stats['collections']}, Books: {stats['books']}, Hadith: {stats['hadith']}")
    return stats


def _extract_hadith_book(row: dict) -> dict | None:
    book_number = row.get("book_number") or row.get("book") or row.get("book_id")
    if book_number is None:
        return None

    return {
        "book_number": int(book_number),
        "name_eng": row.get("book_name") or row.get("book_name_eng") or f"Book {book_number}",
        "name_ar": row.get("book_name_ar") or row.get("book_ar") or "",
    }


def _prepare_hadith_row(meta: dict, row: dict) -> dict:
    book = _extract_hadith_book(row)
    return {
        "collection_id": meta["collection_id"],
        "chapter_id": book["book_number"] if book else None,
        "hadith_number": str(row.get("number", "")),
        "chapter_name_eng": None,
        "chapter_name_ar": None,
        "text_arabic": row.get("arab", ""),
        "text_translation": row.get("id", ""),
        "grade": None,
    }


def _insert_hadith_books_batch(session: Session, collection_id: int, books: list[dict]) -> None:
    values = ", ".join(f"(:cid_{i}, :bn_{i}, :eng_{i}, :ar_{i})" for i in range(len(books)))
    params = {}
    for i, book in enumerate(books):
        params[f"cid_{i}"] = collection_id
        params[f"bn_{i}"] = book["book_number"]
        params[f"eng_{i}"] = book["name_eng"]
        params[f"ar_{i}"] = book["name_ar"]

    session.execute(
        text(f"""INSERT INTO hadith_books (collection_id, book_number, name_eng, name_ar)
                 VALUES {values}
                 ON CONFLICT (collection_id, book_number) DO UPDATE SET
                     name_eng = EXCLUDED.name_eng,
                     name_ar = EXCLUDED.name_ar"""),
        params,
    )


def _insert_hadith_batch(session: Session, batch: list[dict]) -> None:
    values = ", ".join(f"(:cid_{i}, :chid_{i}, :num_{i}, :ar_{i}, :tr_{i})" for i in range(len(batch)))
    params = {}
    for i, h in enumerate(batch):
        params[f"cid_{i}"] = h["collection_id"]
        params[f"chid_{i}"] = h["chapter_id"]
        params[f"num_{i}"] = h["hadith_number"]
        params[f"ar_{i}"] = h["text_arabic"]
        params[f"tr_{i}"] = h["text_translation"]

    session.execute(
        text(f"""INSERT INTO hadith (collection_id, chapter_id, hadith_number, text_arabic, text_translation)
                 VALUES {values}
                 ON CONFLICT (collection_id, hadith_number) DO UPDATE SET
                     text_arabic = EXCLUDED.text_arabic,
                     text_translation = EXCLUDED.text_translation"""),
        params,
    )


# ── Main ──────────────────────────────────────────────────────────────


def main():
    if len(sys.argv) < 2:
        print("Usage: python ingest.py [quran|hadith|all]")
        print("  quran   — Ingest Quran only")
        print("  hadith  — Ingest Hadith only (all books)")
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

    if "quran" in total:
        q = total["quran"]
        print(f"Quran: {q['surahs']} surahs, {q['verses']} verses")
    if "hadith" in total:
        for slug, stats in total["hadith"].items():
            print(f"  {slug}: {stats.get('hadith', 0)} hadith")


if __name__ == "__main__":
    main()
