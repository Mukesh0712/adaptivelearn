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


def test_too_large_body_is_refused():
    big = {"lesson": {"title": "t", "content": "x" * 50_000}, "question": "q" * 400_000}
    assert client.post("/v1/chat", json=big, headers=KEY).status_code == 413
    # Without the key it's 401 before the size even matters.
    assert client.post("/v1/chat", json=big).status_code == 401


def test_a_real_maximum_lesson_still_fits():
    # 50,000 characters of 3-byte UTF-8 text: the biggest lesson allowed.
    lesson = {"title": "t" * 150, "content": "क" * 50_000}
    res = client.post("/v1/summary", json={"lesson": lesson}, headers=KEY)
    assert res.status_code == 200


def _call_middleware(headers, method="POST"):
    """Runs the middleware alone with a receive() that must never be called."""
    import asyncio

    from app.security import InternalOnly

    sent = []

    async def app(scope, receive, send):  # the real app: would read the body
        await receive()

    async def receive():
        raise AssertionError("the body was read")

    async def send(message):
        sent.append(message)

    scope = {"type": "http", "path": "/v1/chat", "method": method, "headers": headers}
    asyncio.run(InternalOnly(app, "t" * 40)(scope, receive, send))
    return sent[0]["status"]


def test_rejections_happen_before_the_body_is_read():
    assert _call_middleware([(b"content-length", b"10000000")]) == 401  # no key
    assert _call_middleware([(b"x-internal-key", b"wrong"), (b"content-length", b"5")]) == 401
    key = (b"x-internal-key", ("t" * 40).encode())
    assert _call_middleware([key, (b"content-length", b"10000000")]) == 413
    assert _call_middleware([key, (b"transfer-encoding", b"chunked")]) == 411
