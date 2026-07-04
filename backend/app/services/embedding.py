"""Embedding service using multilingual-e5 model."""

import asyncio
import hashlib
from concurrent.futures import ThreadPoolExecutor
from functools import partial

import numpy as np
from sentence_transformers import SentenceTransformer

from app.core.config import settings

_model: SentenceTransformer | None = None


def _load_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(settings.embedding_model)
    return _model


def get_model() -> SentenceTransformer:
    return _load_model()


def embed_query(text: str) -> np.ndarray:
    """Generate embedding for a search query. E5 expects 'query: ' prefix."""
    model = get_model()
    embedding = model.encode(f"query: {text}", normalize_embeddings=True)
    return embedding


def embed_documents(texts: list[str], batch_size: int | None = None) -> np.ndarray:
    """Generate embeddings for documents. E5 expects 'passage: ' prefix."""
    model = get_model()
    bs = batch_size or settings.embedding_batch_size
    prefixed = [f"passage: {t}" for t in texts]
    embeddings = model.encode(prefixed, batch_size=bs, normalize_embeddings=True)
    return embeddings


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


_executor = ThreadPoolExecutor(max_workers=1)


async def embed_query_async(text: str) -> np.ndarray:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, embed_query, text)


async def embed_documents_async(texts: list[str], batch_size: int | None = None) -> np.ndarray:
    loop = asyncio.get_event_loop()
    fn = partial(embed_documents, texts, batch_size=batch_size)
    return await loop.run_in_executor(_executor, fn)
