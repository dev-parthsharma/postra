#backend\app\core\config.py

from functools import lru_cache

from app.core.settings import Settings


def get_settings() -> Settings:
    return Settings()      # Arguments missing for parameters "supabase_url", "supabase_service_role_key", "openrouter_api_key", "supabase_jwt_secret"


settings = lru_cache()(get_settings)