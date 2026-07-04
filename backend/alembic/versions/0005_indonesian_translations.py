"""Rename hadith.text_english→text_translation, update collection slugs

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-04
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("hadith", "text_english", new_column_name="text_translation")
    op.execute("DELETE FROM hadith")  # Remove old EN data
    op.execute("DELETE FROM hadith_books")
    op.execute("DELETE FROM hadith_collections")
    op.execute("DELETE FROM embeddings")
    op.execute("DELETE FROM verses")
    op.execute("DELETE FROM surahs")


def downgrade() -> None:
    op.alter_column("hadith", "text_translation", new_column_name="text_english")
