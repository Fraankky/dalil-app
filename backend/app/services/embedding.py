"""Embedding service using SentenceTransformer models."""

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


def _needs_prefix() -> bool:
    return "e5" in settings.embedding_model.lower()


def embed_query(text: str) -> np.ndarray:
    model = get_model()
    prefixed = f"query: {text}" if _needs_prefix() else text
    return np.asarray(model.encode(prefixed, normalize_embeddings=True))


def embed_documents(texts: list[str], batch_size: int | None = None) -> np.ndarray:
    model = get_model()
    bs = batch_size or settings.embedding_batch_size
    prefixed = [f"passage: {t}" if _needs_prefix() else t for t in texts]
    return np.asarray(model.encode(prefixed, batch_size=bs, normalize_embeddings=True))


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
