"""Evaluate semantic search results against a small ground-truth set."""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

GROUND_TRUTH_PATH = Path(__file__).with_name("ground_truth.json")


def normalize_result_id(result: dict[str, Any]) -> str:
    if result["type"] == "quran":
        return f"quran:{result['surah_number']}:{result['verse_number']}"
    return f"hadith:{result['collection_slug']}:{result['hadith_number']}"


def recall_at_k(returned: list[str], relevant: set[str], k: int) -> float:
    if not relevant:
        return 0.0
    return len(set(returned[:k]) & relevant) / len(relevant)


def mrr_at_k(returned: list[str], relevant: set[str], k: int) -> float:
    for index, result_id in enumerate(returned[:k], start=1):
        if result_id in relevant:
            return 1 / index
    return 0.0


def load_ground_truth(path: Path = GROUND_TRUTH_PATH) -> list[dict[str, Any]]:
    with path.open() as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("Ground truth must be a list of query objects")
    return data


async def evaluate(k: int, path: Path = GROUND_TRUTH_PATH) -> int:
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.services.search import semantic_search

    database_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/dalil",
    )
    engine = create_async_engine(database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    ground_truth = load_ground_truth(path)
    recalls = []
    mrrs = []

    async with session_factory() as session:
        for item in ground_truth:
            relevant = set(item["relevant"])
            response = await semantic_search(session, item["query"], limit=k, min_score=0)
            returned = [normalize_result_id(result.model_dump()) for result in response.results]
            recall = recall_at_k(returned, relevant, k)
            mrr = mrr_at_k(returned, relevant, k)
            recalls.append(recall)
            mrrs.append(mrr)
            status = "hit" if recall > 0 else "miss"
            print(f"{status:4s} recall@{k}={recall:.3f} mrr@{k}={mrr:.3f} query={item['query']}")

    await engine.dispose()
    mean_recall = sum(recalls) / len(recalls) if recalls else 0.0
    mean_mrr = sum(mrrs) / len(mrrs) if mrrs else 0.0
    print(f"\nRecall@{k}: {mean_recall:.3f}")
    print(f"MRR@{k}: {mean_mrr:.3f}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate semantic search quality")
    parser.add_argument("--k", type=int, default=10)
    parser.add_argument("--ground-truth", type=Path, default=GROUND_TRUTH_PATH)
    args = parser.parse_args()
    raise SystemExit(asyncio.run(evaluate(k=args.k, path=args.ground_truth)))


if __name__ == "__main__":
    main()
