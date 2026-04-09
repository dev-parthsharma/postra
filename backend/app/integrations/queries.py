from app.integrations.supabase_client import supabase_client


def fetch_user_count() -> int:
    response = supabase_client.get("/auth/v1/admin/users", params={"limit": 1})
    response.raise_for_status()
    users = response.json()
    return len(users)
