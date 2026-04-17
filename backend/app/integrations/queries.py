# backend/app/integrations/queries.py
# Supabase DB queries.
# All functions receive a Supabase client and typed arguments.
# They raise on error so the service layer decides what HTTP status to return.

from typing import Optional
from postgrest.exceptions import APIError
from app.integrations.supabase_client import get_supabase_client, get_http_client


def fetch_user_count() -> int:
    response = get_http_client().get("/auth/v1/admin/users", params={"limit": 1})
    response.raise_for_status()
    users = response.json()
    return len(users)


# ── Ideas ─────────────────────────────────────────────────────────────────────

def insert_ideas(supabase, user_id: str, ideas: list[str], source: str) -> list[dict]:
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


def get_ideas_with_chat_status(supabase, user_id: str) -> list[dict]:
    response = (
        supabase.table("ideas")
        .select("*, chats(id)")
        .eq("user_id", user_id)
        .order("is_favourite", desc=True)
        .order("created_at", desc=True)
        .execute()
    )

    ideas = response.data or []

    for idea in ideas:
        chat = idea.get("chats")

        # normalize
        if isinstance(chat, list):
            chat = chat[0] if chat else None

        idea["in_progress"] = 1 if chat else 0
        idea["chat_id"] = chat.get("id") if chat else None

        idea.pop("chats", None)

    return ideas


# ── Chats ─────────────────────────────────────────────────────────────────────

def create_chat(supabase, user_id: str, idea_id: str, title: str) -> dict:
    response = (
        supabase.table("chats")
        .insert({
            "user_id": user_id,
            "idea_id": idea_id,
            "title": title[:200],
        })
        .execute()
    )
    if not response.data:
        raise RuntimeError("Failed to create chat")
    return response.data[0]


def get_chat_by_id(supabase, chat_id: str, user_id: str) -> Optional[dict]:
    response = (
        supabase.table("chats")
        .select("*")
        .eq("id", chat_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    return response.data


def get_chats_for_user(supabase, user_id: str) -> list[dict]:
    response = (
        supabase.table("chats")
        .select("*, ideas(idea)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


# ── Messages ──────────────────────────────────────────────────────────────────

def get_messages_for_chat(supabase, chat_id: str) -> list[dict]:
    response = (
        supabase.table("messages")
        .select("*")
        .eq("chat_id", chat_id)
        .order("sequence", desc=False)
        .execute()
    )
    return response.data or []


def get_next_sequence(supabase, chat_id: str) -> int:
    response = (
        supabase.table("messages")
        .select("sequence")
        .eq("chat_id", chat_id)
        .order("sequence", desc=True)
        .limit(1)
        .execute()
    )
    if response.data:
        return response.data[0]["sequence"] + 1
    return 1


def insert_message(
    supabase,
    chat_id: str,
    sequence: int,
    content: str,
    source: str,
    msg_type: str,
    metadata: Optional[dict] = None,
) -> dict:
    response = (
        supabase.table("messages")
        .insert({
            "chat_id":  chat_id,
            "sequence": sequence,
            "content":  content,
            "source":   source,
            "type":     msg_type,
            "metadata": metadata,
        })
        .execute()
    )
    if not response.data:
        raise RuntimeError("Failed to insert message")
    return response.data[0]


# ── Posts ─────────────────────────────────────────────────────────────────────

def upsert_post(supabase, user_id: str, chat_id: str, idea_id: str, **fields) -> dict:
    existing = (
        supabase.table("posts")
        .select("id")
        .eq("chat_id", chat_id)
        .execute()
    )

    row = {"user_id": user_id, "chat_id": chat_id,"idea_id": idea_id, **fields}

    if existing.data:
        post_id = existing.data[0]["id"]
        response = (
            supabase.table("posts")
            .update(row)
            .eq("id", post_id)
            .execute()
        )
    else:
        response = supabase.table("posts").insert(row).execute()

    if not response.data:
        raise RuntimeError("Failed to upsert post")
    return response.data[0]


def get_post_for_chat(supabase, chat_id: str) -> Optional[dict]:
    response = (
        supabase.table("posts")
        .select("*")
        .eq("chat_id", chat_id)
        .execute()
    )
    return response.data[0] if response.data else None


# ── User profile ──────────────────────────────────────────────────────────────

def get_user_profile(supabase, user_id: str) -> Optional[dict]:
    response = (
        supabase.table("user_profile")
        .select("niche, tone, style, goal")
        .eq("id", user_id)
        .single()
        .execute()
    )
    return response.data


# ── Utility ───────────────────────────────────────────────────────────────────

def delete_idea(supabase, idea_id: str, user_id: str) -> None:
    response = (
        supabase.table("ideas")
        .delete()
        .eq("id", idea_id)
        .eq("user_id", user_id)
        .eq("source", "user")
        .execute()
    )
    if not response.data:
        raise RuntimeError("Idea not found or not deletable")