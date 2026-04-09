from functools import lru_cache

from app.core.settings import Settings


def get_settings() -> Settings:
    return Settings()


settings = lru_cache()(get_settings)
