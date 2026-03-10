from app.core.celery_app import celery_app


@celery_app.task(name="app.tasks.render.render_project")
def render_project(project_id: str) -> dict[str, str]:
    return {"project_id": project_id, "status": "rendered"}
