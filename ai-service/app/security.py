"""The service is called only by the Node backend, never by browsers.

Every /v1 route needs the shared secret in the X-Internal-Key header.

The check runs as ASGI middleware, BEFORE FastAPI reads the request body.
(A route dependency would run only after FastAPI had already read and
parsed the body, so anyone could make the service parse huge JSON.) The
same middleware caps the body size.
"""

import hmac
import json

from starlette.types import ASGIApp, Receive, Scope, Send

# The largest valid request: a 50,000-character lesson (up to 3 bytes per
# character in UTF-8, more when JSON-escaped) plus a few short fields.
MAX_BODY_BYTES = 400_000


def key_matches(given: str, expected: str) -> bool:
    # compare_digest takes the same time whether the first or the last
    # character is wrong, so the secret can't be guessed by timing responses.
    return hmac.compare_digest(given.encode(), expected.encode())


async def _reply(send: Send, status: int, detail: str) -> None:
    body = json.dumps({"detail": detail}).encode()
    await send({"type": "http.response.start", "status": status, "headers": [(b"content-type", b"application/json")]})
    await send({"type": "http.response.body", "body": body})


class InternalOnly:
    """Guards everything under /v1: the secret first, then the body size."""

    def __init__(self, app: ASGIApp, secret: str) -> None:
        self.app = app
        self.secret = secret

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not scope["path"].startswith("/v1"):
            await self.app(scope, receive, send)
            return

        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]}
        if not key_matches(headers.get("x-internal-key", ""), self.secret):
            await _reply(send, 401, "Unauthorized")
            return

        # The body size must be announced (the backend always does) and the
        # server reads no more than announced, so this check is enough.
        # GET requests have no body.
        length = headers.get("content-length")
        if scope["method"] != "GET":
            if length is None or not length.isdigit():
                await _reply(send, 411, "Content-Length required")
                return
            if int(length) > MAX_BODY_BYTES:
                await _reply(send, 413, "Request too large")
                return

        await self.app(scope, receive, send)
