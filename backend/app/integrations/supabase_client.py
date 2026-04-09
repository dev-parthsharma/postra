from httpx import Client

from app.core.settings import settings


supabase_client = Client(
    base_url=settings.supabase_url,
    headers={
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    },
    timeout=10.0,
)
