import os
import shutil
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import close_all_sessions

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
    close_all_sessions()
    engine.dispose()
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except PermissionError:
            try:
                Base.metadata.drop_all(bind=engine, checkfirst=True)
            except OperationalError:
                # SQLite on Windows can keep a transient file handle during fixture churn.
                # If the file is already half-reset, creating the schema fresh below is enough.
                pass
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client
