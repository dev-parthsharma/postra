# backend/app/services/ideas_service.py

import json
import random
import re
from typing import Optional
from app.core.settings import settings
from app.services.llm_service import generate_content, generate_content_gemini_first
from app.services.fallback_ideas import get_fallback_ideas

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
    return[i for i in ideas if _cache_key(i.get("idea", "")) not in seen]


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
    meaningful =[t for t in tokens if len(t) > 1]
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
        return[]


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
- why_it_works: Write a compelling 1-sentence explanation (10-18 words) that clearly explains the SPECIFIC psychological or strategic reason this content format performs well. Be concrete and specific — avoid vague words like "relatable", "engaging", "valuable". Instead name the exact mechanism: save-triggers, comment-bait, identity-signaling, FOMO, authority-building, curiosity gaps, etc.
{lang_rule}
- Return ONLY valid JSON, no markdown, no explanation, no extra text

Output format (strict JSON):
{{
  "recommended": {{
    "idea": "Idea sentence here",
    "why_it_works": "Specific 10-18 word sentence explaining the exact psychological or strategic mechanism",
    "win_score": 8
  }},
  "alternatives":[
    {{
      "idea": "Alternative idea one",
      "why_it_works": "Specific 10-18 word sentence explaining the exact psychological or strategic mechanism",
      "win_score": 7
    }},
    {{
      "idea": "Alternative idea two",
      "why_it_works": "Specific 10-18 word sentence explaining the exact psychological or strategic mechanism",
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
            "why_it_works": str(obj.get("why_it_works", "")).strip(),
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
            "why_it_works": "Authentic daily content builds strong personal connection with audiences who crave transparency",
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

    if daily_limit is not None and ideas_used >= daily_limit:
        raise IdeaLimitReached(plan=plan, used=ideas_used, limit=daily_limit)

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

    _mark_ideas_seen(user_id, [rec["idea"], alt1["idea"], alt2["idea"]])

    if daily_limit is not None:
        increment_ideas_used_today(supabase, user_id)

    result = {
        "recommended": {
            **saved_rec,
            "why_it_works": rec["why_it_works"],
            "win_score": rec["win_score"],
        },
        "alternatives":[
            {**saved_alt1, "why_it_works": alt1["why_it_works"], "win_score": alt1["win_score"]},
            {**saved_alt2, "why_it_works": alt2["why_it_works"], "win_score": alt2["win_score"]},
        ],
    }

    if is_fallback:
        result["_fallback"] = True

    return result


def _insert_idea_with_metadata(
    supabase,
    user_id: str,
    idea_text: str,
    why_it_works: str,
    win_score: int,
    source: str,
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
        err_str = str(e).lower()
        if "why_it_works" in err_str or "win_score" in err_str or "column" in err_str:
            minimal_row = {
                "user_id":      user_id,
                "idea":         cleaned,
                "source":       source,
                "is_favourite": False,
            }
            resp = supabase.table("ideas").insert(minimal_row).execute()
            if not resp.data:
                raise RuntimeError("Failed to insert idea (fallback)")
            result = resp.data[0]
            result["why_it_works"] = why_it_works
            result["win_score"]    = win_score
            return result
        raise


async def handle_save_user_idea(supabase, user_id: str, idea_text: str) -> dict:
    idea_text = idea_text.strip()
    if not idea_text:
        raise IdeaInvalid("Idea text cannot be empty")
    if len(idea_text) > 500:
        raise ValueError("Idea text too long (max 500 characters)")

    await validate_idea_text(idea_text)

    saved = insert_ideas(supabase, user_id, [idea_text], source="user")
    return saved[0]


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
    supabase, user_id: str, idea_id: str, chat_id: str, idea_text: str, why_it_works: str, win_score: int
) -> dict:
    cleaned_idea = idea_text.strip()
    
    idea_update = (
        supabase.table("ideas")
        .update({
            "idea": cleaned_idea,
            "why_it_works": why_it_works.strip(),
            "win_score": win_score
        })
        .eq("id", idea_id)
        .execute()
    )
    
    if not idea_update.data:
        raise RuntimeError("Failed to update idea in DB")
        
    result = {"idea": idea_update.data[0]}
        
    supabase.table("chats").update({
        "title": cleaned_idea[:250]
    }).eq("id", chat_id).execute()
    
    try:
        from app.integrations.queries import get_user_profile
        from app.services.chat_messages import get_static_opening_message
        
        profile = get_user_profile(supabase, user_id) or {}
        new_text = get_static_opening_message(
            win_score=win_score,
            language=profile.get("language", "english"),
            niche=profile.get("niche", "Lifestyle"),
            tone=profile.get("tone", "Casual & fun"),
            goal=profile.get("goal", "grow followers"),
            style=profile.get("style", "Face-to-camera talking"),
        )
        
        msg_resp = (
            supabase.table("messages")
            .select("id")
            .eq("chat_id", chat_id)
            .eq("source", "assistant")
            .order("sequence")
            .limit(1)
            .execute()
        )
        
        if msg_resp.data:
            msg_id = msg_resp.data[0]["id"]
            supabase.table("messages").update({
                "content": new_text,
                "metadata": {"win_score": win_score}
            }).eq("id", msg_id).execute()
            
            result["new_opening_message"] = new_text
            
    except Exception as e:
        print(f"[handle_update_idea] chat/message sync failed: {e}")
        
    return result


def handle_toggle_favourite(supabase, user_id: str, idea_id: str, is_favourite: bool) -> dict:
    return toggle_favourite(supabase, idea_id, user_id, is_favourite)


def handle_confirm_idea(supabase, user_id: str, idea_id: str, idea_text: str) -> dict:
    title = idea_text.split("\n")[0].strip()
    if not title:
        title = idea_text[:100].strip()
    return create_chat(supabase, user_id, idea_id, title)


def handle_get_ideas(supabase, user_id: str) -> list[dict]:
    return get_ideas_with_chat_status(supabase, user_id)


def _call_llm(messages: list[dict], max_tokens: int = 600) -> str:
    prompt = "\n\n".join(
        f"[{m['role'].upper()}]\n{m['content']}" for m in messages
    )
    return generate_content(prompt)


def _derive_stage(messages: list[dict]) -> str:
    if not messages:
        return "intro"
    has_user_message = any(m["source"] == "user" for m in messages)
    if not has_user_message:
        return "intro"
    return "chatting"


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


async def _generate_opening_with_score(
    idea_title: str,
    language: str,
    niche: str,
    tone: str,
    goal: str,
    style: str,
) -> tuple[str, Optional[int]]:
    if language == "hinglish":
        prompt = (
            f"Tu Postra hai — sharp Instagram content assistant.\n"
            f"Creator ka idea: \"{idea_title}\"\n"
            f"Niche: {niche} | Tone: {tone} | Goal: {goal}\n\n"
            f"Do kaam karo:\n"
            f"1. Is idea ko 1-10 score do (win_score) — engagement potential ke basis pe\n"
            f"2. Short opening message likho (2-3 sentences, Hinglish, max 2 emojis)\n"
            f"   - Honest reaction, hype nahi\n"
            f"   - Hooks/caption ke liye offer karo\n\n"
            f"ONLY valid JSON return karo:\n"
            f'{{ "win_score": 7, "message": "Ye concept solid lag raha hai — hooks se start karein?" }}'
        )
    else:
        prompt = (
            f"You are Postra — a sharp Instagram content assistant.\n"
            f"Creator's idea: \"{idea_title}\"\n"
            f"Niche: {niche} | Tone: {tone} | Goal: {goal}\n\n"
            f"Do two things:\n"
            f"1. Score this idea 1-10 (win_score) based on engagement potential\n"
            f"2. Write a short opening message (2-3 sentences, max 2 emojis)\n"
            f"   - Honest reaction, not hype\n"
            f"   - Offer to start with hooks/caption\n\n"
            f"Return ONLY valid JSON:\n"
            f'{{ "win_score": 7, "message": "This has a solid angle — want to start with hooks?" }}'
        )

    try:
        raw = _call_llm([{"role": "user", "content": prompt}], max_tokens=150)
        text = raw.strip()
        if text.startswith("```"):
            lines = text.split("\n")[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines).strip()
        parsed  = json.loads(text)
        message = str(parsed.get("message", "")).strip().strip('"').strip("'")
        score   = max(1, min(10, int(parsed.get("win_score", 5))))
        if not message:
            raise ValueError("empty message from Groq")
        return message, score
    except Exception as e:
        print(f"[chat open] Groq scoring failed, using generic fallback: {e}")
        fallback = (
            "Idea dekh liya — hooks se shuru karein? 🔥"
            if language == "hinglish"
            else "Idea looks good — want to start with some hooks? 🔥"
        )
        return fallback, None


async def handle_get_chat(supabase, chat_id: str, user_id: str) -> dict:
    chat = get_chat_by_id(supabase, chat_id, user_id)
    if not chat:
        raise RuntimeError("Chat not found")

    messages = get_messages_for_chat(supabase, chat_id)
    stage    = _derive_stage(messages)

    if not messages:
        profile  = get_user_profile(supabase, user_id) or {}
        language = profile.get("language", "english")
        niche    = profile.get("niche", "Lifestyle")
        tone     = profile.get("tone", "Casual & fun")
        goal     = profile.get("goal", "grow followers")
        style    = profile.get("style", "Face-to-camera talking")

        idea_row  = _get_idea_for_chat(supabase, chat["idea_id"])
        win_score = idea_row.get("win_score") if idea_row else None

        if win_score is not None:
            from app.services.chat_messages import get_static_opening_message
            opening_text = get_static_opening_message(
                win_score=win_score,
                language=language,
                niche=niche,
                tone=tone,
                goal=goal,
                style=style,
            )
        else:
            opening_text, inferred_score = await _generate_opening_with_score(
                idea_title=chat["title"],
                language=language,
                niche=niche,
                tone=tone,
                goal=goal,
                style=style,
            )
            if inferred_score is not None and idea_row:
                _save_win_score(supabase, chat["idea_id"], inferred_score)
            win_score = inferred_score

        seq = get_next_sequence(supabase, chat_id)
        ai_msg = insert_message(
            supabase,
            chat_id=chat_id,
            sequence=seq,
            content=opening_text,
            source="assistant",
            msg_type="text",
            metadata={"win_score": win_score, "cta": "generate_hooks", "cta_text": "Generate Hooks 🚀"},
        )
        messages =[ai_msg]
        stage    = "intro"

    return {**chat, "stage": stage, "messages": messages}


def _route_message_intent(
    history_text: str, user_message: str, language: str, niche: str, tone: str, plan: str, 
    hook_count: int, script_count: int, caption_count: int, max_gens: int
) -> dict:
    prompt = f"""You are the core "Brain" of Postra — an elite, sharp, and highly intelligent Instagram content creation SaaS.
Your job is to understand the user's current intent based on the conversation history and their profile, and route them to the correct action.

--- USER PROFILE AWARENESS ---
- Niche: {niche}
- Tone: {tone}
- Language: {language} (If Hinglish, mix Hindi & English naturally like Indian creators)
- Subscription Plan: {plan.upper()}

--- POSTRA'S CURRENT PROGRESS & LIMITS ---
Max generations allowed per step on this plan: {max_gens}
- Hooks Generated: {hook_count} / {max_gens}
- Script Generated: {script_count} / 1
- Captions Generated: {caption_count} / {max_gens}

--- CATEGORIES (Return one of these in "action") ---
- "generate_hooks": Wants hooks, opening lines, or modifications to hooks.
- "generate_script": Wants a video/reel script or dialogue.
- "generate_shooting_guide": Wants camera angles, lighting, acting instructions.
- "generate_editing_guide": Wants editing tips, text overlays, sound design.
- "generate_caption": Wants a caption or hashtags.
- "generate_other": Wants to generate something else valid for Instagram.
- "chat": Casual greetings, agreements, OR handling limit/premium errors.
- "unrelated": Questions completely outside Instagram/content creation.

--- POSTRA'S CONVERSATIONAL RULES (For "chat" or "unrelated" replies) ---
If the action is "chat" or "unrelated", you MUST write a response in the `reply` field acting as Postra:
1. If they ask to generate something they have ALREADY reached the limit for (e.g. caption is {caption_count}/{max_gens}), strictly select "chat" and politely tell them they have already generated it or reached their limit. DO NOT offer to generate it again.
2. If they ask for a premium feature locked on their '{plan.upper()}' plan, politely explain it's a premium feature and suggest upgrading.
3. Keep replies short, punchy, and use max 1-2 emojis.

Recent History:
{history_text}

Latest User Message: "{user_message}"

Return ONLY valid JSON format:
{{
    "action": "<category>",
    "reply": "<if action is chat/unrelated, write Postra's smart response here. Else leave empty>"
}}"""
    
    try:
        raw = _call_llm([{"role": "user", "content": prompt}], max_tokens=350)
        text = raw.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            if lines[0].startswith("```"): lines = lines[1:]
            if lines and lines[-1].startswith("```"): lines = lines[:-1]
            text = "\n".join(lines).strip()
            
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return json.loads(match.group())
        return json.loads(text)
    except Exception as e:
        print(f"[Router Error] Failed to parse intent: {e}")
        return {"action": "generate_other", "reply": ""}


def _generate_specialized_content(
    action: str, idea_title: str, user_message: str, history_text: str, niche: str, tone: str, language: str
) -> str:
    instructions = {
        "generate_hooks": "Generate or refine highly engaging Instagram Reel hooks (text only).",
        "generate_caption": "Write or refine an Instagram caption. Include relevant hashtags at the bottom.",
        "generate_script": (
            "Write the script in this EXACT format with explicit headings:\n\n"
            "Hook:\n"
            "[The exact hook the user previously selected]\n\n"
            "Body:\n"
            "[Write a simple, raw, and powerful script. Focus on strong pacing and natural speaking rhythm using short sentences and line breaks. DO NOT use bracketed speaking instructions or pause markers.]\n\n"
            "CTA:\n"
            "[The final Call to Action line]\n\n"
            "Do NOT include visual cues, camera angles, or B-roll descriptions. Focus entirely on the vocal delivery format."
        ),
        "generate_editing_guide": "Provide a concise, practical editing guide tailored to the current script. Include suggestions for text overlays, pacing, cuts, and sound effects/music vibe. Format nicely with bullet points.",
        "generate_shooting_guide": "Provide a concise, practical shooting guide tailored to the current script. Include suggestions for camera angles, lighting, B-roll shots to capture, and acting/delivery tips. Format nicely with bullet points.",
        "generate_other": "Fulfill the user's content request related to this post."
    }
    
    instruction = instructions.get(action, instructions["generate_other"])
    
    lang_rule = "- Write in Hinglish (a natural mix of Hindi and English)." if language == "hinglish" else "- Write in clear, engaging English."
    
    if action == "generate_caption":
        lang_rule += "\n- STRICT RULE: The CAPTION TEXT ITSELF MUST ALWAYS BE PURE ENGLISH, because English captions get better reach. If you need to explain things, you can use the user's language, but the actual caption block must be English."
        
    prompt = f"""You are an elite Instagram content strategist.
Niche: {niche} | Tone: {tone}
Post Idea: "{idea_title}"

Your task: {instruction}
{lang_rule}

Recent conversation context:
{history_text}

User's current request: "{user_message}"

Provide exactly what the user asked for based on the context. Be direct, practical, and highly engaging.
Do NOT use generic conversational filler like "Here are your hooks:" or "Here is your script:". Just output the high-value content directly.
"""
    from app.services.llm_service import generate_content_gemini_first
    return generate_content_gemini_first(prompt)


async def handle_send_message(supabase, chat_id: str, user_id: str, content: str, intent: Optional[str] = None) -> dict:
    chat = get_chat_by_id(supabase, chat_id, user_id)
    if not chat:
        raise RuntimeError("Chat not found")

    messages = get_messages_for_chat(supabase, chat_id)
    profile = get_user_profile(supabase, user_id) or {}
    language = profile.get("language", "english")
    niche = profile.get("niche", "Lifestyle")
    tone = profile.get("tone", "Casual & fun")
    plan = profile.get("plan", "free").lower()

    seq = get_next_sequence(supabase, chat_id)
    user_msg = insert_message(
        supabase, chat_id=chat_id, sequence=seq, content=content,
        source="user", msg_type="text", metadata=None,
    )

    history_lines = []
    for m in messages[-4:]:
        role = "AI" if m["source"] == "assistant" else "User"
        history_lines.append(f"{role}: {m['content']}")
    history_text = "\n".join(history_lines)

    metadata = None

    # ── CALCULATE LIMITS FIRST SO BRAIN KNOWS ──
    hook_count = sum(1 for m in messages if m.get("metadata") and isinstance(m["metadata"], dict) and m["metadata"].get("type") == "hook_selection")
    
    all_script_msgs =[m for m in messages if m.get("metadata") and isinstance(m["metadata"], dict) and m["metadata"].get("type") == "editable_script"]
    script_count = len(all_script_msgs)
    locked_script_count = sum(1 for m in all_script_msgs if m["metadata"].get("is_locked"))
    real_script_count = script_count - locked_script_count
    
    caption_count = sum(1 for m in messages if m.get("metadata") and isinstance(m["metadata"], dict) and m["metadata"].get("type") == "caption_selection")
    max_generations = 3 if plan == "pro" else (2 if plan == "starter" else 1)

    # ── ROUTING INTENTS ──
    if intent == "generate_hooks":
        action = "generate_hooks"
        reply_text = ""
    elif intent == "generate_script":
        action = "generate_script"
        reply_text = ""
    elif intent == "generate_caption":
        action = "generate_caption"
        reply_text = ""
    elif intent == "generate_shooting_guide":
        action = "generate_shooting_guide"
        reply_text = ""
    elif intent == "generate_editing_guide":
        action = "generate_editing_guide"
        reply_text = ""
    else:
        # NOW THE BRAIN KNOWS WHAT IS ALREADY GENERATED
        route = _route_message_intent(history_text, content, language, niche, tone, plan, hook_count, real_script_count, caption_count, max_generations)
        action = route.get("action", "generate_other")
        reply_text = route.get("reply", "").strip()

    # ── HARD LIMIT ENFORCEMENT (Failsafe) ──
    if action in["generate_hooks", "generate_hooks_structured"]:
        if script_count >= 1:
            action = "blocked_hook_post_script" 
        elif hook_count >= max_generations:
            action = "blocked_hook" 
    elif action == "generate_script":
        if real_script_count >= 1:
            action = "blocked_script"
        elif script_count >= 1 and plan == "free":
            action = "blocked_script"
    elif action in["generate_caption", "generate_caption_structured"]:
        if caption_count >= max_generations:
            action = "blocked_caption"
    elif action == "generate_shooting_guide" and plan == "free":
        action = "blocked_shooting_guide"
    elif action == "generate_editing_guide" and plan in["free", "starter"]:
        action = "blocked_editing_guide"

    # ── ACTION EXECUTION ──
    
    if action == "blocked_hook_post_script":
        ai_reply_text = "You cannot generate new hooks because the script has already been generated. Please edit the script directly." if language != "hinglish" else "Script pehle hi generate ho chuki hai, naye hooks generate nahi kiye ja sakte. Existing script edit karein."
        metadata = {"limitReached": "hook_post_script"}

    elif action == "blocked_hook":
        ai_reply_text = "You have already reached the hook generation limit for your plan. Please select a hook from the options provided above." if language != "hinglish" else "Hook generation ki limit poori ho gayi hai. Upar diye gaye options mein se select karein."
        metadata = {"limitReached": "hook"}

    elif action == "blocked_script":
        ai_reply_text = "You have already generated a script. Please review and edit the existing script above." if language != "hinglish" else "Aap ek baar script generate kar chuke hain. Kripya existing script ko hi edit karein."
        metadata = {"limitReached": "script"}

    elif action == "blocked_caption":
        ai_reply_text = "You have already reached the caption generation limit for your plan. Please select a caption from the options provided above." if language != "hinglish" else "Caption generation ki limit poori ho gayi hai. Upar diye gaye options mein se select karein."
        metadata = {"limitReached": "caption"}

    elif action == "blocked_shooting_guide":
        ai_reply_text = "Shooting guides are an exclusive feature for Starter and Pro plans! 🎥 Upgrade your plan to get step-by-step camera & lighting guidance." if language != "hinglish" else "Shooting guides sirf Starter aur Pro plan ka premium feature hai! 🎥 Camera angles aur lighting tips ke liye apna plan upgrade karein."

    elif action == "blocked_editing_guide":
        ai_reply_text = "Editing guides are exclusively available on the Pro plan! ✂️ Upgrade your plan to unlock premium text overlay, pacing, and sound design strategies." if language != "hinglish" else "Editing guides sirf Pro plan mein available hain! ✂️ Premium editing, text overlays, aur sound design tips ke liye apna plan upgrade karein."

    elif action in ["chat", "unrelated"] and reply_text:
        ai_reply_text = reply_text

    elif action in["generate_hooks", "generate_hooks_structured"]:
        prompt = f"""You are an elite Instagram content strategist.
Niche: {niche} | Tone: {tone} | Post Idea: "{chat['title']}"
Recent conversation context:
{history_text}
User's current request: "{content}"
Task: Generate exactly 3 highly engaging Instagram Reel hooks based on the user's request.
Rules:
- Short, punchy, curiosity-driven.
- Language: {'Hinglish' if language == 'hinglish' else 'English'}.
- Return ONLY valid JSON format. Do not use markdown blocks.
{{ "hooks":["hook 1", "hook 2", "hook 3"] }}"""
        from app.services.llm_service import generate_content_gemini_first
        try:
            raw = generate_content_gemini_first(prompt).strip()
            if raw.startswith("```"):
                lines = raw.split("\n")
                if lines[0].startswith("```"): lines = lines[1:]
                if lines and lines[-1].startswith("```"): lines = lines[:-1]
                raw = "\n".join(lines).strip()
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match: raw = match.group()
            parsed = json.loads(raw)
            metadata = {"type": "hook_selection", "options": parsed.get("hooks",[])}
            ai_reply_text = "Here are 3 solid hook angles. Pick the one that hits hardest: 🔥" if language != "hinglish" else "Ye rahe 3 solid hook angles. Jo sabse best lage use select karo: 🔥"
        except Exception as e:
            ai_reply_text = "Sorry, I couldn't generate the hooks properly. Try again."

    elif action == "generate_script":
        if plan == "free":
            selected_hook = chat["title"]
            for m in reversed(messages):
                if m["source"] == "user" and ("I want to go with this hook:" in m["content"] or "Main is hook ke sath jaunga:" in m["content"]):
                    selected_hook = m["content"].split("\n\n")[-1].strip()
                    break
            
            raw_script = f"Hook:\n{selected_hook}\n\nBody:\n[LOCKED]\n\nCTA:\n[LOCKED]"
            from app.integrations.queries import upsert_post
            upsert_post(supabase, user_id, chat_id, idea_id=chat["idea_id"], script=raw_script, status="draft")
            
            # SMART CTA DECISION
            if caption_count >= max_generations:
                ai_reply_text = "I've structured your script, but the full body is locked on the Free plan! 🔒 Upgrade to unlock it." if language != "hinglish" else "Script structure ready hai par Free plan mein body locked hai! 🔒 Pura script dekhne ke liye upgrade karein."
                metadata = { "type": "editable_script", "script_text": raw_script, "is_locked": True }
            else:
                ai_reply_text = "I've structured your script, but the full body is locked on the Free plan! 🔒 Upgrade to unlock it, or want me to write a catchy caption?" if language != "hinglish" else "Script structure ready hai par Free plan mein body locked hai! 🔒 Upgrade karke unlock karein, ya ab ek solid caption likhein?"
                metadata = { "type": "editable_script", "script_text": raw_script, "is_locked": True, "cta": "generate_caption", "cta_text": "Write Caption ✍️" }
        else:
            try:
                raw_script = _generate_specialized_content(action=action, idea_title=chat["title"], user_message=content, history_text=history_text, niche=niche, tone=tone, language=language)
                from app.integrations.queries import upsert_post
                upsert_post(supabase, user_id, chat_id, idea_id=chat["idea_id"], script=raw_script, status="draft")

                # SMART CTA DECISION
                if plan in ["starter", "pro"]:
                    ai_reply_text = "Script is ready and auto-saved to your drafts! 🎬 Want me to generate a Shooting Guide for this?" if language != "hinglish" else "Script ready hai aur drafts mein auto-save ho gayi! 🎬 Kya main iska Shooting Guide banaun?"
                    metadata = {"type": "editable_script", "script_text": raw_script, "cta": "generate_shooting_guide", "cta_text": "Get Shooting Guide 🎥"}
                else:
                    if caption_count >= max_generations:
                        ai_reply_text = "Script is ready and auto-saved to your drafts! 🎬" if language != "hinglish" else "Script ready hai aur drafts mein auto-save ho gayi! 🎬"
                        metadata = {"type": "editable_script", "script_text": raw_script}
                    else:
                        ai_reply_text = "Script is ready and auto-saved to your drafts! 🎬 Want me to write a catchy caption?" if language != "hinglish" else "Script ready hai aur drafts mein auto-save ho gayi! 🎬 Ab ek solid caption likhein?"
                        metadata = {"type": "editable_script", "script_text": raw_script, "cta": "generate_caption", "cta_text": "Write Caption ✍️"}
            except Exception as e:
                ai_reply_text = "Mujhe abhi kuch technical issue aa raha hai, please try again. 🙏" if language == "hinglish" else "I'm facing a technical issue right now, please try again in a moment. 🙏"

    elif action == "generate_shooting_guide":
        try:
            raw_guide = _generate_specialized_content(action=action, idea_title=chat["title"], user_message=content, history_text=history_text, niche=niche, tone=tone, language=language)
            supabase.table("posts").update({"shooting_guide": raw_guide}).eq("chat_id", chat_id).execute()

            ai_reply_text = "Here is your detailed Shooting Guide! 🎥" if language != "hinglish" else "Ye raha aapka detailed Shooting Guide! 🎥"
            metadata = {"type": "shooting_guide", "guide_text": raw_guide}

            if plan == "pro":
                ai_reply_text += ("\n\nWant me to generate an Editing Guide?" if language != "hinglish" else "\n\nKya main ab Editing Guide banaun?")
                metadata["cta"] = "generate_editing_guide"
                metadata["cta_text"] = "Get Editing Guide ✂️"
            else:
                if caption_count < max_generations:
                    ai_reply_text += ("\n\nWant me to write a catchy caption?" if language != "hinglish" else "\n\nAb ek solid caption likhein?")
                    metadata["cta"] = "generate_caption"
                    metadata["cta_text"] = "Write Caption ✍️"

        except Exception as e:
            ai_reply_text = "Mujhe shooting guide banane mein technical issue aa raha hai, please try again." if language == "hinglish" else "I'm facing a technical issue generating the shooting guide, please try again."

    elif action == "generate_editing_guide":
        try:
            raw_guide = _generate_specialized_content(action=action, idea_title=chat["title"], user_message=content, history_text=history_text, niche=niche, tone=tone, language=language)
            supabase.table("posts").update({"editing_guide": raw_guide}).eq("chat_id", chat_id).execute()

            ai_reply_text = "Here is your precise Editing Guide! ✂️" if language != "hinglish" else "Ye raha aapka precise Editing Guide! ✂️"
            metadata = {"type": "editing_guide", "guide_text": raw_guide}

            if caption_count < max_generations:
                ai_reply_text += ("\n\nWant me to write a catchy caption?" if language != "hinglish" else "\n\nAb ek solid caption likhein?")
                metadata["cta"] = "generate_caption"
                metadata["cta_text"] = "Write Caption ✍️"
                
        except Exception as e:
            ai_reply_text = "Mujhe editing guide banane mein technical issue aa raha hai, please try again." if language == "hinglish" else "I'm facing a technical issue generating the editing guide, please try again."

    elif action in ["generate_caption", "generate_caption_structured"]:
        prompt = f"""You are an elite Instagram content strategist.
Niche: {niche} | Tone: {tone} | Post Idea: "{chat['title']}"
Recent conversation context:
{history_text}
User's current request: "{content}"
Task: Generate exactly 3 engaging Instagram captions based on the user's request.
Rules:
- The FIRST caption MUST be Medium length.
- The SECOND caption MUST be Short length.
- The THIRD caption MUST be Long length.
- STRICT RULE: The CAPTION TEXT ITSELF MUST ALWAYS BE PURE ENGLISH.
- Return ONLY valid JSON format.
{{ "captions":["medium caption text...", "short caption text...", "long caption text..."] }}"""
        from app.services.llm_service import generate_content_gemini_first
        try:
            raw = generate_content_gemini_first(prompt).strip()
            if raw.startswith("```"):
                lines = raw.split("\n")
                if lines[0].startswith("```"): lines = lines[1:]
                if lines and lines[-1].startswith("```"): lines = lines[:-1]
                raw = "\n".join(lines).strip()
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match: raw = match.group()
            parsed = json.loads(raw)
            metadata = {"type": "caption_selection", "options": parsed.get("captions",[])}
            ai_reply_text = "Here are 3 caption options. Pick the one that fits best: ✨" if language != "hinglish" else "Ye rahe 3 solid captions. Jo sabse sahi lage use select karo: ✨"
        except Exception as e:
            ai_reply_text = "Sorry, I couldn't generate the captions properly. Try again." if language != "hinglish" else "Sorry, caption generate karne mein issue aaya. Phir se try karein."

    else:
        try:
            ai_reply_text = _generate_specialized_content(action=action, idea_title=chat["title"], user_message=content, history_text=history_text, niche=niche, tone=tone, language=language)
        except Exception as e:
            ai_reply_text = "Mujhe abhi kuch technical issue aa raha hai, please try again. 🙏" if language == "hinglish" else "I'm facing a technical issue right now, please try again. 🙏"

    seq2 = get_next_sequence(supabase, chat_id)
    ai_msg = insert_message(supabase, chat_id=chat_id, sequence=seq2, content=ai_reply_text, source="assistant", msg_type="text", metadata=metadata)

    return {"user_message": user_msg, "ai_message": ai_msg, "limitReached": metadata.get("limitReached") if isinstance(metadata, dict) else None}


async def handle_save_selection(
    supabase, user_id: str, chat_id: str, hook: Optional[str] = None, caption: Optional[str] = None, script: Optional[str] = None,
) -> dict:
    chat = get_chat_by_id(supabase, chat_id, user_id)
    if not chat: raise RuntimeError("Chat not found")

    idea_id  = chat["idea_id"]
    profile  = get_user_profile(supabase, user_id) or {}
    language = profile.get("language", "english")

    seq = get_next_sequence(supabase, chat_id)
    user_text = ""
    if hook: user_text = f"I want to go with this hook:\n\n{hook}" if language != "hinglish" else f"Main is hook ke sath jaunga:\n\n{hook}"
    elif script: user_text = f"I updated the script:\n\n{script}" if language != "hinglish" else f"Maine script update kar di:\n\n{script}"
    elif caption: user_text = f"I'll use this caption:\n\n{caption}" if language != "hinglish" else f"Main ye caption use karunga:\n\n{caption}"

    user_msg = insert_message(supabase, chat_id=chat_id, sequence=seq, content=user_text, source="user", msg_type="text", metadata=None)

    metadata = None
    if hook is not None:
        upsert_post(supabase, user_id, chat_id, idea_id=idea_id, hook=hook, caption="", status="draft")
        ai_content = "Hook locked in! 🔒 Ready to write the full script?" if language != "hinglish" else "Hook lock ho gaya! 🔒 Script likhna shuru karein?"
        metadata = {"cta": "generate_script", "cta_text": "Write Full Script 📝"}
    elif script is not None:
        upsert_post(supabase, user_id, chat_id, idea_id=idea_id, script=script, status="draft")
        ai_content = "Script updated successfully! ✅ Want me to write a catchy caption for it?" if language != "hinglish" else "Script update ho gayi! ✅ Ab ek solid caption likhein?"
        metadata = {"cta": "generate_caption", "cta_text": "Write Caption ✍️"}
    elif caption is not None:
        upsert_post(supabase, user_id, chat_id, idea_id=idea_id, caption=caption, status="ready")
        ai_content = "All done! Your post is saved in drafts. 🚀" if language != "hinglish" else "Ho gaya! Post drafts mein save hai. 🚀"

    seq2 = get_next_sequence(supabase, chat_id)
    ai_msg = insert_message(supabase, chat_id=chat_id, sequence=seq2, content=ai_content, source="assistant", msg_type="text", metadata=metadata)

    return {"stage": "chatting", "user_message": user_msg, "ai_message": ai_msg}


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
    profile = get_user_profile(supabase, user_id) or {}
    plan = profile.get("plan", "free").lower()
    
    if plan == "free":
        raise ValueError("Upgrade required to unlock script.")

    chat = get_chat_by_id(supabase, chat_id, user_id)
    if not chat:
        raise RuntimeError("Chat not found")

    messages = get_messages_for_chat(supabase, chat_id)

    # Reconstruct history context
    history_lines = []
    for m in messages[-4:]:
        role = "AI" if m["source"] == "assistant" else "User"
        history_lines.append(f"{role}: {m['content']}")
    history_text = "\n".join(history_lines)

    # Call AI to generate the full script
    raw_script = _generate_specialized_content(
        action="generate_script",
        idea_title=chat["title"],
        user_message="Generate my full script now",
        history_text=history_text,
        niche=profile.get("niche", "Lifestyle"),
        tone=profile.get("tone", "Casual & fun"),
        language=profile.get("language", "english")
    )

    locked_msg = None
    for m in reversed(messages):
        if m["source"] == "assistant" and m.get("metadata") and m["metadata"].get("is_locked"):
            locked_msg = m
            break
    
    if locked_msg:
        new_metadata = dict(locked_msg["metadata"])
        new_metadata["script_text"] = raw_script
        new_metadata["is_locked"] = False 
        
        language = profile.get("language", "english")
        
        # 🟢 PLAN-BASED CTA (Unlock hone ke baad) 🟢
        if plan in ["starter", "pro"]:
            new_metadata["cta"] = "generate_shooting_guide"
            new_metadata["cta_text"] = "Get Shooting Guide 🎥"
            new_content = "Script unlocked and ready! 🎬 Want me to generate a Shooting Guide?" if language != "hinglish" else "Script unlock ho gayi hai! 🎬 Kya iska Shooting Guide banaun?"
        else:
            new_metadata["cta"] = "generate_caption"
            new_metadata["cta_text"] = "Write Caption ✍️"
            new_content = "Script unlocked and ready! 🎬 Want me to write a catchy caption?" if language != "hinglish" else "Script unlock ho gayi hai! 🎬 Ab ek solid caption likhein?"

        supabase.table("messages").update({
            "content": new_content,
            "metadata": new_metadata
        }).eq("id", locked_msg["id"]).execute()

    from app.integrations.queries import upsert_post
    upsert_post(supabase, user_id, chat_id, idea_id=chat["idea_id"], script=raw_script, status="draft")

    return {"script": raw_script}