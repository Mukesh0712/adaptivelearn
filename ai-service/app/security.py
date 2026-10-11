"""The service is called only by the Node backend, never by browsers.

Every /v1 route needs the shared secret in the X-Internal-Key header.
"""

import hmac

from fastapi import Header, HTTPException, Request, status


def require_internal_key(request: Request, x_internal_key: str = Header(default="")) -> None:
    expected: str = request.app.state.settings.service_secret
    # compare_digest takes the same time whether the first or the last
    # character is wrong, so the secret can't be guessed by timing responses.
    if not hmac.compare_digest(x_internal_key.encode(), expected.encode()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
