from fastapi import APIRouter

from app.api.routes import auth, exports, health, jobs, library, media, projects

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(library.router, prefix="/library", tags=["library"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(exports.router, prefix="/exports", tags=["exports"])
api_router.include_router(media.router)
