import os
import shutil
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
TEST_STORAGE_ROOT = REPO_ROOT / "storage" / "test-suite"
TEST_DB_PATH = TEST_STORAGE_ROOT / "dubbai-test.db"

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["UPLOAD_DIRECTORY"] = str((TEST_STORAGE_ROOT / "uploads").as_posix())
os.environ["OUTPUT_DIRECTORY"] = str((TEST_STORAGE_ROOT / "outputs").as_posix())
os.environ["FRONTEND_URL"] = "http://localhost:3002"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import get_settings

get_settings.cache_clear()

from app.db.base import Base
from app.db.session import engine
from app.main import app


@pytest.fixture(autouse=True)
def reset_database() -> None:
    TEST_STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    uploads_dir = TEST_STORAGE_ROOT / "uploads"
    outputs_dir = TEST_STORAGE_ROOT / "outputs"
    if uploads_dir.exists():
        shutil.rmtree(uploads_dir)
    if outputs_dir.exists():
        shutil.rmtree(outputs_dir)
    Base.metadata.drop_all(bind=engine, checkfirst=True)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
