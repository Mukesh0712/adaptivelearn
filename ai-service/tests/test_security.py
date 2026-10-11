"""Run from the ai-service folder:  python -m pytest"""

import os

os.environ["APP_ENV"] = "test"
os.environ["AI_SERVICE_SECRET"] = "t" * 40
os.environ["AI_PROVIDER"] = "mock"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)
KEY = {"X-Internal-Key": "t" * 40}


def test_health_is_public_and_reveals_nothing():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_status_needs_the_key():
    assert client.get("/v1/status").status_code == 401


def test_status_rejects_a_wrong_key():
    for bad in ("wrong", "t" * 39, "t" * 41, "T" * 40):
        assert client.get("/v1/status", headers={"X-Internal-Key": bad}).status_code == 401


def test_status_with_the_key():
    res = client.get("/v1/status", headers=KEY)
    assert res.status_code == 200
    assert res.json() == {"provider": "mock", "model": "mock-1"}


def test_unknown_paths_are_404():
    assert client.get("/v1/nothing", headers=KEY).status_code == 404
