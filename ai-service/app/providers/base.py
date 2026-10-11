"""What every AI provider must offer.

The rest of the service only talks to this interface, so switching from the
mock to a real model (Claude, Gemini, a local model...) means adding one
provider file and changing AI_PROVIDER, nothing else.
"""

from typing import Protocol


class AIProvider(Protocol):
    # Short name shown to the admin, e.g. "mock".
    name: str
    # The model that answers, e.g. "mock-1".
    model: str

    async def complete(
        self, *, system: str, prompt: str, max_tokens: int, json_schema: dict | None = None
    ) -> str:
        """Send one request to the model and return its text answer.

        json_schema: when given, the answer must be JSON matching it. Real
        providers pass it to the model's "structured output" feature; the
        answer is still checked here afterwards, never trusted blindly.
        """
        ...
