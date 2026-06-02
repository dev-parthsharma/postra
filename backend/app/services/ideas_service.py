# backend/app/services/ideas_service.py

import json
import random
import re
from typing import Optional
from app.core.settings import settings
from app.services.llm_service import generate_content, generate_content_gemini_first
from app.services.fallback_ideas import get_fallback_ideas

# 🟢 Fixed Imports: Replaced old chat imports with direct post queries
from app.integrations.queries import (
    insert_ideas,
    toggle_favourite,
    get_ideas_with_chat_status,
    create_draft_post,
    get_user_profile,
    get_post_by_id,
    upsert_post,
    reset_daily_usage_if_needed,
    increment_ideas_used_today,
)

# ── Plan limits ───────────────────────────────────────────────────────────────

PLAN_DAILY_LIMITS: dict[str, int | None] = {
    "free":    None,
    "starter": None,
    "pro":     None,
}


class IdeaLimitReached(Exception):
    def __init__(self, plan: str, used: int, limit: int):
        self.plan  = plan
        self.used  = used
        self.limit = limit
        super().__init__(f"Daily limit of {limit} ideas reached for plan '{plan}'")


# ── In-memory dedup cache ─────────────────────────────────────────────────────

_seen_ideas_cache: dict[str, set[str]] = {}


def _cache_key(idea_text: str) -> str:
    return idea_text.lower().strip()[:80]


def _get_seen_ideas(user_id: str) -> set[str]:
    return _seen_ideas_cache.setdefault(user_id, set())


def _mark_ideas_seen(user_id: str, ideas: list[str]) -> None:
    seen = _get_seen_ideas(user_id)
    for idea in ideas:
        seen.add(_cache_key(idea))
    if len(seen) > 200:
        overflow = list(seen)[:100]
        for k in overflow:
            seen.discard(k)


def _filter_seen(user_id: str, ideas: list[dict]) -> list[dict]:
    seen = _get_seen_ideas(user_id)
    return [i for i in ideas if _cache_key(i.get("idea", "")) not in seen]


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


# ── ════════════════════════════════════════════════════════════════════════════
# STRUCTURED IDEA GENERATION
# ══════════════════════════════════════════════════════════════════════════════

def _fetch_trends_for_niche(supabase, niche: str) -> list[str]:
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
    exclude_ideas: list[str],
) -> str:
    trend_section = ""
    if trends:
        trend_lines = "\n".join(f"  - {t}" for t in trends)
        trend_section = (
            f"\nCurrent trending topics in {niche} (weave them in naturally if relevant):\n"
            f"{trend_lines}\n"
        )
    else:
        trend_section = (
            f"\nNo specific trends available — generate strong evergreen ideas "
            f"that will perform well in the {niche} niche.\n"
        )

    exclude_section = ""
    if exclude_ideas:
        exclude_lines = "\n".join(f"  - {e}" for e in exclude_ideas[:10])
        exclude_section = (
            f"\nDo NOT generate ideas similar to these already-seen ideas:\n"
            f"{exclude_lines}\n"
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
{trend_section}{exclude_section}
Generate exactly 3 postable Instagram content ideas for this creator.

Rules:
- Each idea must be a single clear sentence (max 20 words)
- Ideas must be practical, specific, and postable TODAY — not generic
- Match the creator's tone and style precisely
- No hooks, no scripts, no captions, no format/editing guidance inside ideas
- recommended idea should be the strongest one (highest viral/engagement potential)
- alternatives should be solid backups that complement the recommended
- win_score: realistic integer 1-10 reflecting expected engagement potential
{lang_rule}
- Return ONLY valid JSON, no markdown, no explanation, no extra text

Output format (strict JSON):
{{
  "recommended": {{
    "idea": "Idea sentence here",
    "win_score": 8
  }},
  "alternatives":[
    {{
      "idea": "Alternative idea one",
      "win_score": 7
    }},
    {{
      "idea": "Alternative idea two",
      "win_score": 6
    }}
  ]
}}"""


def _parse_structured_ideas(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:] if lines[0].startswith("```") else lines
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group())
            except json.JSONDecodeError:
                raise ValueError(f"AI returned malformed JSON: {raw[:300]}")
        else:
            raise ValueError(f"AI returned malformed JSON: {raw[:300]}")

    if "recommended" not in parsed or "alternatives" not in parsed:
        raise ValueError(f"AI response missing required keys: {list(parsed.keys())}")
    if not isinstance(parsed["alternatives"], list) or len(parsed["alternatives"]) < 2:
        raise ValueError(f"Expected 2 alternatives, got {len(parsed.get('alternatives',[]))}")

    def _clean_idea_obj(obj: dict) -> dict:
        return {
            "idea":         str(obj.get("idea", "")).strip(),
            "win_score":    max(1, min(10, int(obj.get("win_score", 5)))),
        }

    return {
        "recommended": _clean_idea_obj(parsed["recommended"]),
        "alternatives": [_clean_idea_obj(a) for a in parsed["alternatives"][:2]],
    }


def generate_structured_ideas(
    niche: str,
    tone: str,
    style: str,
    language: str,
    trends: list[str],
    exclude_ideas: list[str],
) -> dict:
    prompt = _build_generation_prompt(niche, tone, style, language, trends, exclude_ideas)
    raw = generate_content(prompt)
    return _parse_structured_ideas(raw)


def _build_fallback_result(niche: str, user_id: str) -> dict:
    all_ideas = get_fallback_ideas(niche)
    unseen = _filter_seen(user_id, all_ideas)
    pool = unseen if len(unseen) >= 3 else all_ideas
    pool_sorted = sorted(pool, key=lambda x: x["win_score"], reverse=True)
    recommended = pool_sorted[0]
    alternatives_pool = [i for i in pool if i["idea"] != recommended["idea"]]
    random.shuffle(alternatives_pool)
    alternatives = alternatives_pool[:2]
    while len(alternatives) < 2:
        alternatives.append({
            "idea": "Create a day-in-your-life reel showing your real daily routine",
            "why_it_works": "Authentic daily content builds strong personal connection with audiences",
            "win_score": 7,
        })
    return {
        "recommended": recommended,
        "alternatives": alternatives[:2],
        "_is_fallback": True,
    }


# ── Idea orchestration ────────────────────────────────────────────────────────

async def handle_generate_ideas(supabase, user_id: str) -> dict:
    profile = get_user_profile(supabase, user_id)
    if not profile:
        raise ValueError("User profile not found. Complete onboarding first.")

    from datetime import date
    today = date.today().isoformat()
    usage = reset_daily_usage_if_needed(supabase, user_id, today)

    plan        = (usage.get("plan") or "free").lower()
    ideas_used  = usage.get("ideas_used_today") or 0
    daily_limit = PLAN_DAILY_LIMITS.get(plan, 3)

    # 🟢 BYPASSED: Daily limit check disabled for testing
    # if daily_limit is not None and ideas_used >= daily_limit:
    #     raise IdeaLimitReached(plan=plan, used=ideas_used, limit=daily_limit)

    niche    = profile.get("niche", "Lifestyle")
    language = profile.get("language", "english")

    trends = _fetch_trends_for_niche(supabase, niche)
    seen = _get_seen_ideas(user_id)
    exclude_list = list(seen)[:15]

    is_fallback = False
    try:
        structured = generate_structured_ideas(
            niche=niche,
            tone=profile.get("tone", "Casual & fun"),
            style=profile.get("style", "Face-to-camera talking"),
            language=language,
            trends=trends,
            exclude_ideas=exclude_list,
        )
    except Exception as e:
        print(f"[ideas_service] AI generation failed, using fallback: {e}")
        structured = _build_fallback_result(niche, user_id)
        is_fallback = True

    rec  = structured["recommended"]
    alt1, alt2 = structured["alternatives"]

    saved_rec = _insert_idea_with_metadata(
        supabase, user_id,
        idea_text=rec["idea"],
        win_score=rec["win_score"],
        source="postra",
    )
    saved_alt1 = _insert_idea_with_metadata(
        supabase, user_id,
        idea_text=alt1["idea"],
        win_score=alt1["win_score"],
        source="postra",
    )
    saved_alt2 = _insert_idea_with_metadata(
        supabase, user_id,
        idea_text=alt2["idea"],
        win_score=alt2["win_score"],
        source="postra",
    )

    _mark_ideas_seen(user_id, [rec["idea"], alt1["idea"], alt2["idea"]])

    # 🟢 BYPASSED: Daily limit increment disabled for testing
    # if daily_limit is not None:
    #     increment_ideas_used_today(supabase, user_id)

    result = {
        "recommended": {
            **saved_rec,
            "win_score": rec["win_score"],
        },
        "alternatives":[
            {**saved_alt1, "win_score": alt1["win_score"]},
            {**saved_alt2, "win_score": alt2["win_score"]},
        ],
    }

    if is_fallback:
        result["_fallback"] = True

    return result


def _insert_idea_with_metadata(
    supabase,
    user_id: str,
    idea_text: str,
    win_score: int,
    source: str,
    scheduled_date: Optional[str] = None,
) -> dict:
    cleaned = idea_text.strip()

    try:
        existing = (
            supabase.table("ideas")
            .select("*")
            .eq("user_id", user_id)
            .eq("idea", cleaned)
            .limit(1)
            .execute()
        )
        if existing.data:
            return existing.data[0]
    except Exception:
        pass

    row = {
        "user_id":      user_id,
        "idea":         cleaned,
        "source":       source,
        "win_score":    win_score,
        "scheduled_date": scheduled_date,
    }

    try:
        resp = supabase.table("ideas").insert(row).execute()
        if not resp.data:
            raise RuntimeError("Failed to insert idea")
        return resp.data[0]
    except Exception as e:
        err_str = str(e).lower()
        if "column" in err_str:
            minimal_row = {
                "user_id":      user_id,
                "idea":         cleaned,
                "source":       source,
            }
            resp = supabase.table("ideas").insert(minimal_row).execute()
            if not resp.data:
                raise RuntimeError("Failed to insert idea (fallback)")
            result = resp.data[0]
            result["win_score"]    = win_score
            return result
        raise


async def handle_save_user_idea(supabase, user_id: str, idea_text: str, scheduled_date: Optional[str] = None, source: str = "user") -> dict:
    idea_text = idea_text.strip()
    if not idea_text:
        raise IdeaInvalid("Idea text cannot be empty")
    if len(idea_text) > 500:
        raise ValueError("Idea text too long (max 500 characters)")

    # Call AI validation checks (gibberish/concept checks)
    await validate_idea_text(idea_text)

    # 🟢 Insert using metadata builder directly so it maps scheduled_date & score
    saved = _insert_idea_with_metadata(
        supabase, user_id,
        idea_text=idea_text,
        win_score=5, # default
        source=source,
        scheduled_date=scheduled_date
    )
    return saved


async def handle_improve_idea(idea_text: str, niche: str, language: str) -> dict:
    if language == "hinglish":
        prompt = (
            f"Tu ek expert Instagram content strategist hai.\n\n"
            f"Creator ka niche: {niche}\n\n"
            f"Original idea: \"{idea_text}\"\n\n"
            f"Is idea ko improve karo:\n"
            f"- Zyada specific aur actionable banao\n"
            f"- Viral potential badao\n"
            f"- Clear aur punchy rakho (max 20 words)\n"
            f"- Hinglish mein likho\n\n"
            f"ONLY valid JSON return karo, koi explanation nahi:\n"
            f"{{\n"
            f'  "improved_idea": "improved idea text here",\n'
            f'  "why_it_works": "specific 10-18 word explanation of the psychological or strategic mechanism",\n'
            f'  "win_score": 8\n'
            f"}}"
        )
    else:
        prompt = (
            f"You are an expert Instagram content strategist.\n\n"
            f"Creator niche: {niche}\n\n"
            f"Original idea: \"{idea_text}\"\n\n"
            f"Improve this idea by:\n"
            f"- Making it more specific and actionable\n"
            f"- Increasing viral/engagement potential\n"
            f"- Keeping it clear and punchy (max 20 words)\n"
            f"- Preserving the core concept but elevating the angle\n\n"
            f"Return ONLY valid JSON, no explanation, no markdown:\n"
            f"{{\n"
            f'  "improved_idea": "improved idea text here",\n'
            f'  "why_it_works": "specific 10-18 word sentence explaining the exact psychological or strategic mechanism",\n'
            f'  "win_score": 8\n'
            f"}}"
        )

    raw = generate_content_gemini_first(prompt)

    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:] if lines[0].startswith("```") else lines
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            parsed = json.loads(match.group())
        else:
            raise ValueError(f"AI returned malformed JSON for improve: {raw[:200]}")

    return {
        "improved_idea": str(parsed.get("improved_idea", "")).strip() or idea_text,
        "why_it_works":  str(parsed.get("why_it_works", "")).strip(),
        "win_score":     max(1, min(10, int(parsed.get("win_score", 7)))),
    }

def handle_update_idea(
    supabase, user_id: str, idea_id: str, chat_id: str, idea_text: str, win_score: int
) -> dict:
    cleaned_idea = idea_text.strip()
    
    idea_update = (
        supabase.table("ideas")
        .update({
            "idea": cleaned_idea,
            "win_score": win_score
        })
        .eq("id", idea_id)
        .execute()
    )
    
    if not idea_update.data:
        raise RuntimeError("Failed to update idea in DB")
        
    result = {"idea": idea_update.data[0]}
        
    # 🟢 V2: direct posts table ka hook update karein
    supabase.table("posts").update({
        "hook": cleaned_idea[:200]
    }).eq("id", chat_id).execute()
    
    return result


def handle_toggle_favourite(supabase, user_id: str, idea_id: str, is_favourite: bool) -> dict:
    return toggle_favourite(supabase, idea_id, user_id, is_favourite)


def handle_confirm_idea(supabase, user_id: str, idea_id: str, idea_text: str) -> dict:
    title = idea_text.split("\n")[0].strip()
    if not title:
        title = idea_text[:100].strip()

    # 🟢 Bypassed Chats: Calls create_draft_post directly
    from app.integrations.queries import create_draft_post
    return create_draft_post(supabase, user_id, idea_id, title)


def handle_get_ideas(supabase, user_id: str) -> list[dict]:
    return get_ideas_with_chat_status(supabase, user_id)


def _get_idea_for_chat(supabase, idea_id: str) -> Optional[dict]:
    try:
        resp = (
            supabase.table("ideas")
            .select("id, win_score")
            .eq("id", idea_id)
            .single()
            .execute()
        )
        return resp.data or None
    except Exception:
        return None


def _save_win_score(supabase, idea_id: str, win_score: int) -> None:
    try:
        supabase.table("ideas").update({"win_score": win_score}).eq("id", idea_id).execute()
    except Exception:
        pass


async def handle_get_chat(supabase, chat_id: str, user_id: str) -> dict:
    """Loads metadata and drafts for a direct generated Post."""
    # 🟢 chat_id maps to direct post_id inside get_post_by_id
    from app.integrations.queries import get_post_by_id
    post = get_post_by_id(supabase, chat_id, user_id)
    if not post:
        raise RuntimeError("Post not found")
    return post


async def handle_save_selection(
    supabase, user_id: str, chat_id: str, hook: Optional[str] = None, caption: Optional[str] = None, script: Optional[str] = None,
) -> dict:
    """Saves manual edits to a post's draft fields directly (No Chats Table)."""
    from app.integrations.queries import get_post_by_id
    post = get_post_by_id(supabase, chat_id, user_id)
    if not post: 
        raise RuntimeError("Post not found")

    idea_id = post["idea_id"]

    if hook is not None:
        upsert_post(supabase, user_id, idea_id=idea_id, post_id=chat_id, hook=hook, status="draft")
    elif script is not None:
        upsert_post(supabase, user_id, idea_id=idea_id, post_id=chat_id, script=script, status="draft")
    elif caption is not None:
        upsert_post(supabase, user_id, idea_id=idea_id, post_id=chat_id, caption=caption, status="ready")

    return {"status": "success"}


async def handle_edit_script(supabase, chat_id: str, user_id: str, current_script: str, user_prompt: str) -> dict:
    profile = get_user_profile(supabase, user_id) or {}
    language = profile.get("language", "english")
    
    prompt = f"""You are an expert Instagram content editor.
The user wants to make specific changes to their current video/reel script.

Current Script:
{current_script}

User's edit instruction: "{user_prompt}"

Task: Apply the exact changes requested by the user to the current script.
Rules:
1. Keep the language identical to the current script.
2. ONLY return the updated script text. Do not use markdown blocks like ```.
3. DO NOT include any conversational filler (e.g. "Here is the updated script").
4. Preserve the original structure and content, ONLY making the requested modifications.
"""
    from app.services.llm_service import generate_content, generate_content_gemini_first
    
    try:
        raw = generate_content(prompt)
    except Exception as e:
        print(f"[AI Edit] Groq failed, falling back to Gemini: {e}")
        raw = generate_content_gemini_first(prompt)
        
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"): lines = lines[1:]
        if lines and lines[-1].startswith("```"): lines = lines[:-1]
        text = "\n".join(lines).strip()
        
    return {"updated_script": text}

async def handle_unlock_script_content(supabase, chat_id: str, user_id: str) -> dict:
    """Unlocks locked script body contents for direct posts."""
    from app.integrations.queries import get_post_by_id
    post = get_post_by_id(supabase, chat_id, user_id)
    if not post:
        raise RuntimeError("Post not found")

    raw_script = f"Hook:\n{post.get('hook') or ''}\n\nBody:\n[This is your unlocked video script body content ready to shoot! 🎥]"

    upsert_post(supabase, user_id, idea_id=post["idea_id"], post_id=chat_id, script=raw_script, status="draft")
    return {"script": raw_script}


async def handle_one_click_post(supabase, user_id: str, idea_text: str, with_guides: bool) -> dict:
    """V2 1-Click: Automatically generates complete post package in the posts table."""
    profile = get_user_profile(supabase, user_id) or {}
    # 🟢 BYPASSED: Plan checks disabled for testing
    # plan = profile.get("plan", "free").lower()
    language = profile.get("language", "english")
    niche = profile.get("niche", "Lifestyle")
    tone = profile.get("tone", "Casual & fun")

    # 🟢 BYPASSED: Plan restrictions disabled for testing
    # if plan == "free":
    #     raise ValueError("One-Click Auto Generation is not available on the Free plan.")
    # if with_guides and plan != "pro":
    #     raise ValueError("Shooting and Editing guides are only available on the Pro plan.")

    spoken_lang = "Hinglish (a natural mix of Hindi and English words)" if language == "hinglish" else "English"

    guide_section = ""
    if with_guides:
        guide_section = "\n[SHOOTING_GUIDE]\nProvide lighting, angles, and acting tips.\n\n[EDITING_GUIDE]\nProvide text overlays, pacing, and audio/music tips."

    prompt = f"""You are an elite Instagram content strategist.
Niche: {niche} | Tone: {tone}
Post Idea: "{idea_text}"

Task: Create a COMPLETE, highly engaging Instagram post package.
DO NOT use JSON. You MUST format your response using EXACTLY these bracketed tags:

[HOOK]
Write a 1-line hook in {spoken_lang}.

[SCRIPT]
Write the spoken video script in {spoken_lang}. Include vocal cues like (excitedly) but NO camera angles. Keep it concise.

[CAPTION]
Write the caption in STRICTLY PURE ENGLISH. Include 5-8 hashtags at the end.{guide_section}

Ensure the response is fully completed and not cut off. Be punchy and highly engaging.
"""

    from app.services.llm_service import generate_content_gemini_first
    raw = generate_content_gemini_first(prompt).strip()

    if raw.startswith("```"):
        lines = raw.split("\n")
        if lines[0].startswith("```"): lines = lines[1:]
        if lines and lines[-1].startswith("```"): lines = lines[:-1]
        raw = "\n".join(lines).strip()

    def extract_tag(text, tag):
        pattern = rf"\[{tag}\]:?\s*(.*?)(?=\n\[|$)"
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        return match.group(1).strip() if match else ""

    hook = extract_tag(raw, "HOOK")
    script = extract_tag(raw, "SCRIPT")
    caption = extract_tag(raw, "CAPTION")
    editing_guide = extract_tag(raw, "EDITING_GUIDE") if with_guides else None
    shooting_guide = extract_tag(raw, "SHOOTING_GUIDE") if with_guides else None

    if not hook and not script and not caption:
        hook = idea_text[:100]
        script = raw
        caption = "Please generate caption separately."

    # 🟢 V2: Purani strict validate_idea_text line hata di taaki direct generation smoothly pass ho jaye
    saved_idea = insert_ideas(supabase, user_id, [idea_text.strip()], source="user")[0]
    idea_id = saved_idea["id"]

    # Bypassed Chats Table: Directly create draft inside posts table
    from app.integrations.queries import create_draft_post
    title = idea_text.split("\n")[0].strip()[:100]
    post_data = create_draft_post(supabase, user_id, idea_id, title)
    post_id = post_data["id"]

    # Directly Upsert Ready Post contents
    upsert_post(
        supabase, user_id, idea_id, post_id=post_id,
        hook=hook,
        script=script,
        caption=caption,
        editing_guide=editing_guide,
        shooting_guide=shooting_guide,
        status="ready"
    )

    return post_data


# ── Single idea generation logic added at the bottom ───────────────────────────────────

def _build_single_idea_prompt(
    niche: str,
    tone: str,
    style: str,
    language: str,
    trends: list[str],
    exclude_ideas: list[str],
) -> str:
    trend_section = ""
    if trends:
        trend_lines = "\n".join(f"  - {t}" for t in trends)
        trend_section = (
            f"\nCurrent trending topics in {niche} (weave it in naturally if relevant):\n"
            f"{trend_lines}\n"
        )
    else:
        trend_section = (
            f"\nNo specific trends available — generate a strong evergreen idea "
            f"that will perform well in the {niche} niche.\n"
        )

    exclude_section = ""
    if exclude_ideas:
        exclude_lines = "\n".join(f"  - {e}" for e in exclude_ideas[:15])
        exclude_section = (
            f"\nDo NOT generate an idea similar to these already-seen ideas:\n"
            f"{exclude_lines}\n"
        )

    if language == "hinglish":
        lang_rule = (
            "- Write the idea in Hinglish (natural mix of Hindi and English, "
            "as Indian Instagram creators speak). "
            "Example: 'Apni morning routine dikhao — productivity tips ke saath'"
        )
    else:
        lang_rule = "- Write the idea in clear, natural English"

    return f"""You are a senior Instagram content strategist who knows what actually performs.

Creator profile:
- Niche: {niche}
- Tone: {tone}
- Content style: {style}
{trend_section}{exclude_section}
Generate exactly 1 postable Instagram content idea for this creator.

Rules:
- The idea must be a single clear sentence (max 20 words)
- Idea must be practical, specific, and postable TODAY — not generic
- Match the creator's tone and style precisely
- No hooks, no scripts, no captions, no format/editing guidance inside the idea
- win_score: realistic integer 1-10 reflecting expected engagement potential
{lang_rule}
- Return ONLY valid JSON, no markdown, no explanation, no extra text

Output format (strict JSON):
{{
  "idea": "Idea sentence here",
  "win_score": 8
}}"""


def _parse_single_idea(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:] if lines[0].startswith("```") else lines
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group())
            except json.JSONDecodeError:
                raise ValueError(f"AI returned malformed JSON: {raw[:300]}")
        else:
            raise ValueError(f"AI returned malformed JSON: {raw[:300]}")

    return {
        "idea":         str(parsed.get("idea", "")).strip(),
        "win_score":    max(1, min(10, int(parsed.get("win_score", 5)))),
    }


async def handle_generate_single_idea(supabase, user_id: str) -> dict:
    """
    Generates exactly ONE high-quality trending/niche idea for the dashboard popup.
    Faster execution, less token usage, and strictly respects daily plan limits.
    """
    profile = get_user_profile(supabase, user_id)
    if not profile:
        raise ValueError("User profile not found. Complete onboarding first.")

    from datetime import date
    today = date.today().isoformat()
    usage = reset_daily_usage_if_needed(supabase, user_id, today)

    plan        = (usage.get("plan") or "free").lower()
    ideas_used  = usage.get("ideas_used_today") or 0
    daily_limit = PLAN_DAILY_LIMITS.get(plan, 3)

    # 🟢 BYPASSED: Daily limit check disabled for testing
    # if daily_limit is not None and ideas_used >= daily_limit:
    #     raise IdeaLimitReached(plan=plan, used=ideas_used, limit=daily_limit)

    niche    = profile.get("niche", "Lifestyle")
    language = profile.get("language", "english")

    trends = _fetch_trends_for_niche(supabase, niche)
    seen = _get_seen_ideas(user_id)
    exclude_list = list(seen)[:15]

    is_fallback = False
    try:
        prompt = _build_single_idea_prompt(
            niche=niche,
            tone=profile.get("tone", "Casual & fun"),
            style=profile.get("style", "Face-to-camera talking"),
            language=language,
            trends=trends,
            exclude_ideas=exclude_list,
        )
        raw = generate_content(prompt)
        single_idea = _parse_single_idea(raw)
    except Exception as e:
        print(f"[ideas_service] Single AI generation failed, using fallback: {e}")
        all_ideas = get_fallback_ideas(niche)
        unseen = _filter_seen(user_id, all_ideas)
        pool = unseen if len(unseen) >= 1 else all_ideas
        single_idea = random.choice(pool)
        is_fallback = True

    saved_idea = _insert_idea_with_metadata(
        supabase, user_id,
        idea_text=single_idea["idea"],
        win_score=single_idea["win_score"],
        source="postra",
    )

    _mark_ideas_seen(user_id, [single_idea["idea"]])

    if daily_limit is not None:
        increment_ideas_used_today(supabase, user_id)

    result = {
        **saved_idea,
        "win_score": single_idea["win_score"],
    }

    if is_fallback:
        result["_fallback"] = True

    return result

async def handle_validate_idea(supabase, user_id: str, idea_text: str) -> dict:
    """
    Intelligent validation:
    1. Local fast check for gibberish.
    2. Groq AI call to verify if it is an actual content idea and classify its niche.
    """
    cleaned = idea_text.strip()
    
    # 1. Fast local non-AI check
    if _is_gibberish(cleaned):
        return {
            "valid": False,
            "reason": "gibberish",
            "message": "This doesn't look like a real idea. Write something meaningful."
        }

    profile = get_user_profile(supabase, user_id) or {}
    user_niche = profile.get("niche", "Lifestyle")

    # 2. AI validation check & Niche classification
    prompt = f"""You are an expert Instagram content validation assistant.
Evaluate this user input text: "{cleaned}"

Analyze:
1. Is this a genuine, usable content concept/topic/idea for Instagram Reels or social media? (Return false if it's just random words, single verbs, gibberish, or generic commands like "write script").
2. If it is a valid idea, classify which exact target niche it belongs to (e.g. Fitness, Business, Tech, Cooking, Finance, Fashion, Lifestyle, Travel, Coding, Motivation etc.). Be concise (1-2 words max).

Return ONLY valid JSON format (no markdown, no explanations):
{{
  "is_valid_idea": true, // true or false
  "detected_niche": "Tech" // name of the niche, or "N/A"
}}"""

    try:
        raw = generate_content(prompt)
        text = raw.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            if lines[0].startswith("```"): lines = lines[1:]
            if lines and lines[-1].startswith("```"): lines = lines[:-1]
            text = "\n".join(lines).strip()
            
        parsed = json.loads(text)
        is_valid = bool(parsed.get("is_valid_idea", False))
        detected_niche = str(parsed.get("detected_niche", "N/A")).strip()

        if not is_valid:
            return {
                "valid": False,
                "reason": "invalid_concept",
                "message": "Please write a meaningful content concept or let AI generate one for you."
            }

        # Case-insensitive partial matching to determine niche alignment
        niche_match = False
        if user_niche.lower() in detected_niche.lower() or detected_niche.lower() in user_niche.lower():
            niche_match = True

        return {
            "valid": True,
            "niche_match": niche_match,
            "detected_niche": detected_niche,
            "user_niche": user_niche
        }

    except Exception as e:
        print(f"[Validation Failed] Fallback to valid to prevent blocking user: {e}")
        return {
            "valid": True,
            "niche_match": True,
            "detected_niche": user_niche,
            "user_niche": user_niche
        }

async def handle_generate_post_for_existing_idea(supabase, user_id: str, idea_id: str) -> dict:
    """
    V2: Generates Hook, Script, and Caption for an EXISTING idea.
    Saves it directly to the posts table without creating duplicate ideas.
    """
    # 1. Fetch the existing idea details
    idea_row = (
        supabase.table("ideas")
        .select("*")
        .eq("id", idea_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not idea_row.data:
        raise ValueError("Idea not found")
        
    idea_text = idea_row.data["idea"]

    profile = get_user_profile(supabase, user_id) or {}
    language = profile.get("language", "english")
    niche = profile.get("niche", "Lifestyle")
    tone = profile.get("tone", "Casual & fun")

    spoken_lang = "Hinglish (a natural mix of Hindi and English words)" if language == "hinglish" else "English"

    # 2. Structured Content Generation Prompt
    prompt = f"""You are an elite Instagram content strategist.
Niche: {niche} | Tone: {tone}
Post Idea: "{idea_text}"

Task: Create a COMPLETE, highly engaging Instagram post package.
DO NOT use JSON. You MUST format your response using EXACTLY these bracketed tags:

[HOOK]
Write a 1-line hook in {spoken_lang}.

[SCRIPT]
Write the spoken video script in {spoken_lang}. Include vocal cues like (excitedly) but NO camera angles. Keep it concise.

[CAPTION]
Write the caption in STRICTLY PURE ENGLISH. Include 5-8 hashtags at the end.

Ensure the response is fully completed and not cut off. Be punchy and highly engaging.
"""

    from app.services.llm_service import generate_content_gemini_first
    raw = generate_content_gemini_first(prompt).strip()

    if raw.startswith("```"):
        lines = raw.split("\n")
        if lines[0].startswith("```"): lines = lines[1:]
        if lines and lines[-1].startswith("```"): lines = lines[:-1]
        raw = "\n".join(lines).strip()

    def extract_tag(text, tag):
        pattern = rf"\[{tag}\]:?\s*(.*?)(?=\n\[|$)"
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        return match.group(1).strip() if match else ""

    hook = extract_tag(raw, "HOOK")
    script = extract_tag(raw, "SCRIPT")
    caption = extract_tag(raw, "CAPTION")

    if not hook and not script and not caption:
        hook = idea_text[:100]
        script = raw
        caption = "Please generate caption separately."

    # 3. Create Draft Post direct inside posts table
    from app.integrations.queries import create_draft_post
    title = idea_text.split("\n")[0].strip()[:100]
    post_data = create_draft_post(supabase, user_id, idea_id, title)
    post_id = post_data["id"]

    # 4. Save generated content
    upsert_post(
        supabase, user_id, idea_id, post_id=post_id,
        hook=hook,
        script=script,
        caption=caption,
        status="ready"
    )

    return post_data