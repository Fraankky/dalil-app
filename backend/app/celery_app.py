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
)
