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

def get_user_profile(supabase, user_id):
    print("USER:", user_id)

    response = (
        supabase.table("user_profile")
        .select("*")
        .eq("id", user_id)
        .execute()
    )

    print("RAW RESPONSE:", response)

    print("DATA:", response.data)

    return response.data[0] if response.data else None

def update_content_goal(supabase, user_id: str, content_goal: str) -> dict:
    """Updates only the content_goal field for a user."""
    response = (
        supabase.table("user_profile")
        .update({"content_goal": content_goal, "updated_at": "now()"})
        .eq("id", user_id)
        .execute()
    )
    if not response.data:
        raise RuntimeError("Failed to update content_goal")
    return response.data[0]


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
    """
    V2: Calculates and updates consistency streaks dynamically based on 
    user's custom frequency settings, querying the last post date direct from 'user_stats'.
    Supports strict multi-day intervals and multi-post targets per day.
    """
    from datetime import date, timedelta
    today = date.today()
    today_str = today.isoformat()
    yesterday_str = (today - timedelta(days=1)).isoformat()
    
    # 1. Fetch user's custom frequency setting from profile
    profile = supabase.table("user_profile").select("streak_frequency").eq("id", user_id).single().execute()
    if not profile.data:
        return {"streak_count": 0}
        
    freq = profile.data.get("streak_frequency")
    if not freq:
        return {"streak_count": 0} # No active streak configured
        
    limits = {
        "2_day": 1,
        "1_day": 1,
        "1_2days": 2,
        "1_3days": 3,
        "1_5days": 5,
        "1_week": 7
    }
    max_gap = limits.get(freq, 1)
    
    # 2. Get today's stats row if it already exists
    today_stat = supabase.table("user_stats").select("*").eq("user_id", user_id).eq("stat_date", today_str).execute()
    today_stat_row = today_stat.data[0] if today_stat.data else None
    
    # 3. Get the latest historical stats row where posts_count > 0 (excluding today's row if it exists)
    last_post_query = supabase.table("user_stats").select("*").eq("user_id", user_id).gt("posts_count", 0)
    if today_stat_row:
        last_post_query = last_post_query.neq("id", today_stat_row["id"])
        
    last_post_stat = last_post_query.order("stat_date", desc=True).limit(1).execute()
    latest_stat_row = last_post_stat.data[0] if last_post_stat.data else None
    
    current_streak = latest_stat_row["streak_count"] if latest_stat_row else 0
    posts_today = (today_stat_row["posts_count"] if today_stat_row else 0) + 1
    
    # 4. Core Math Streak Evaluation
    if freq == "2_day":
        # ── SPECIAL 2 POSTS PER DAY LOGIC ──
        if posts_today == 2:
            # Streak only increments when they successfully hit exactly 2 posts today
            # We also check if yesterday's goal of 2 posts was met
            yesterday_stat = supabase.table("user_stats").select("posts_count").eq("user_id", user_id).eq("stat_date", yesterday_str).execute()
            yesterday_posts = yesterday_stat.data[0]["posts_count"] if yesterday_stat.data else 0
            
            if yesterday_posts >= 2 or current_streak == 0:
                new_streak = current_streak + 1
            else:
                new_streak = 1 # Yesterday target was missed, start new streak of 1
        else:
            # 1st post of today: Keep current streak count active, do not increment yet
            new_streak = current_streak if current_streak > 0 else 0
    else:
        # ── MULTI-DAY INTERVAL LOGIC (e.g. 1 post every 3 days) ──
        if not latest_stat_row:
            new_streak = 1
        else:
            last_posted_date = date.fromisoformat(latest_stat_row["stat_date"])
            gap_days = (today - last_posted_date).days
            
            if gap_days <= 0:
                # Over-posting on same day: keeps current streak active (No double increment, no penalty)
                new_streak = current_streak if current_streak > 0 else 1
            elif gap_days <= max_gap:
                # Success within limit window! Streak increments by 1
                new_streak = current_streak + 1
            else:
                # Exceeded maximum gap limit! Streak breaks and resets to 1
                new_streak = 1
                
    # 5. Insert or update today's stats row
    if today_stat_row:
        res = supabase.table("user_stats").update({
            "posts_count": posts_today,
            "streak_count": new_streak
        }).eq("id", today_stat_row["id"]).execute()
    else:
        res = supabase.table("user_stats").insert({
            "user_id": user_id,
            "stat_date": today_str,
            "posts_count": posts_today,
            "is_break": False,
            "streak_count": new_streak
        }).execute()
        
    return res.data[0] if res.data else {}

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