"""increase_revelation_type_length

Revision ID: be79b21cfad0
Revises: 0002
Create Date: 2026-06-22 21:48:08.621502
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "be79b21cfad0"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "surahs",
        "revelation_type",
        existing_type=sa.VARCHAR(length=6),
        type_=sa.String(length=7),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "surahs",
        "revelation_type",
        existing_type=sa.String(length=7),
        type_=sa.VARCHAR(length=6),
        existing_nullable=False,
    )
