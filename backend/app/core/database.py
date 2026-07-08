# ponytail: two engines — async (asyncpg) here uses connect_args["ssl"];
# sync (psycopg2) in app/tasks/embeddings.py uses URL ?sslmode=require. Keep separate.
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

connect_args: dict[str, Any] = {
    "server_settings": {
        "statement_timeout": "10000",
        "idle_in_transaction_session_timeout": "30000",
    }
}

if settings.is_prod:
    connect_args["ssl"] = True

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args=connect_args,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession]:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
