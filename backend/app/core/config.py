from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/dalil"
    database_url_sync: str = "postgresql://postgres:postgres@localhost:5432/dalil"
    db_pool_size: int = 10
    db_max_overflow: int = 20

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Embedding
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    embedding_dim: int = 384
    embedding_batch_size: int = 32

    # Celery
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # App
    env: str = "development"
    debug: bool = False
    cors_origins: str = "http://localhost:3000"
    api_prefix: str = "/api/v1"
    search_default_limit: int = 10
    search_max_limit: int = 50
    search_min_score: float = 0.3

    model_config = {"env_file": ".env", "extra": "forbid"}

    @model_validator(mode="after")
    def _validate_debug_in_prod(self) -> "Settings":
        if self.debug and self.env == "production":
            raise ValueError("DEBUG=true not allowed when ENV=production")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_prod(self) -> bool:
        return self.env == "production"


settings = Settings()
