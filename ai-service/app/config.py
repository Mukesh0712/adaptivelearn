"""Settings read from environment variables (or a local .env file).

Checked once at startup, like backend/src/config/env.ts: a missing or too
short secret stops the service immediately with a clear message, instead of
running unprotected.
"""

import os
import sys
from dataclasses import dataclass

from dotenv import load_dotenv

# Reads ai-service/.env when it exists (local development). On Render the
# variables come from the dashboard and there is no .env file.
load_dotenv()

PROVIDERS = ("mock",)
MIN_SECRET_LENGTH = 32


@dataclass(frozen=True)
class Settings:
    app_env: str
    service_secret: str
    provider: str

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


def load_settings() -> Settings:
    errors: list[str] = []

    app_env = os.getenv("APP_ENV", "development").strip()
    if app_env not in ("development", "production", "test"):
        errors.append("APP_ENV must be development, production or test")

    secret = os.getenv("AI_SERVICE_SECRET", "").strip()
    if len(secret) < MIN_SECRET_LENGTH:
        errors.append(f"AI_SERVICE_SECRET is required and must be at least {MIN_SECRET_LENGTH} characters")

    provider = os.getenv("AI_PROVIDER", "mock").strip().lower()
    if provider not in PROVIDERS:
        errors.append(f"AI_PROVIDER must be one of: {', '.join(PROVIDERS)}")

    if errors:
        print("Invalid environment configuration:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    return Settings(app_env=app_env, service_secret=secret, provider=provider)
