# backend/app/services/ideas_service.py
# Business logic layer for the New Post feature.
# Keeps routes thin — all reasoning lives here.

import os
import json
import httpx
from typing import Optional

from app.integrations.queries import (
    insert_ideas,
    toggle_favourite,
    get_ideas_for_user,
    create_chat,
    get_user_profile,
)


# ── AI idea generation ────────────────────────────────────────────────────────

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")  # set in backend/.env
AI_MODEL = "mistralai/mistral-small-3.1-24b-instruct:free"


def _build_prompt(niche: str, tone: str, style: str) -> str:
    return f"""You are a professional Instagram content strategist.

Generate exactly 3 fresh, trending content ideas for an Instagram creator with the following profile:
- Niche: {niche}
- Tone: {tone}
- Content style: {style}

Rules:
- Each idea must be a single, clear sentence (max 20 words)
- Ideas must be relevant to current Instagram trends
- Ideas must match the creator's tone and style
- No numbering, no bullet points inside the idea text
- Return ONLY valid JSON, no explanation, no markdown, no extra text

Response format:
{{
  "ideas": [
    "Idea one here",
    "Idea two here",
    "Idea three here"
  ]
}}"""


async def generate_ideas(niche: str, tone: str, style: str) -> list[str]:
    """
    Call LLM API and parse exactly 3 ideas.
    Raises ValueError if response is malformed.
    Raises RuntimeError if the API call fails.
    """
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not set in environment")

    prompt = _build_prompt(niche, tone, style)

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://postra-five.vercel.app",
                "X-Title": "Postra",
            },
            json={
                "model": AI_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.85,
                "max_tokens": 300,
            },
        )

    if response.status_code != 200:
        raise RuntimeError(f"AI API error: {response.status_code} — {response.text}")

    raw = response.json()
    content = raw["choices"][0]["message"]["content"].strip()

    # Strip accidental markdown fences
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()

    try:
        parsed = json.loads(content)
        ideas: list[str] = parsed["ideas"]
    except (json.JSONDecodeError, KeyError):
        raise ValueError(f"AI returned malformed JSON: {content}")

    if len(ideas) != 3:
        raise ValueError(f"Expected 3 ideas, got {len(ideas)}")

    return [idea.strip() for idea in ideas]


# ── Orchestration ─────────────────────────────────────────────────────────────

async def handle_generate_ideas(supabase, user_id: str) -> list[dict]:
    """
    1. Fetch user profile for personalisation
    2. Call AI
    3. Save all 3 ideas with source='postra'
    4. Return saved idea rows
    """
    profile = get_user_profile(supabase, user_id)
    if not profile:
        raise ValueError("User profile not found. Complete onboarding first.")

    ideas_text = await generate_ideas(
        niche=profile.get("niche", "Lifestyle"),
        tone=profile.get("tone", "Casual & fun"),
        style=profile.get("style", "Face-to-camera talking"),
    )

    saved = insert_ideas(supabase, user_id, ideas_text, source="postra")
    return saved


def handle_save_user_idea(supabase, user_id: str, idea_text: str) -> dict:
    """
    Save a single user-written idea with source='user'.
    Returns the saved row.
    """
    idea_text = idea_text.strip()
    if not idea_text:
        raise ValueError("Idea text cannot be empty")
    if len(idea_text) > 500:
        raise ValueError("Idea text too long (max 500 characters)")

    saved = insert_ideas(supabase, user_id, [idea_text], source="user")
    return saved[0]


def handle_toggle_favourite(supabase, user_id: str, idea_id: str, is_favourite: bool) -> dict:
    return toggle_favourite(supabase, idea_id, user_id, is_favourite)


def handle_confirm_idea(supabase, user_id: str, idea_id: str, idea_text: str) -> dict:
    """
    Create a chat from a selected idea.
    title = first line of the idea (clean, trimmed).
    """
    title = idea_text.split("\n")[0].strip()
    if not title:
        title = idea_text[:100].strip()

    return create_chat(supabase, user_id, idea_id, title)


def handle_get_ideas(supabase, user_id: str) -> list[dict]:
    return get_ideas_for_user(supabase, user_id)