from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: Optional[str] = None

    groq_api_key: str
    supabase_jwt_secret: str

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",           # ignore unknown env vars like OPENROUTER_API_KEY
    )


settings = Settings()