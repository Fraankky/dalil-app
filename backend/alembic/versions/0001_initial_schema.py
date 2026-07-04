"""Initial schema: surahs, verses, hadith_collections, hadith_books, hadith, embeddings

Revision ID: 0001
Revises:
Create Date: 2026-06-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "surahs",
        sa.Column("id", sa.SmallInteger(), primary_key=True),
        sa.Column("name_arabic", sa.Text(), nullable=False),
        sa.Column("name_english", sa.Text(), nullable=False),
        sa.Column("revelation_type", sa.String(6), nullable=False),
        sa.Column("verses_count", sa.SmallInteger(), nullable=False),
    )

    op.create_table(
        "verses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("surah_id", sa.SmallInteger(), sa.ForeignKey("surahs.id"), nullable=False),
        sa.Column("verse_number", sa.SmallInteger(), nullable=False),
        sa.Column("text_arabic", sa.Text(), nullable=False),
        sa.Column("text_translation", sa.Text(), nullable=True),
        sa.Column("juz", sa.SmallInteger(), nullable=True),
        sa.Column("page", sa.SmallInteger(), nullable=True),
        sa.UniqueConstraint("surah_id", "verse_number"),
    )

    op.create_table(
        "hadith_collections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name_eng", sa.Text(), nullable=False),
        sa.Column("name_ar", sa.Text(), nullable=False),
        sa.Column("slug", sa.String(50), unique=True, nullable=False),
    )

    op.create_table(
        "hadith_books",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "collection_id", sa.Integer(), sa.ForeignKey("hadith_collections.id"), nullable=False
        ),  # noqa: E501
        sa.Column("name_eng", sa.Text(), nullable=False),
        sa.Column("name_ar", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "hadith",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "collection_id", sa.Integer(), sa.ForeignKey("hadith_collections.id"), nullable=False
        ),  # noqa: E501
        sa.Column("chapter_id", sa.Integer(), nullable=True),
        sa.Column("hadith_number", sa.Text(), nullable=False),
        sa.Column("chapter_name_eng", sa.Text(), nullable=True),
        sa.Column("chapter_name_ar", sa.Text(), nullable=True),
        sa.Column("text_arabic", sa.Text(), nullable=False),
        sa.Column("text_english", sa.Text(), nullable=True),
        sa.Column("grade", sa.String(30), nullable=True),
        sa.Column("narrator_chain", sa.Text(), nullable=True),
        sa.UniqueConstraint("collection_id", "hadith_number"),
    )

    op.create_table(
        "embeddings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_type", sa.String(10), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("embedding", Vector(1024), nullable=False),
        sa.Column("text_hash", sa.String(64), nullable=True),
        sa.Column("model_version", sa.String(30), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index("idx_embeddings_source", "embeddings", ["source_type", "source_id"])
    op.execute(
        "CREATE INDEX idx_embeddings_hnsw ON embeddings "
        "USING hnsw (embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 200)"
    )


def downgrade() -> None:
    op.drop_table("embeddings")
    op.drop_table("hadith")
    op.drop_table("hadith_books")
    op.drop_table("hadith_collections")
    op.drop_table("verses")
    op.drop_table("surahs")
