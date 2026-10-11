"""A stand-in model: no API key, no cost, same answer every time.

Lets the whole feature be built and tested before a real model is chosen.
The answers are labelled as samples so nobody mistakes them for real AI.
"""


class MockProvider:
    name = "mock"
    model = "mock-1"

    async def complete(self, *, system: str, prompt: str, max_tokens: int) -> str:
        first_line = prompt.strip().splitlines()[0] if prompt.strip() else ""
        return f"[Sample AI answer] This is placeholder text for: {first_line[:120]}"
