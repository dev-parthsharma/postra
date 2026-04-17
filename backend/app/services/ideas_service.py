# backend/app/services/ideas_service.py
# Business logic layer for the New Post feature.
# Keeps routes thin — all reasoning lives here.

import json
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


# ── Stage derivation ──────────────────────────────────────────────────────────

def _derive_stage(messages: list[dict]) -> str:
    """
    Derive current stage from message history.
    Looks at the last assistant message that has a content type.
    If none exist yet → 'hooks' (starting point).
    """
    content_types = {"hooks", "captions", "hashtags"}
    last_type = None

    for msg in reversed(messages):
        if msg["source"] == "assistant" and msg["type"] in content_types:
            last_type = msg["type"]
            break

    if last_type is None:
        return "hooks"

    return last_type


# ── AI content generators ─────────────────────────────────────────────────────

async def _generate_hooks(idea_title: str, niche: str, tone: str) -> dict:
    prompt = f"""You are an expert Instagram content strategist.

Generate exactly 3 hook variations for this post idea:
Idea: {idea_title}
Creator niche: {niche}
Tone: {tone}

Rules:
- Each hook must be 1-2 sentences, max 25 words
- Cover these 3 styles: Bold, Question, Story
- Hooks must be scroll-stopping and highly engaging
- Return ONLY valid JSON, no extra text

Response format:
{{
  "hooks": [
    {{"id": "hook_1", "style": "Bold", "text": "Hook text here"}},
    {{"id": "hook_2", "style": "Question", "text": "Hook text here"}},
    {{"id": "hook_3", "style": "Story", "text": "Hook text here"}}
  ]
}}"""

    raw    = await _call_groq([{"role": "user", "content": prompt}], max_tokens=400)
    parsed = _parse_json_response(raw)

    if "hooks" not in parsed or len(parsed["hooks"]) != 3:
        raise ValueError("AI returned malformed hooks response")

    return {"hooks": parsed["hooks"]}


async def _generate_captions(idea_title: str, hook: str, niche: str, tone: str) -> dict:
    prompt = f"""You are an expert Instagram caption writer.

Write 3 caption variations for this post:
Idea: {idea_title}
Hook chosen: {hook}
Creator niche: {niche}
Tone: {tone}

Rules:
- Short: 1-2 lines with emojis and 2 hashtags inline
- Medium: 3-4 lines, engaging, with a call-to-action and 3 hashtags
- Long: 5-7 lines, storytelling style, with a question CTA and 4 hashtags
- Match the creator's tone throughout
- Return ONLY valid JSON, no extra text

Response format:
{{
  "captions": [
    {{"id": "caption_short", "length": "Short", "text": "Caption text here"}},
    {{"id": "caption_medium", "length": "Medium", "text": "Caption text here"}},
    {{"id": "caption_long", "length": "Long", "text": "Caption text here"}}
  ]
}}"""

    raw    = await _call_groq([{"role": "user", "content": prompt}], max_tokens=600)
    parsed = _parse_json_response(raw)

    if "captions" not in parsed or len(parsed["captions"]) != 3:
        raise ValueError("AI returned malformed captions response")

    return {"captions": parsed["captions"]}


async def _generate_hashtags(idea_title: str, niche: str) -> dict:
    prompt = f"""You are an Instagram hashtag expert.

Generate exactly 10 targeted hashtags for this post:
Idea: {idea_title}
Niche: {niche}

Rules:
- Mix of: 3 broad (1M+ posts), 4 mid-range (100K-1M), 3 niche-specific (<100K)
- All lowercase, prefixed with #
- No spaces inside hashtags
- Return ONLY valid JSON, no extra text

Response format:
{{
  "hashtags": [
    {{"tag": "#example"}},
    {{"tag": "#anotherhashtag"}}
  ]
}}"""

    raw    = await _call_groq([{"role": "user", "content": prompt}], max_tokens=300)
    parsed = _parse_json_response(raw)

    if "hashtags" not in parsed or len(parsed["hashtags"]) < 5:
        raise ValueError("AI returned malformed hashtags response")

    return {"hashtags": parsed["hashtags"]}


# ── Chat orchestration ────────────────────────────────────────────────────────

async def handle_get_chat(supabase, chat_id: str, user_id: str) -> dict:
    chat = get_chat_by_id(supabase, chat_id, user_id)
    if not chat:
        raise RuntimeError("Chat not found")

    messages = get_messages_for_chat(supabase, chat_id)
    stage    = _derive_stage(messages)

    # Fresh chat — generate and save the opening hooks message automatically
    if not messages:
        profile  = get_user_profile(supabase, user_id) or {}
        niche    = profile.get("niche", "Lifestyle")
        tone     = profile.get("tone", "Casual & fun")

        opening_text = (
            "Let's turn your idea into a post! 🚀\n\n"
            "I've generated 3 hook variations for you — pick the one that feels right, "
            "then we'll move on to captions and hashtags."
        )
        metadata = await _generate_hooks(chat["title"], niche, tone)
        seq      = get_next_sequence(supabase, chat_id)

        ai_msg = insert_message(
            supabase,
            chat_id=chat_id,
            sequence=seq,
            content=opening_text,
            source="assistant",
            msg_type="hooks",
            metadata=metadata,
        )
        messages = [ai_msg]
        stage    = "hooks"

    return {**chat, "stage": stage, "messages": messages}


async def handle_send_message(supabase, chat_id: str, user_id: str, content: str) -> dict:
    chat = get_chat_by_id(supabase, chat_id, user_id)
    if not chat:
        raise RuntimeError("Chat not found")

    messages = get_messages_for_chat(supabase, chat_id)
    stage    = _derive_stage(messages)

    if stage == "done":
        raise RuntimeError("This chat workflow is already complete")

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

    # AI reply — guides user back to current stage action
    stage_prompts = {
        "hooks":    "Please pick one of the hooks above to continue, or let me know if you'd like different options.",
        "captions": "Please select one of the captions above to continue.",
        "hashtags": "Please choose your hashtags above to complete the post.",
    }
    ai_reply_text = f"Got it! {stage_prompts.get(stage, 'Let me know how you want to proceed.')}"

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


async def handle_save_selection(
    supabase,
    user_id: str,
    chat_id: str,
    hook: Optional[str] = None,
    caption: Optional[str] = None,
    hashtags: Optional[list[str]] = None,
) -> dict:
    chat = get_chat_by_id(supabase, chat_id, user_id)
    if not chat:
        raise RuntimeError("Chat not found")

    # chat["idea_id"] is the FK to ideas.id — used for posts.idea_id
    idea_id = chat["idea_id"]

    messages = get_messages_for_chat(supabase, chat_id)
    stage    = _derive_stage(messages)

    profile = get_user_profile(supabase, user_id) or {}
    niche   = profile.get("niche", "Lifestyle")
    tone    = profile.get("tone", "Casual & fun")

    next_stage: str
    ai_content: str
    ai_type:    str
    metadata:   Optional[dict] = None

    # ── Hook selected → save to posts, generate captions ─────────────────────
    if hook is not None:
        upsert_post(
            supabase, user_id, chat_id,
            idea_id=idea_id,   # ← FK to ideas.id (was: idea=chat["title"])
            hook=hook,
             caption="",
            status="draft",
        )

        ai_content = "Great hook! 🎣 Now let's write the caption. Here are 3 options — pick the one that matches your vibe:"
        metadata   = await _generate_captions(chat["title"], hook, niche, tone)
        ai_type    = "captions"
        next_stage = "captions"

    # ── Caption selected → save, generate hashtags ────────────────────────────
    elif caption is not None:
        upsert_post(supabase, user_id, chat_id,idea_id, caption=caption, status="draft")

        ai_content = "Caption locked in! ✍️ Last step — pick your hashtags. Toggle any you don't want:"
        metadata   = await _generate_hashtags(chat["title"], niche)
        ai_type    = "hashtags"
        next_stage = "hashtags"

    # ── Hashtags selected → save, mark done ──────────────────────────────────
    elif hashtags is not None:
        upsert_post(supabase, user_id, chat_id,idea_id, hashtags=hashtags, status="ready")

        ai_content = "Your post is ready! 🚀 Hook, caption, and hashtags are all saved in your drafts."
        ai_type    = "text"
        next_stage = "done"

    else:
        raise ValueError("Must provide one of: hook, caption, or hashtags")

    seq    = get_next_sequence(supabase, chat_id)
    ai_msg = insert_message(
        supabase,
        chat_id=chat_id,
        sequence=seq,
        content=ai_content,
        source="assistant",
        msg_type=ai_type,
        metadata=metadata,
    )

    return {"stage": next_stage, "ai_message": ai_msg}