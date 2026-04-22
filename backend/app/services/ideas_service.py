# backend/app/services/ideas_service.py

import json
import re
from typing import Optional
from app.core.settings import settings
from app.services.llm_service import generate_content

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

PLAN_DAILY_LIMITS: dict[str, int | None] = {
    "free":    1,
    "starter": None,
    "pro":     None,
}


class IdeaLimitReached(Exception):
    def __init__(self, plan: str, used: int, limit: int):
        self.plan  = plan
        self.used  = used
        self.limit = limit
        super().__init__(f"Daily limit of {limit} ideas reached for plan '{plan}'")


# ══════════════════════════════════════════════════════════════════════════════
# IDEA VALIDATION
# ══════════════════════════════════════════════════════════════════════════════

_REAL_WORDS = {
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
    "hai","hain","kya","toh","bhi","koi","aur","jo","se","ko","ka","ki","ke","mein","par","pe",
    "ne","ho","hoga","karo","bhai","yaar","tera","mera","meri","teri","accha","nahi","sab",
    "kuch","ek","wala","wali","wale","raha","rahi","gaya","gayi","lega","legi","dena","lena",
    "abhi","phir","bas","sahi","bahut","thoda","zyada","tum","aap","woh","apna","apni","dekh",
    "kar","kab","kaise","kyun","pehle","baad","sath","lekin","agar","matlab","samajh","baat",
    "kaam","din","raat","kal","aaj","solid","badiya","mast","dope","fire","crazy","vibe","chill",
    "dil","mann","soch","log","baar","tha","thi","the","hogi","honge","nhi","bro","dude",
}


def _looks_like_real_word(word: str) -> bool:
    w = word.lower()
    if not w:
        return True
    if len(w) <= 2:
        return True
    if w in _REAL_WORDS:
        return True
    vowels = sum(1 for c in w if c in "aeiou")
    if vowels / len(w) < 0.15:
        return False
    consonants = sum(1 for c in w if c.isalpha() and c not in "aeiou")
    if len(w) > 0 and consonants / len(w) > 0.85:
        return False
    return True


def _is_gibberish(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return True
    tokens = re.findall(r"[a-zA-Z]+", stripped.lower())
    if not tokens:
        return True
    meaningful = [t for t in tokens if len(t) > 1]
    if not meaningful:
        return True
    real_ratio = sum(1 for t in meaningful if _looks_like_real_word(t)) / len(meaningful)
    if real_ratio < 0.45:
        return True
    if len(stripped.split()) < 3:
        if real_ratio < 0.8:
            return True
    return False


def _classify_with_ai(text: str) -> str:
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
        raw = generate_content(prompt).strip().upper()
        first_word = re.split(r"[\s.,!?]", raw)[0]
        if first_word in ("INVALID", "CONFUSED", "VALID"):
            return first_word
        return "VALID"
    except Exception:
        return "VALID"


class IdeaInvalid(Exception):
    pass


class IdeaConfused(Exception):
    pass


async def validate_idea_text(text: str) -> None:
    if _is_gibberish(text):
        raise IdeaInvalid("Idea text is gibberish")
    label = _classify_with_ai(text)
    if label == "INVALID":
        raise IdeaInvalid("Idea text classified as invalid by AI")
    if label == "CONFUSED":
        raise IdeaConfused("Idea text is too vague or unclear")


# ══════════════════════════════════════════════════════════════════════════════
# STRUCTURED IDEA GENERATION  (recommended + alternatives)
# ══════════════════════════════════════════════════════════════════════════════

def _fetch_trends_for_niche(supabase, niche: str) -> list[str]:
    """
    Fetch up to 3 active trends matching the user's niche.
    Returns a list of trend strings. Returns empty list on any error.
    """
    try:
        from datetime import datetime, timezone
        now_iso = datetime.now(timezone.utc).isoformat()
        resp = (
            supabase.table("current_trends")
            .select("trend")
            .ilike("niche", f"%{niche}%")
            .gt("expires_at", now_iso)
            .order("score", desc=True)
            .limit(3)
            .execute()
        )
        return [row["trend"] for row in (resp.data or [])]
    except Exception:
        return []


def _build_generation_prompt(
    niche: str,
    tone: str,
    style: str,
    language: str,
    trends: list[str],
) -> str:
    trend_section = ""
    if trends:
        trend_lines = "\n".join(f"  - {t}" for t in trends)
        trend_section = (
            f"\nCurrent trending topics in {niche} (use these as soft inspiration "
            f"— weave them in naturally if relevant):\n{trend_lines}\n"
        )
    else:
        trend_section = (
            f"\nNo specific trends available — generate strong evergreen ideas "
            f"that will perform well in the {niche} niche.\n"
        )

    if language == "hinglish":
        lang_rule = (
            "- Write ideas in Hinglish (natural mix of Hindi and English, "
            "as Indian Instagram creators speak). "
            "Example: 'Apni morning routine dikhao — productivity tips ke saath'"
        )
    else:
        lang_rule = "- Write ideas in clear, natural English"

    return f"""You are a senior Instagram content strategist who knows what actually performs.

Creator profile:
- Niche: {niche}
- Tone: {tone}
- Content style: {style}
{trend_section}
Generate exactly 3 postable Instagram content ideas for this creator.

Rules:
- Each idea must be a single clear sentence (max 20 words)
- Ideas must be practical, specific, and postable TODAY — not generic
- Match the creator's tone and style precisely
- No hooks, no scripts, no captions, no format/editing guidance inside ideas
- recommended idea should be the strongest one (highest viral/engagement potential)
- alternatives should be solid backups that complement the recommended
- win_score: realistic integer 1-10 reflecting expected engagement potential
- why_it_works: 1 short sentence (max 15 words) explaining the core reason this idea works
{lang_rule}
- Return ONLY valid JSON, no markdown, no explanation, no extra text

Output format (strict JSON):
{{
  "recommended": {{
    "idea": "Idea sentence here",
    "why_it_works": "One short reason sentence",
    "win_score": 8
  }},
  "alternatives": [
    {{
      "idea": "Alternative idea one",
      "why_it_works": "One short reason sentence",
      "win_score": 7
    }},
    {{
      "idea": "Alternative idea two",
      "why_it_works": "One short reason sentence",
      "win_score": 6
    }}
  ]
}}"""


def generate_structured_ideas(
    niche: str,
    tone: str,
    style: str,
    language: str,
    trends: list[str],
) -> dict:
    """
    Returns a structured dict:
    {
      "recommended": { "idea": str, "why_it_works": str, "win_score": int },
      "alternatives": [ {...}, {...} ]
    }
    Raises ValueError on malformed AI response.
    """
    prompt = _build_generation_prompt(niche, tone, style, language, trends)
    raw = generate_content(prompt)

    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError(f"AI returned malformed JSON: {raw[:300]}")

    # Validate shape
    if "recommended" not in parsed or "alternatives" not in parsed:
        raise ValueError(f"AI response missing required keys: {list(parsed.keys())}")
    if len(parsed["alternatives"]) != 2:
        raise ValueError(f"Expected 2 alternatives, got {len(parsed['alternatives'])}")

    # Validate and normalise each idea object
    def _clean_idea_obj(obj: dict) -> dict:
        return {
            "idea":         str(obj.get("idea", "")).strip(),
            "why_it_works": str(obj.get("why_it_works", "")).strip(),
            "win_score":    int(obj.get("win_score", 5)),
        }

    return {
        "recommended": _clean_idea_obj(parsed["recommended"]),
        "alternatives": [_clean_idea_obj(a) for a in parsed["alternatives"]],
    }


# ── Idea orchestration ────────────────────────────────────────────────────────

async def handle_generate_ideas(supabase, user_id: str) -> dict:
    """
    Returns structured ideas:
    {
      "recommended": { idea, why_it_works, win_score },
      "alternatives": [ {...}, {...} ]
    }
    Also persists all 3 ideas to the DB with metadata.
    Raises IdeaLimitReached if the user has hit their daily quota.
    """
    profile = get_user_profile(supabase, user_id)
    if not profile:
        raise ValueError("User profile not found. Complete onboarding first.")

    # ── Daily reset + limit check ─────────────────────────────────────────────
    from datetime import date
    today = date.today().isoformat()
    usage = reset_daily_usage_if_needed(supabase, user_id, today)

    plan        = (usage.get("plan") or "free").lower()
    ideas_used  = usage.get("ideas_used_today") or 0
    daily_limit = PLAN_DAILY_LIMITS.get(plan, 3)

    if daily_limit is not None and ideas_used >= daily_limit:
        raise IdeaLimitReached(plan=plan, used=ideas_used, limit=daily_limit)

    niche    = profile.get("niche", "Lifestyle")
    language = profile.get("language", "english")

    # ── Fetch trends (soft — never errors) ───────────────────────────────────
    trends = _fetch_trends_for_niche(supabase, niche)

    # ── Generate structured ideas ─────────────────────────────────────────────
    structured = generate_structured_ideas(
        niche=niche,
        tone=profile.get("tone", "Casual & fun"),
        style=profile.get("style", "Face-to-camera talking"),
        language=language,
        trends=trends,
    )

    # ── Persist to DB ─────────────────────────────────────────────────────────
    rec = structured["recommended"]
    alt1, alt2 = structured["alternatives"]

    # Insert recommended idea (marked with is_recommended flag via source tag)
    saved_rec = _insert_idea_with_metadata(
        supabase, user_id,
        idea_text=rec["idea"],
        why_it_works=rec["why_it_works"],
        win_score=rec["win_score"],
        source="postra",
    )

    saved_alt1 = _insert_idea_with_metadata(
        supabase, user_id,
        idea_text=alt1["idea"],
        why_it_works=alt1["why_it_works"],
        win_score=alt1["win_score"],
        source="postra",
    )

    saved_alt2 = _insert_idea_with_metadata(
        supabase, user_id,
        idea_text=alt2["idea"],
        why_it_works=alt2["why_it_works"],
        win_score=alt2["win_score"],
        source="postra",
    )

    # ── Increment daily counter ───────────────────────────────────────────────
    if daily_limit is not None:
        increment_ideas_used_today(supabase, user_id)

    return {
        "recommended": {**saved_rec, "why_it_works": rec["why_it_works"], "win_score": rec["win_score"]},
        "alternatives": [
            {**saved_alt1, "why_it_works": alt1["why_it_works"], "win_score": alt1["win_score"]},
            {**saved_alt2, "why_it_works": alt2["why_it_works"], "win_score": alt2["win_score"]},
        ],
    }


def _insert_idea_with_metadata(
    supabase,
    user_id: str,
    idea_text: str,
    why_it_works: str,
    win_score: int,
    source: str,
) -> dict:
    """
    Insert a single idea row with metadata columns.
    Falls back gracefully if why_it_works / win_score columns don't exist yet.
    """
    row = {
        "user_id":      user_id,
        "idea":         idea_text.strip(),
        "source":       source,
        "is_favourite": False,
        "why_it_works": why_it_works,
        "win_score":    win_score,
    }

    try:
        resp = supabase.table("ideas").insert(row).execute()
        if not resp.data:
            raise RuntimeError("Failed to insert idea")
        return resp.data[0]
    except Exception as e:
        # If the new columns don't exist yet, fall back to minimal insert
        err_str = str(e).lower()
        if "why_it_works" in err_str or "win_score" in err_str or "column" in err_str:
            minimal_row = {
                "user_id":      user_id,
                "idea":         idea_text.strip(),
                "source":       source,
                "is_favourite": False,
            }
            resp = supabase.table("ideas").insert(minimal_row).execute()
            if not resp.data:
                raise RuntimeError("Failed to insert idea (fallback)")
            result = resp.data[0]
            # Attach metadata in-memory even if not persisted
            result["why_it_works"] = why_it_works
            result["win_score"]    = win_score
            return result
        raise


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

    await validate_idea_text(idea_text)

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


# ── AI call helper ────────────────────────────────────────────────────────────

def _call_llm(messages: list[dict], max_tokens: int = 600) -> str:
    prompt = "\n\n".join(
        f"[{m['role'].upper()}]\n{m['content']}" for m in messages
    )
    return generate_content(prompt)


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

    raw = _call_llm([{"role": "user", "content": prompt}], max_tokens=120)
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
            f"Zyada emojis mat use karo. Genuine raho, hype mat karo.\n\n"
            f"STRICT RULE — CAPTIONS: Caption text MUST always be written in English only, "
            f"no matter what language the conversation is in. "
            f"Baki sab cheez (hooks, hashtags, chat replies) Hinglish mein ho sakti hai, "
            f"lekin caption HAMESHA pure English mein likho — "
            f"Instagram captions English mein zyada reach aur engagement dete hain."
        )
    else:
        system_prompt = (
            f"You are Postra, a helpful Instagram content assistant.\n"
            f"You are helping a creator work on this post idea: \"{chat['title']}\"\n"
            f"Keep responses short (2-4 sentences), practical, and friendly. "
            f"If they ask for hooks, captions, or hashtags — generate them directly. "
            f"Don't use excessive emojis. Be genuine, not hype-y.\n\n"
            f"STRICT RULE — CAPTIONS: Caption text MUST always be written in English only. "
            f"Even if the user asks in another language, always write caption text in English — "
            f"Instagram captions perform better in English."
        )

    groq_messages = [{"role": "system", "content": system_prompt}] + history

    ai_reply_text = _call_llm(groq_messages, max_tokens=400)

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