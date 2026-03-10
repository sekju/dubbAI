from app.core.celery_app import celery_app


@celery_app.task(name="app.tasks.ingest.ingest_source")
def ingest_source(project_id: str, source_type: str) -> dict[str, str]:
    return {"project_id": project_id, "source_type": source_type, "status": "ingested"}
