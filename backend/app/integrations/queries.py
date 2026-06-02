# backend/app/integrations/queries.py
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
    """
    V2: Fetches drafts and active statuses directly from the posts table.
    Bypasses chats and message history tables entirely.
    """
    response = (
        supabase.table("ideas")
        .select("*, posts(id, status)")
        .eq("user_id", user_id)
        # 🟢 V2: Removed is_favourite ordering, now ordered by scheduled_date & created_at
        .order("scheduled_date", desc=False, nullsfirst=False)
        .order("created_at", desc=True)
        .execute()
    )

    ideas = response.data or []

    for idea in ideas:
        posts = idea.get("posts")

        # normalize
        post_status = None
        post_id = None
        if isinstance(posts, list) and len(posts) > 0:
            post_status = posts[0].get("status")
            post_id = posts[0].get("id")
        elif isinstance(posts, dict):
            post_status = posts.get("status")
            post_id = posts.get("id")

        idea["in_progress"] = 1 if post_id else 0
        idea["post_id"] = post_id
        idea["chat_id"] = post_id  # Backwards compatibility for frontend
        idea["post_status"] = post_status 

        idea.pop("posts", None)

    return ideas


# ── Posts (Direct Creation & Management) ──────────────────────────────────────

def create_draft_post(supabase, user_id: str, idea_id: str, title: str) -> dict:
    """
    Creates a new draft directly inside the posts table.
    Replaces old create_chat logic entirely.
    """
    response = (
        supabase.table("posts")
        .insert({
            "user_id": user_id,
            "idea_id": idea_id,
            "status": "draft",
            "hook": title[:200],
            "script": "",
            "caption": ""
        })
        .execute()
    )
    if not response.data:
        raise RuntimeError("Failed to create draft post")
    return response.data[0]


def get_post_by_id(supabase, post_id: str, user_id: str) -> Optional[dict]:
    response = (
        supabase.table("posts")
        .select("*")
        .eq("id", post_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    return response.data or None


def get_drafts_for_user(supabase, user_id: str) -> list[dict]:
    """Fetches all raw drafts for the user from the posts table."""
    response = (
        supabase.table("posts")
        .select("*, ideas(idea)")
        .eq("user_id", user_id)
        .eq("status", "draft")
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


def upsert_post(supabase, user_id: str, idea_id: str, post_id: Optional[str] = None, **fields) -> dict:
    """
    Directly inserts or updates post drafts based on id or idea_id.
    Completely decoupled from any chat_id constraints.
    """
    if post_id:
        existing = supabase.table("posts").select("id, status").eq("id", post_id).execute()
    else:
        existing = supabase.table("posts").select("id, status").eq("idea_id", idea_id).execute()

    row = {"user_id": user_id, "idea_id": idea_id, **fields}

    if existing.data:
        if existing.data[0].get("status") == "published":
            return existing.data[0]
        
        pid = existing.data[0]["id"]
        response = (
            supabase.table("posts")
            .update(row)
            .eq("id", pid)
            .execute()
        )
    else:
        response = supabase.table("posts").insert(row).execute()

    if not response.data:
        raise RuntimeError("Failed to upsert post")
    return response.data[0]


# ── Plan / usage ──────────────────────────────────────────────────────────────

def get_user_plan_usage(supabase, user_id: str) -> Optional[dict]:
    response = (
        supabase.table("user_profile")
        .select("plan, ideas_used_today, last_reset_date")
        .eq("id", user_id)
        .single()
        .execute()
    )
    return response.data or None


def reset_daily_usage_if_needed(supabase, user_id: str, today: str) -> dict:
    response = (
        supabase.table("user_profile")
        .select("plan, ideas_used_today, last_reset_date")
        .eq("id", user_id)
        .single()
        .execute()
    )
    row = response.data
    if not row:
        raise RuntimeError("User profile not found")

    last_reset = row.get("last_reset_date")
    last_reset_str = str(last_reset) if last_reset else None

    if last_reset_str != today:
        supabase.table("user_profile").update(
            {"ideas_used_today": 0, "last_reset_date": today}
        ).eq("id", user_id).execute()
        return {
            "plan": row.get("plan") or "free",
            "ideas_used_today": 0,
            "last_reset_date": today,
        }

    return {
        "plan": row.get("plan") or "free",
        "ideas_used_today": row.get("ideas_used_today") or 0,
        "last_reset_date": last_reset_str,
    }


def increment_ideas_used_today(supabase, user_id: str) -> None:
    response = (
        supabase.table("user_profile")
        .select("ideas_used_today")
        .eq("id", user_id)
        .single()
        .execute()
    )
    current = (response.data or {}).get("ideas_used_today") or 0
    supabase.table("user_profile").update(
        {"ideas_used_today": current + 1}
    ).eq("id", user_id).execute()


# ── User profile ──────────────────────────────────────────────────────────────

def get_user_profile(supabase, user_id: str) -> Optional[dict]:
    response = (
        supabase.table("user_profile")
        .select("niche, tone, style, goal, preferred_language, plan")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not response.data:
        return None
    data = response.data
    data["language"] = data.pop("preferred_language", "english") or "english"
    return data


# ── Utility ───────────────────────────────────────────────────────────────────

def delete_idea(supabase, idea_id: str, user_id: str) -> None:
    # Confirm the idea exists and belongs to this user
    idea_check = (
        supabase.table("ideas")
        .select("id")
        .eq("id", idea_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not idea_check.data:
        raise RuntimeError("Idea not found or not owned by user")

    # 🟢 V2: Deleted 'source == user' validation so ALL ideas are fully deletable
    supabase.table("posts").delete().eq("idea_id", idea_id).execute()

    response = (
        supabase.table("ideas")
        .delete()
        .eq("id", idea_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not response.data:
        raise RuntimeError("Failed to delete idea")
    

# ── Stats & Streak ────────────────────────────────────────────────────────────

def update_user_streak(supabase, user_id: str) -> dict:
    from datetime import date, timedelta
    today = date.today()
    today_str = today.isoformat()
    yesterday_str = (today - timedelta(days=1)).isoformat()
    
    today_stat = supabase.table("user_stats").select("*").eq("user_id", user_id).eq("stat_date", today_str).execute()
    
    if today_stat.data:
        current = today_stat.data[0]
        new_count = current["posts_count"] + 1
        res = supabase.table("user_stats").update({"posts_count": new_count}).eq("id", current["id"]).execute()
        return res.data[0] if res.data else current
        
    yesterday_stat = supabase.table("user_stats").select("*").eq("user_id", user_id).eq("stat_date", yesterday_str).execute()
    
    if yesterday_stat.data and not yesterday_stat.data[0]["is_break"]:
        new_streak = yesterday_stat.data[0]["streak_count"] + 1
    else:
        new_streak = 1
        
    new_record = {
        "user_id": user_id,
        "stat_date": today_str,
        "posts_count": 1,
        "is_break": False,
        "streak_count": new_streak
    }
    
    res = supabase.table("user_stats").insert(new_record).execute()
    return res.data[0] if res.data else new_record

def check_idea_scheduled_for_date(supabase, user_id: str, scheduled_date: str) -> Optional[dict]:
    """Checks if there is already an idea planned for the selected date."""
    response = (
        supabase.table("ideas")
        .select("id, idea")
        .eq("user_id", user_id)
        .eq("scheduled_date", scheduled_date)
        .execute()
    )
    return response.data[0] if response.data else None