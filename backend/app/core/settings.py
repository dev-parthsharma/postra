# backend/app/core/settings.py

from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: Optional[str] = None

    # Legacy single key — kept optional so existing .env files don't break.
    # The active pool is now GROQ_API_KEY_1 / _2 / _3 read via config.py.
    groq_api_key: Optional[str] = None

    supabase_jwt_secret: str

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()