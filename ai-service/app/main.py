"""AdaptiveLearn AI service.

Run locally (inside the virtual environment, from the ai-service folder):
    uvicorn app.main:app --reload --port 8000
"""

from fastapi import APIRouter, Depends, FastAPI

from app.config import load_settings
from app.providers import get_provider
from app.security import require_internal_key

settings = load_settings()

app = FastAPI(
    title="AdaptiveLearn AI service",
    # The interactive API docs are handy while developing, but in production
    # they would show anyone the list of endpoints, so they are switched off.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)
app.state.settings = settings
app.state.provider = get_provider(settings)


# Public, and says nothing about the setup: Render calls it to check the
# service is up, and the backend calls it to wake the service from sleep.
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# Everything under /v1 needs the shared secret: the check is attached to the
# router once, so a new route can't forget it.
v1 = APIRouter(prefix="/v1", dependencies=[Depends(require_internal_key)])


@v1.get("/status")
def ai_status() -> dict[str, str]:
    provider = app.state.provider
    return {"provider": provider.name, "model": provider.model}


app.include_router(v1)
