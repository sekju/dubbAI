from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "dubbai",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks.ingest", "app.tasks.ai", "app.tasks.render"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    timezone="UTC",
    worker_prefetch_multiplier=1,
    task_routes={
        "app.tasks.ingest.*": {"queue": "ingest"},
        "app.tasks.ai.*": {"queue": "ai"},
        "app.tasks.render.*": {"queue": "render"},
    },
)
