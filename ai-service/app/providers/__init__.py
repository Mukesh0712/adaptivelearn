from app.config import Settings
from app.providers.base import AIProvider
from app.providers.mock import MockProvider


def get_provider(settings: Settings) -> AIProvider:
    """Builds the provider named by AI_PROVIDER (already checked in config)."""
    if settings.provider == "mock":
        return MockProvider()
    raise ValueError(f"Unknown AI provider: {settings.provider}")
