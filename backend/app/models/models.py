from sqlalchemy import Column, Index, Integer, SmallInteger, String, Text, ForeignKey, UniqueConstraint, DateTime, func
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector

from app.core.database import Base


class Surah(Base):
    __tablename__ = "surahs"

    id = Column(SmallInteger, primary_key=True)
    name_arabic = Column(Text, nullable=False)
    name_english = Column(Text, nullable=False)
    revelation_type = Column(String(7), nullable=False)
    verses_count = Column(SmallInteger, nullable=False)

    verses = relationship("Verse", back_populates="surah")


class Verse(Base):
    __tablename__ = "verses"
    __table_args__ = (UniqueConstraint("surah_id", "verse_number"),)

    id = Column(Integer, primary_key=True)
    surah_id = Column(SmallInteger, ForeignKey("surahs.id"), nullable=False)
    verse_number = Column(SmallInteger, nullable=False)
    text_arabic = Column(Text, nullable=False)
    text_translation = Column(Text, nullable=True)
    juz = Column(SmallInteger, nullable=True)
    page = Column(SmallInteger, nullable=True)

    surah = relationship("Surah", back_populates="verses")
    embeddings = relationship("Embedding", back_populates="verse", foreign_keys="Embedding.source_id")


class HadithCollection(Base):
    __tablename__ = "hadith_collections"

    id = Column(Integer, primary_key=True)
    name_eng = Column(Text, nullable=False)
    name_ar = Column(Text, nullable=False)
    slug = Column(String(50), unique=True, nullable=False)

    books = relationship("HadithBook", back_populates="collection")
    hadith = relationship("Hadith", back_populates="collection", foreign_keys="Hadith.collection_id")


class HadithBook(Base):
    __tablename__ = "hadith_books"
    __table_args__ = (UniqueConstraint("collection_id", "book_number"),)

    id = Column(Integer, primary_key=True)
    collection_id = Column(Integer, ForeignKey("hadith_collections.id"), nullable=False)
    name_eng = Column(Text, nullable=False)
    name_ar = Column(Text, nullable=False)
    book_number = Column(SmallInteger, nullable=False)

    collection = relationship("HadithCollection", back_populates="books")
    hadith = relationship("Hadith", back_populates="book")


class Hadith(Base):
    __tablename__ = "hadith"
    __table_args__ = (UniqueConstraint("collection_id", "hadith_number"),)

    id = Column(Integer, primary_key=True)
    collection_id = Column(Integer, ForeignKey("hadith_collections.id"), nullable=False)
    chapter_id = Column(Integer, nullable=True)
    hadith_number = Column(Text, nullable=False)
    chapter_name_eng = Column(Text, nullable=True)
    chapter_name_ar = Column(Text, nullable=True)
    text_arabic = Column(Text, nullable=False)
    text_english = Column(Text, nullable=True)
    grade = Column(String(30), nullable=True)
    narrator_chain = Column(Text, nullable=True)

    collection = relationship("HadithCollection", back_populates="hadith", foreign_keys=[collection_id])
    book = relationship("HadithBook", back_populates="hadith",
                        primaryjoin="and_(foreign(Hadith.collection_id)==HadithBook.collection_id, "
                                     "foreign(Hadith.chapter_id)==HadithBook.book_number)",
                        viewonly=True)
    embeddings = relationship("Embedding", back_populates="hadith_entry", foreign_keys="Embedding.source_id")


class Embedding(Base):
    __tablename__ = "embeddings"
    __table_args__ = (
        UniqueConstraint("source_type", "source_id", "model_version"),
    )

    id = Column(Integer, primary_key=True)
    source_type = Column(String(10), nullable=False)
    source_id = Column(Integer, nullable=False)
    embedding = Column(Vector(1024), nullable=False)
    text_hash = Column(String(64), nullable=True)
    model_version = Column(String(30), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    verse = relationship("Verse", back_populates="embeddings",
                         primaryjoin="and_(Embedding.source_type=='quran', Embedding.source_id==foreign(Verse.id))",
                         viewonly=True)
    hadith_entry = relationship("Hadith", back_populates="embeddings",
                                primaryjoin="and_(Embedding.source_type=='hadith', Embedding.source_id==foreign(Hadith.id))",
                                viewonly=True)
