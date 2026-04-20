# backend/app/services/ideas_service.py

import json
import re
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
    reset_daily_usage_if_needed,
    increment_ideas_used_today,
)

# ── Plan limits ───────────────────────────────────────────────────────────────

# Maximum AI-generated ideas allowed per day, keyed by plan.
# None = unlimited.
PLAN_DAILY_LIMITS: dict[str, int | None] = {
    "free":    1,
    "starter": None,
    "pro":     None,
}


class IdeaLimitReached(Exception):
    """Raised when the user has exhausted their daily idea generation quota."""
    def __init__(self, plan: str, used: int, limit: int):
        self.plan  = plan
        self.used  = used
        self.limit = limit
        super().__init__(f"Daily limit of {limit} ideas reached for plan '{plan}'")

# ── AI config ─────────────────────────────────────────────────────────────────

GROQ_API_KEY = settings.groq_api_key
AI_MODEL     = "llama-3.1-8b-instant"


# ══════════════════════════════════════════════════════════════════════════════
# IDEA VALIDATION  (Step 1: heuristic, Step 2: AI classifier)
# ══════════════════════════════════════════════════════════════════════════════

# Expanded real-word whitelist (English + Hinglish)
_REAL_WORDS = {
    # English common
    "a","an","the","and","or","but","for","in","is","it","my","you","i","we","he","she","they",
    "this","that","how","what","why","when","with","from","have","has","do","does","will","can",
    "not","are","was","were","be","been","being","had","if","then","than","so","as","at","by",
    "on","to","up","out","off","get","go","make","use","want","need","like","know","see","think",
    "come","give","take","say","tell","ask","feel","try","keep","let","put","set","run","turn",
    "show","move","live","play","work","love","start","stop","call","open","help","look","find",
    "reel","post","video","story","content","idea","about","create","share","brand","niche",
    "audience","followers","growth","viral","hook","caption","edit","trend","morning","night",
    "fitness","food","travel","fashion","tech","business","money","health","skin","workout",
    "recipe","vlog","life","day","week","tips","guide","hack","routine","challenge","review",
    "behind","scenes","tutorial","your","their","our","its","his","her","more","some","all",
    "just","also","here","there","now","then","new","old","good","bad","best","top","real",
    "free","easy","quick","simple","great","every","each","both","through","people","things",
    "time","year","even","most","over","such","after","before","never","always","often","still",
    "only","much","many","same","last","long","down","back","first","way","into","than","very",
    "me","him","us","them","who","which","its","mine","yours","ours","theirs","am","been",
    # Hinglish
    "hai","hain","kya","toh","bhi","koi","aur","jo","se","ko","ka","ki","ke","mein","par","pe",
    "ne","ho","hoga","karo","bhai","yaar","tera","mera","meri","teri","accha","nahi","sab",
    "kuch","ek","wala","wali","wale","raha","rahi","gaya","gayi","lega","legi","dena","lena",
    "abhi","phir","bas","sahi","bahut","thoda","zyada","tum","aap","woh","apna","apni","dekh",
    "kar","kab","kaise","kyun","pehle","baad","sath","lekin","agar","matlab","samajh","baat",
    "kaam","din","raat","kal","aaj","solid","badiya","mast","dope","fire","crazy","vibe","chill",
    "dil","mann","soch","log","baar","tha","thi","the","hogi","honge","nhi","bro","dude",
}


def _looks_like_real_word(word: str) -> bool:
    """Heuristic: does this token look like a real word?"""
    w = word.lower()
    if not w:
        return True
    if len(w) <= 2:
        return True          # short tokens — benefit of doubt
    if w in _REAL_WORDS:
        return True

    # Vowel ratio: genuine words have ≥15 % vowels
    vowels = sum(1 for c in w if c in "aeiou")
    if vowels / len(w) < 0.15:
        return False

    # Consonant density: >85 % consonants is suspicious
    consonants = sum(1 for c in w if c.isalpha() and c not in "aeiou")
    if len(w) > 0 and consonants / len(w) > 0.85:
        return False

    return True


def _is_gibberish(text: str) -> bool:
    """
    Pure-Python, no-LLM heuristic.
    Returns True when the text is clearly random/keyboard-mash.
    """
    stripped = text.strip()
    if not stripped:
        return True

    tokens = re.findall(r"[a-zA-Z]+", stripped.lower())
    if not tokens:
        return True                  # only numbers/symbols

    meaningful = [t for t in tokens if len(t) > 1]
    if not meaningful:
        return True

    real_ratio = sum(1 for t in meaningful if _looks_like_real_word(t)) / len(meaningful)
    if real_ratio < 0.45:
        return True

    # Also block if the whole text is shorter than 3 words total
    if len(stripped.split()) < 3:
        # 1-2 words might still be valid if they're recognisable
        if real_ratio < 0.8:
            return True

    return False


async def _classify_with_ai(text: str) -> str:
    """
    Strict single-label AI classifier.
    Returns: "INVALID" | "CONFUSED" | "VALID"
    Falls back to "VALID" on any API error so we don't block good ideas.
    """
    if not GROQ_API_KEY:
        return "VALID"      # can't call AI — let it through

    prompt = (
        "You are a strict content evaluator.\n"
        "Rules:\n"
        "- If text is gibberish → return: INVALID\n"
        "- If idea is unclear/confusing → return: CONFUSED\n"
        "- If idea is clear and usable → return: VALID\n"
        "DO NOT explain. DO NOT add extra words. ONLY return one word.\n\n"
        f"Text: \"{text}\""
    )

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": AI_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.0,
                    "max_tokens": 10,
                },
            )

        if response.status_code != 200:
            return "VALID"  # fail open

        raw = response.json()["choices"][0]["message"]["content"].strip().upper()

        # Normalise: extract first word in case model added punctuation
        first_word = re.split(r"[\s.,!?]", raw)[0]
        if first_word in ("INVALID", "CONFUSED", "VALID"):
            return first_word
        return "VALID"      # unexpected label — fail open

    except Exception:
        return "VALID"      # network/parse error — fail open


class IdeaInvalid(Exception):
    """Raised when an idea is INVALID (gibberish). Do not save, do not chat."""
    pass


class IdeaConfused(Exception):
    """Raised when an idea is CONFUSED (too vague). Save but warn the user."""
    pass


async def validate_idea_text(text: str) -> None:
    """
    Validate idea text BEFORE any DB write.

    Raises:
        IdeaInvalid  — caller must return HTTP 422, never save
        IdeaConfused — caller should surface a warning; saving is still OK
    """
    # ── Step 1: Fast heuristic (no LLM, no latency) ───────────────────────
    if _is_gibberish(text):
        raise IdeaInvalid("Idea text is gibberish")

    # ── Step 2: AI strict classifier ─────────────────────────────────────
    label = await _classify_with_ai(text)

    if label == "INVALID":
        raise IdeaInvalid("Idea text classified as invalid by AI")

    if label == "CONFUSED":
        raise IdeaConfused("Idea text is too vague or unclear")

    # label == "VALID" → falls through, no exception


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

    # ── Step 1: Daily reset ───────────────────────────────────────────────────
    from datetime import date
    today = date.today().isoformat()          # "YYYY-MM-DD"
    usage = reset_daily_usage_if_needed(supabase, user_id, today)

    plan            = (usage.get("plan") or "free").lower()
    ideas_used      = usage.get("ideas_used_today") or 0
    daily_limit     = PLAN_DAILY_LIMITS.get(plan, 3)  # unknown plans default to free

    # ── Step 2: Limit check ───────────────────────────────────────────────────
    if daily_limit is not None and ideas_used >= daily_limit:
        raise IdeaLimitReached(plan=plan, used=ideas_used, limit=daily_limit)

    # ── Step 3: Generate ideas ────────────────────────────────────────────────
    ideas_text = await generate_ideas(
        niche=profile.get("niche", "Lifestyle"),
        tone=profile.get("tone", "Casual & fun"),
        style=profile.get("style", "Face-to-camera talking"),
    )

    saved = insert_ideas(supabase, user_id, ideas_text, source="postra")

    # ── Step 4: Increment counter ONLY after successful generation ────────────
    if daily_limit is not None:
        increment_ideas_used_today(supabase, user_id)

    return saved


async def handle_save_user_idea(supabase, user_id: str, idea_text: str) -> dict:
    """
    Validate FIRST, then save.
    Raises IdeaInvalid or IdeaConfused before touching the DB.
    """
    idea_text = idea_text.strip()
    if not idea_text:
        raise IdeaInvalid("Idea text cannot be empty")
    if len(idea_text) > 500:
        raise ValueError("Idea text too long (max 500 characters)")

    # ── VALIDATION GATE: runs before any DB write ─────────────────────────
    await validate_idea_text(idea_text)
    # If we reach here, the idea is VALID (or CONFUSED — warning was raised
    # as IdeaConfused which the caller catches and surfaces to the user).

    saved = insert_ideas(supabase, user_id, [idea_text], source="user")
    return saved[0]


def handle_toggle_favourite(supabase, user_id: str, idea_id: str, is_favourite: bool) -> dict:
    return toggle_favourite(supabase, idea_id, user_id, is_favourite)


def handle_confirm_idea(supabase, user_id: str, idea_id: str, idea_text: str) -> dict:
    """
    Create a chat from an already-saved idea.
    The idea was validated when it was saved, so no re-validation needed here.
    """
    title = idea_text.split("\n")[0].strip()
    if not title:
        title = idea_text[:100].strip()
    return create_chat(supabase, user_id, idea_id, title)


def handle_get_ideas(supabase, user_id: str) -> list[dict]:
    return get_ideas_with_chat_status(supabase, user_id)


# ── AI call helper ────────────────────────────────────────────────────────────

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


# ── Stage derivation ──────────────────────────────────────────────────────────

def _derive_stage(messages: list[dict]) -> str:
    if not messages:
        return "intro"
    has_user_message = any(m["source"] == "user" for m in messages)
    if not has_user_message:
        return "intro"
    return "chatting"


# ── Smart opening message generator ──────────────────────────────────────────

async def _generate_opening_message(idea_title: str, language: str = "english") -> str:
    """
    Generate a context-aware opening AI message for a VALID idea.
    Called only after the idea has passed validation.
    """
    if language == "hinglish":
        prompt = (
            f"Tu Postra hai — sharp aur honest Instagram content assistant jo Hinglish mein baat karta hai.\n\n"
            f"Creator ka idea hai: \"{idea_title}\"\n\n"
            f"Ye idea already validated hai — valid aur clear hai.\n\n"
            f"Short, genuine opening message likho (2-3 sentences):\n"
            f"- Idea ko actually read karke react karo — honest reaction, over-the-top hype nahi\n"
            f"- Creator ko feel ho ki Postra ne genuinely samjha\n"
            f"- Hooks/caption ke liye offer karo\n"
            f"- Casual Hinglish, 1-2 emojis max\n\n"
            f"Examples:\n"
            f"- \"Ye concept kaafi solid lagta hai 🔥 — seedha hooks pe chalein?\"\n"
            f"- \"Decent idea hai bhai — postable definitely hai. Hooks se start karein?\"\n\n"
            f"Return ONLY the message."
        )
    else:
        prompt = (
            f"You are Postra — a sharp, genuine Instagram content assistant.\n\n"
            f"Creator's idea: \"{idea_title}\"\n\n"
            f"This idea has already been validated — it is clear and usable.\n\n"
            f"Write a short, genuine opening message (2-3 sentences):\n"
            f"- Actually react to the idea — honest, not over-the-top hype\n"
            f"- Make them feel Postra truly gets it\n"
            f"- Offer to start with hooks/caption\n"
            f"- Conversational, 1-2 emojis max\n\n"
            f"Examples:\n"
            f"- \"This has a solid angle 🔥 — the kind of content people actually stop for. Want to hit hooks?\"\n"
            f"- \"Decent idea, honestly — it'll work well if we nail the hook. Want to start there?\"\n\n"
            f"Return ONLY the message."
        )

    raw = await _call_groq([{"role": "user", "content": prompt}], max_tokens=120)
    return raw.strip().strip('"').strip("'")


# ── Chat orchestration ────────────────────────────────────────────────────────

async def handle_get_chat(supabase, chat_id: str, user_id: str) -> dict:
    chat = get_chat_by_id(supabase, chat_id, user_id)
    if not chat:
        raise RuntimeError("Chat not found")

    messages = get_messages_for_chat(supabase, chat_id)
    stage    = _derive_stage(messages)

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

    history = [
        {
            "role": "assistant" if m["source"] == "assistant" else "user",
            "content": m["content"],
        }
        for m in messages
    ]
    history.append({"role": "user", "content": content})

    if language == "hinglish":
        system_prompt = (
            f"Tu Postra hai, ek helpful Instagram content assistant jo Hinglish mein baat karta hai.\n"
            f"Creator is post idea pe kaam kar raha hai: \"{chat['title']}\"\n"
            f"Responses short rakho (2-4 sentences), practical aur friendly. "
            f"Agar hooks, captions, ya hashtags maange — seedha generate karo. "
            f"Zyada emojis mat use karo. Genuine raho, hype mat karo."
        )
    else:
        system_prompt = (
            f"You are Postra, a helpful Instagram content assistant.\n"
            f"You are helping a creator work on this post idea: \"{chat['title']}\"\n"
            f"Keep responses short (2-4 sentences), practical, and friendly. "
            f"If they ask for hooks, captions, or hashtags — generate them directly. "
            f"Don't use excessive emojis. Be genuine, not hype-y."
        )

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


# ── Legacy selection handler ──────────────────────────────────────────────────

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