import hashlib
import json

import redis as redis_lib

from app.core.config import settings

_client = None


def get_client():
    global _client
    if _client is None:
        _client = redis_lib.from_url(settings.redis_url)
    return _client


def cache_key(model_name: str, query: str) -> str:
    return f"embed:{model_name}:{hashlib.sha256(query.encode()).hexdigest()}"


def get_cached_embedding(query: str) -> list[float] | None:
    key = cache_key(settings.embedding_model, query)
    val = get_client().get(key)
    if val:
        return json.loads(val)
    return None


def set_cached_embedding(query: str, embedding: list[float]) -> None:
    key = cache_key(settings.embedding_model, query)
    get_client().setex(key, 3600, json.dumps(embedding))