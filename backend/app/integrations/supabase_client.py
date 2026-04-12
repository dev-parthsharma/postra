from httpx import Client
from supabase import create_client
from app.core.settings import settings

def get_supabase_client():
    """Supabase SDK client — for DB operations (.table(), .select(), etc.)"""
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key
    )

def get_http_client():
    """Raw httpx client — for direct auth API calls"""
    return Client(
        base_url=settings.supabase_url,
        headers={
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        },
        timeout=10.0,
    )