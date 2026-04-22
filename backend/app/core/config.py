#backend\app\core\config.py

from functools import lru_cache
from dotenv import load_dotenv
import os

from app.core.settings import Settings 

load_dotenv()

GEMINI_API_KEYS = [
    os.getenv("GEMINI_KEY_1"),
    os.getenv("GEMINI_KEY_2"),
    os.getenv("GEMINI_KEY_3"),
    os.getenv("GEMINI_KEY_4"),
    os.getenv("GEMINI_KEY_5"),
]

GEMINI_API_KEYS = [k for k in GEMINI_API_KEYS if k]


def get_settings() -> Settings:
    return Settings()      # Arguments missing for parameters "supabase_url", "supabase_service_role_key", "openrouter_api_key", "supabase_jwt_secret"


settings = lru_cache()(get_settings)