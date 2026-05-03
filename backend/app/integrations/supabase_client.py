from httpx import Client
from supabase import create_client
from app.core.settings import settings

supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)

def get_supabase_client():
    return supabase


def get_http_client():
    """Raw httpx client — for direct auth API calls"""
    return Client(
        base_url=settings.supabase_url,
        headers={
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        },
        timeout=30.0,
    )