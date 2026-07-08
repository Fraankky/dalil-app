from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "dalil",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.embeddings"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_time_limit=300,
    task_soft_time_limit=240,
    worker_max_tasks_per_child=100,
    task_acks_late=True,
    result_expires=3600,
    worker_prefetch_multiplier=1,
)
