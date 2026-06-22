"""Unique constraint on embeddings(source_type, source_id, model_version)

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-22
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM embeddings
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM embeddings
            GROUP BY source_type, source_id, model_version
        )
        """
    )
    op.create_unique_constraint(
        "uq_embeddings_source_model",
        "embeddings",
        ["source_type", "source_id", "model_version"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_embeddings_source_model", "embeddings", type_="unique")
