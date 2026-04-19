# backend/app/services/ideas_service.py
# Business logic layer for the New Post feature.

import json
import random
import httpx
from typing import Optional
from app.core.settings import settings

from app.integrations.queries import (
    insert_ideas,
    toggle_favourite,
    get_ideas_with_chat_status,
    create_chat,
    get_user_profile,
    get_chat_by_id,
    get_messages_for_chat,
    get_next_sequence,
    insert_message,
    upsert_post,
    get_post_for_chat,
)


# ── AI config ─────────────────────────────────────────────────────────────────

GROQ_API_KEY = settings.groq_api_key
AI_MODEL     = "llama-3.1-8b-instant"


# ── Idea generation ───────────────────────────────────────────────────────────

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
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set in environment")

    prompt = _build_prompt(niche, tone, style)

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
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

    raw     = response.json()
    content = raw["choices"][0]["message"]["content"].strip()

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


# ── Idea orchestration ────────────────────────────────────────────────────────

async def handle_generate_ideas(supabase, user_id: str) -> list[dict]:
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
    title = idea_text.split("\n")[0].strip()
    if not title:
        title = idea_text[:100].strip()
    return create_chat(supabase, user_id, idea_id, title)


def handle_get_ideas(supabase, user_id: str) -> list[dict]:
    return get_ideas_with_chat_status(supabase, user_id)


# ── Chat AI helpers ───────────────────────────────────────────────────────────

async def _call_groq(messages: list[dict], max_tokens: int = 600) -> str:
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is not set in environment")

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": AI_MODEL,
                "messages": messages,
                "temperature": 0.85,
                "max_tokens": max_tokens,
            },
        )

    if response.status_code != 200:
        raise RuntimeError(f"AI API error: {response.status_code} — {response.text}")

    return response.json()["choices"][0]["message"]["content"].strip()


def _parse_json_response(raw: str) -> dict:
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError(f"AI returned malformed JSON: {raw}")


# ── Smart opening message generator ──────────────────────────────────────────

async def _generate_opening_message(idea_title: str, language: str = "english") -> str:
    """
    Generate a warm, idea-aware opening message for a new chat session.
    The message reads the idea and responds naturally — not generic hype.
    language: "english" or "hinglish"
    """

    if language == "hinglish":
        prompt = f"""You are Postra, a friendly and sharp Instagram content assistant who talks in Hinglish (mix of Hindi and English, casual tone). 

A creator just opened a chat for this idea:
"{idea_title}"

Write a SHORT, warm, idea-aware opening message (2-3 sentences max). 
- Actually read the idea and react to it genuinely
- Don't be over-the-top (avoid "yaar ye toh game changer hai!!" if the idea is mediocre or vague)
- Be encouraging but honest and natural
- Ask if they want to start working on it (hooks, caption, etc.)
- Use casual Hinglish — mix Hindi words naturally into English sentences
- No emojis overload, max 1-2 emojis

Examples of good openers:
- "Ye idea actually kaafi solid hai — {idea_title[:30]}... iska angle interesting lagta hai. Hooks generate karu?"
- "Hmm, {idea_title[:25]}... ye niche mein kaam kar sakta hai. Shuru karte hain?"
- "Decent idea hai yaar. Thoda polish karna padega but definitely postable hai. Hooks try karein?"
- "Ooh ye wala concept fresh lagta hai! Straight to hooks jayein ya pehle thoda brainstorm?"

Return ONLY the message text, nothing else."""

    else:
        prompt = f"""You are Postra, a friendly and sharp Instagram content assistant.

A creator just opened a chat for this idea:
"{idea_title}"

Write a SHORT, warm, idea-aware opening message (2-3 sentences max).
- Actually read the idea and react to it genuinely
- Don't be over-the-top (avoid "This is a GAME CHANGER!!" if the idea is mediocre or vague)
- Be encouraging but honest and natural
- Ask if they want to start working on it (hooks, caption, etc.)
- Max 1-2 emojis, conversational tone

Examples of good openers:
- "This idea has a solid angle — the '{idea_title[:30]}' angle is something people actually care about. Want me to generate some hooks?"
- "Interesting concept. This could work really well for your niche. Ready to start building it out?"
- "Love the direction here. It's specific enough to stand out. Should we kick off with hooks?"
- "This one's got potential — it's fresh without being too niche. Want to dive in?"
- "Hmm, I can see this working. The concept is clear and relatable. Shall we start with hooks?"

Return ONLY the message text, nothing else."""

    raw = await _call_groq([{"role": "user", "content": prompt}], max_tokens=150)
    # Clean up any quotes the model might wrap around the response
    return raw.strip().strip('"').strip("'")


# ── Stage derivation ──────────────────────────────────────────────────────────

def _derive_stage(messages: list[dict]) -> str:
    """
    Derive current stage — now simplified.
    'intro' = fresh chat, only the opening message exists.
    'chatting' = user has started conversing.
    """
    if not messages:
        return "intro"

    has_user_message = any(m["source"] == "user" for m in messages)
    if not has_user_message:
        return "intro"

    return "chatting"


# ── Chat orchestration ────────────────────────────────────────────────────────

async def handle_get_chat(supabase, chat_id: str, user_id: str) -> dict:
    chat = get_chat_by_id(supabase, chat_id, user_id)
    if not chat:
        raise RuntimeError("Chat not found")

    messages = get_messages_for_chat(supabase, chat_id)
    stage    = _derive_stage(messages)

    # Fresh chat — generate and save a smart opening message
    if not messages:
        profile  = get_user_profile(supabase, user_id) or {}
        language = profile.get("language", "english")

        opening_text = await _generate_opening_message(chat["title"], language)
        seq = get_next_sequence(supabase, chat_id)

        ai_msg = insert_message(
            supabase,
            chat_id=chat_id,
            sequence=seq,
            content=opening_text,
            source="assistant",
            msg_type="text",
            metadata=None,
        )
        messages = [ai_msg]
        stage    = "intro"

    return {**chat, "stage": stage, "messages": messages}


async def handle_send_message(supabase, chat_id: str, user_id: str, content: str) -> dict:
    chat = get_chat_by_id(supabase, chat_id, user_id)
    if not chat:
        raise RuntimeError("Chat not found")

    messages = get_messages_for_chat(supabase, chat_id)
    profile  = get_user_profile(supabase, user_id) or {}
    language = profile.get("language", "english")

    # Save user message
    seq      = get_next_sequence(supabase, chat_id)
    user_msg = insert_message(
        supabase,
        chat_id=chat_id,
        sequence=seq,
        content=content,
        source="user",
        msg_type="text",
        metadata=None,
    )

    # Build conversation history for context-aware AI reply
    history = [
        {
            "role": "assistant" if m["source"] == "assistant" else "user",
            "content": m["content"],
        }
        for m in messages
    ]
    history.append({"role": "user", "content": content})

    if language == "hinglish":
        system_prompt = f"""You are Postra, a helpful Instagram content assistant who talks in Hinglish (casual mix of Hindi and English).
You are helping a creator work on this post idea: "{chat['title']}"
Keep responses short (2-4 sentences), practical, and friendly. 
If they ask for hooks, captions, or hashtags — generate them directly.
Don't use excessive emojis. Be genuine, not hype-y."""
    else:
        system_prompt = f"""You are Postra, a helpful Instagram content assistant.
You are helping a creator work on this post idea: "{chat['title']}"
Keep responses short (2-4 sentences), practical, and friendly.
If they ask for hooks, captions, or hashtags — generate them directly.
Don't use excessive emojis. Be genuine, not hype-y."""

    groq_messages = [{"role": "system", "content": system_prompt}] + history

    ai_reply_text = await _call_groq(groq_messages, max_tokens=400)

    seq2   = get_next_sequence(supabase, chat_id)
    ai_msg = insert_message(
        supabase,
        chat_id=chat_id,
        sequence=seq2,
        content=ai_reply_text,
        source="assistant",
        msg_type="text",
        metadata=None,
    )

    return {"user_message": user_msg, "ai_message": ai_msg}


# ── Legacy selection handler (kept for API compatibility, simplified) ─────────

async def handle_save_selection(
    supabase,
    user_id: str,
    chat_id: str,
    hook: Optional[str] = None,
    caption: Optional[str] = None,
    hashtags: Optional[list[str]] = None,
) -> dict:
    """Kept for API compatibility. Now just saves the selection and acks."""
    chat = get_chat_by_id(supabase, chat_id, user_id)
    if not chat:
        raise RuntimeError("Chat not found")

    idea_id  = chat["idea_id"]
    profile  = get_user_profile(supabase, user_id) or {}
    language = profile.get("language", "english")

    if hook is not None:
        upsert_post(supabase, user_id, chat_id, idea_id=idea_id, hook=hook, caption="", status="draft")
        ai_content = "Hook saved! ✅ Want me to write some caption options for it?" if language != "hinglish" else "Hook save ho gaya! ✅ Caption options chahiye?"
    elif caption is not None:
        upsert_post(supabase, user_id, chat_id, idea_id=idea_id, caption=caption, status="draft")
        ai_content = "Caption saved! Now let's sort the hashtags." if language != "hinglish" else "Caption save ho gaya! Ab hashtags?"
    elif hashtags is not None:
        upsert_post(supabase, user_id, chat_id, idea_id=idea_id, hashtags=hashtags, status="ready")
        ai_content = "All done! Your post is saved in drafts. 🚀" if language != "hinglish" else "Ho gaya! Post drafts mein save hai. 🚀"
    else:
        raise ValueError("Must provide one of: hook, caption, or hashtags")

    seq    = get_next_sequence(supabase, chat_id)
    ai_msg = insert_message(
        supabase,
        chat_id=chat_id,
        sequence=seq,
        content=ai_content,
        source="assistant",
        msg_type="text",
        metadata=None,
    )

    return {"stage": "chatting", "ai_message": ai_msg}