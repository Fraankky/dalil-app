from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/dalil"
    database_url_sync: str = "postgresql://postgres:postgres@localhost:5432/dalil"

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
    debug: bool = True
    cors_origins: str = "http://localhost:3000"
    api_prefix: str = "/api/v1"
    search_default_limit: int = 10
    search_max_limit: int = 50
    search_min_score: float = 0.3

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
