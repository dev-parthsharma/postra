# backend/app/integrations/queries.py
# Supabase DB queries for the New Post feature.
# All functions receive a Supabase client and typed arguments.
# They raise on error so the service layer decides what HTTP status to return.

from typing import Optional
from postgrest.exceptions import APIError
from app.integrations.supabase_client import get_supabase_client, get_http_client

# supabase = get_supabase_client()

def fetch_user_count() -> int:
    response = get_http_client().get("/auth/v1/admin/users", params={"limit": 1})
    response.raise_for_status()
    users = response.json()
    return len(users)

# ── Ideas ─────────────────────────────────────────────────────────────────────

def insert_ideas(supabase, user_id: str, ideas: list[str], source: str) -> list[dict]:
    """
    Bulk-insert rows into `ideas`. Returns inserted rows.
    source must be 'user' or 'postra'.
    """
    rows = [
        {
            "user_id": user_id,
            "idea": idea.strip(),
            "source": source,
            "is_favourite": False,
        }
        for idea in ideas
    ]
    response = supabase.table("ideas").insert(rows).execute()
    if not response.data:
        raise RuntimeError("Failed to insert ideas")
    return response.data


def toggle_favourite(supabase, idea_id: str, user_id: str, is_favourite: bool) -> dict:
    """
    Flip is_favourite on a single idea.
    user_id guard prevents one user from updating another's ideas.
    """
    response = (
        supabase.table("ideas")
        .update({"is_favourite": is_favourite})
        .eq("id", idea_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not response.data:
        raise RuntimeError("Idea not found or not owned by user")
    return response.data[0]


'''def get_ideas_for_user(supabase, user_id: str) -> list[dict]:
    """
    Fetch all ideas for a user, highlighted ones first.
    Highlighted = source='user' OR is_favourite=true.
    """
    response = (
        supabase.table("ideas")
        .select("*")
        .eq("user_id", user_id)
        .order("is_favourite", desc=True)   # favourites float up
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []'''


# ── Chats ─────────────────────────────────────────────────────────────────────

def create_chat(supabase, user_id: str, idea_id: str, title: str) -> dict:
    """
    Create a new chat row linked to an idea.
    title is the first line of the idea text (trimmed).
    """
    response = (
        supabase.table("chats")
        .insert({
            "user_id": user_id,
            "idea_id": idea_id,
            "title": title[:200],  # hard cap to prevent absurd titles
        })
        .execute()
    )
    if not response.data:
        raise RuntimeError("Failed to create chat")
    return response.data[0]


def get_chats_for_user(supabase, user_id: str) -> list[dict]:
    response = (
        supabase.table("chats")
        .select("*, ideas(idea)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


# ── User profile (already exists, just adding getter) ─────────────────────────

def get_user_profile(supabase, user_id: str) -> Optional[dict]:
    response = (
        supabase.table("user_profile")
        .select("niche, tone, style, goal")
        .eq("id", user_id)
        .single()
        .execute()
    )
    return response.data  # None if not found

def delete_idea(supabase, idea_id: str, user_id: str) -> None:
    """Delete a user-written idea. Only allows deleting own ideas."""
    response = (
        supabase.table("ideas")
        .delete()
        .eq("id", idea_id)
        .eq("user_id", user_id)
        .eq("source", "user")  # safety: only user-written ideas
        .execute()
    )
    if not response.data:
        raise RuntimeError("Idea not found or not deletable")

def get_ideas_with_chat_status(supabase, user_id: str) -> list[dict]:
    """
    Fetch all ideas for a user, with in_progress flag.
    in_progress = a chat exists for this idea but no uploaded post yet.
    """
    response = (
        supabase.table("ideas")
        .select("*, chats(id)")
        .eq("user_id", user_id)
        .order("is_favourite", desc=True)
        .order("created_at", desc=True)
        .execute()
    )
    ideas = response.data or []
    # Add in_progress flag
    for idea in ideas:
        idea["in_progress"] = len(idea.get("chats", [])) > 0
        idea.pop("chats", None)  # clean up nested data
    return ideas