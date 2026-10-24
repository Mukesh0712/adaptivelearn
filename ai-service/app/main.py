"""AdaptiveLearn AI service.

Run locally (inside the virtual environment, from the ai-service folder):
    uvicorn app.main:app --reload --port 8000
"""

import logging

from fastapi import APIRouter, Depends, FastAPI, HTTPException

from app.config import load_settings
from app.providers import get_provider
from app.providers.base import AIProvider
from app.security import require_internal_key
from app.tasks import chat, instructor
from app.tasks.feedback import MAX_TOKENS, SYSTEM, FeedbackRequest, FeedbackResponse, build_prompt, clean_output

log = logging.getLogger("ai-service")
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


@v1.post("/feedback")
async def feedback(req: FeedbackRequest) -> FeedbackResponse:
    provider = app.state.provider
    text = await ask(provider, system=SYSTEM, prompt=build_prompt(req), max_tokens=MAX_TOKENS)
    return FeedbackResponse(feedback=clean_output(text), model=provider.model)


@v1.post("/summary")
async def summary(req: instructor.SummaryRequest) -> instructor.SummaryResponse:
    provider = app.state.provider
    text = await ask(
        provider, system=instructor.SUMMARY_SYSTEM, prompt=instructor.summary_prompt(req), max_tokens=instructor.SUMMARY_TOKENS
    )
    return instructor.SummaryResponse(summary=clean_output(text), model=provider.model)


@v1.post("/questions")
async def questions(req: instructor.QuestionsRequest) -> instructor.QuestionsResponse:
    provider = app.state.provider
    text = await ask(
        provider,
        system=instructor.QUESTIONS_SYSTEM,
        prompt=instructor.questions_prompt(req),
        max_tokens=instructor.QUESTIONS_TOKENS,
        json_schema=instructor.GeneratedQuestions.model_json_schema(),
    )
    try:
        kept, dropped = instructor.parse_questions(text, req)
    except ValueError:
        log.warning("AI provider %s did not return question JSON", provider.name)
        raise HTTPException(status_code=502, detail="The AI provider gave an unusable answer") from None
    if not kept:
        raise HTTPException(status_code=502, detail="The AI provider gave no usable questions")
    return instructor.QuestionsResponse(questions=kept, dropped=dropped, model=provider.model)


@v1.post("/chat")
async def chat_answer(req: chat.ChatRequest) -> chat.ChatResponse:
    provider = app.state.provider
    text = await ask(provider, system=chat.SYSTEM, prompt=chat.build_prompt(req), max_tokens=chat.MAX_TOKENS)
    return chat.ChatResponse(answer=clean_output(text), model=provider.model)


async def ask(provider: AIProvider, *, system: str, prompt: str, max_tokens: int, json_schema: dict | None = None) -> str:
    """One model call. Provider failures become a plain 502 for the backend;
    the details are logged here and never sent back."""
    try:
        text = await provider.complete(system=system, prompt=prompt, max_tokens=max_tokens, json_schema=json_schema)
    except Exception:
        log.exception("AI provider %s failed", provider.name)
        raise HTTPException(status_code=502, detail="The AI provider failed") from None
    if not text.strip():
        raise HTTPException(status_code=502, detail="The AI provider gave an empty answer")
    return text


app.include_router(v1)
