# backend/app/core/config.py

from functools import lru_cache
from dotenv import load_dotenv
import os

from app.core.settings import Settings

load_dotenv()

# ── Gemini key pool (5 keys) ──────────────────────────────────────────────────
GEMINI_API_KEYS = [
    os.getenv("GEMINI_KEY_1"),
    os.getenv("GEMINI_KEY_2"),
    os.getenv("GEMINI_KEY_3"),
    os.getenv("GEMINI_KEY_4"),
    os.getenv("GEMINI_KEY_5"),
]
GEMINI_API_KEYS = [k for k in GEMINI_API_KEYS if k]

# ── Groq key pool (3 keys) ────────────────────────────────────────────────────
GROQ_API_KEYS = [
    os.getenv("GROQ_API_KEY_1"),
    os.getenv("GROQ_API_KEY_2"),
    os.getenv("GROQ_API_KEY_3"),
]
GROQ_API_KEYS = [k for k in GROQ_API_KEYS if k]


def get_settings() -> Settings:
    return Settings()


settings = lru_cache()(get_settings)