"""Revert embedding column from vector(1024) to vector(384) for MiniLM

Revision ID: 0007
Revises: 0006
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_embeddings_hnsw")
    op.execute("DELETE FROM embeddings")
    op.execute("ALTER TABLE embeddings ALTER COLUMN embedding TYPE vector(384) USING embedding::vector(384)")
    op.execute(
        "CREATE INDEX idx_embeddings_hnsw ON embeddings "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_embeddings_hnsw")
    op.execute("ALTER TABLE embeddings ALTER COLUMN embedding TYPE vector(1024) USING embedding::vector(1024)")
    op.execute(
        "CREATE INDEX idx_embeddings_hnsw ON embeddings "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200)"
    )