"""Increase model_version column width to accommodate model names like intfloat/multilingual-e5-large-instruct

Revision ID: 0003
Revises: be79b21cfad0
Create Date: 2026-07-03
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "be79b21cfad0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("embeddings", "model_version", type_=sa.String(100))


def downgrade() -> None:
    op.alter_column("embeddings", "model_version", type_=sa.String(30))
