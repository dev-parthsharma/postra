# backend/app/services/chat_messages.py
#
# Static opening message bank for chat start.
# Selected based on win_score group, language, tone, niche, goal, style.
# Zero AI calls — pure static selection with randomisation.

import random

# ── Score grouping ─────────────────────────────────────────────────────────────

def _score_group(win_score: int) -> str:
    if win_score <= 3:
        return "weak"
    if win_score <= 6:
        return "decent"
    return "strong"


# ── Message bank ───────────────────────────────────────────────────────────────
# Placeholders: {niche}, {tone}, {goal}, {style} — all optional, filled softly.

_MESSAGES_ENGLISH: dict[str, list[str]] = {
    "strong": [
        "This is a strong idea for {niche} — the kind that gets saves and shares. Let's start with hooks?",
        "Solid angle 🔥 This has real potential in {niche}. Want me to generate some hooks first?",
        "Love this direction. {niche} content like this tends to perform well when the hook is right. Shall we build that?",
        "This idea checks out — it's specific, it's postable, and it fits {niche}. Let's get the hook sorted.",
        "Strong concept. Your {tone} tone will make this land well. Want hooks or caption first?",
        "This one's ready to build on. Given your goal to {goal}, let's make sure the hook earns the click.",
        "Good idea — clear and actionable. Let's open with a hook that stops the scroll. Want 3 options?",
        "This has legs 🚀 Perfect for {niche}. Let's nail the hook and the rest follows. Ready?",
    ],
    "decent": [
        "Decent idea — it'll work if we sharpen the angle. Want to start with hooks?",
        "This has potential in {niche}, but it needs a strong hook to land. Let's build that.",
        "Not bad at all. With the right hook and caption, this can perform well. Start there?",
        "Workable idea. It'll need a punchy hook to get attention in {niche}. Want me to write a few?",
        "This can work — {niche} audiences respond to this kind of content when it's framed right. Hooks first?",
        "Solid starting point. Your {tone} style will help — let's get the hook right first.",
        "I see where this is going. It'll need a good opening line to grab attention. Want 3 hook options?",
        "This idea has a clear concept — let's give it a strong hook to make it scroll-stopping.",
    ],
    "weak": [
        "This idea needs some work before it's ready to post — but we can fix that. Want help improving it first?",
        "Honestly, this one's a bit rough for {niche}. Want to improve it or explore a different angle?",
        "The concept is there but it's not quite post-ready. We could strengthen it before building content around it.",
        "This one's a tough sell as-is. Let's either refine the idea or shift the angle — what do you prefer?",
        "It needs more specificity to land well in {niche}. Want me to suggest a stronger version?",
        "Not the strongest angle for {niche}, but it's fixable. Want to improve it first or work with this?",
        "This is a starting point, not quite ready yet. Want to refine it before we write hooks around it?",
        "The idea needs sharpening. We could improve it now, or I can suggest a few stronger alternatives.",
    ],
}

_MESSAGES_HINGLISH: dict[str, list[str]] = {
    "strong": [
        "Ye idea solid hai yaar 🔥 {niche} ke liye ekdum sahi. Hooks se shuru karein?",
        "Accha concept hai — {niche} mein ye kaam karega. Hooks generate karu?",
        "Strong idea bhai — is angle pe content accha perform karta hai. Hook banate hain?",
        "Ye postable hai aur {niche} ke liye relevant bhi. {tone} tone ke saath aur bhi accha lagega. Hooks?",
        "Iska potential hai 🚀 {goal} ke liye bhi fit baithta hai. Hook se start karein?",
        "Ye wala solid hai — specific, clear, postable. Hooks likhun kya?",
        "Bhai ye idea kaafi strong hai — scroll-stopping hook daal do toh set hai. Likhun?",
        "Good one — ye {niche} audience ke liye relatable rahega. Teen hook options chahiye?",
    ],
    "decent": [
        "Decent idea hai — hook sahi ho toh accha perform karega. Hooks banate hain?",
        "Idea theek hai bhai — thoda sharpen karna padega angle ko. Hook se shuru karein?",
        "Ye kaam karega {niche} mein — bas hook strong hona chahiye. Likhun kuch options?",
        "Solid starting point hai — sahi frame kiya toh {niche} audience connect karega. Hooks first?",
        "Not bad — concept clear hai. Hook punchier banana padega. Teen options chahiye?",
        "Idea okay hai, execution pe dhyan dena padega. {tone} tone ke saath hook likhu?",
        "Ye workable hai — thodi sharpening se ye well perform kar sakta hai. Hook se shuru?",
        "Concept samajh aa raha hai — hook strong hona chahiye is angle ke liye. Banate hain?",
    ],
    "weak": [
        "Bhai ye idea thoda aur kaam maangta hai post karne se pehle. Improve karein pehle?",
        "Ye angle {niche} ke liye zyada strong nahi lag raha. Koi aur direction try karein?",
        "Honestly — ye as-is post karne ke liye ready nahi hai. Improve karein ya naya angle lein?",
        "Concept hai but specific nahi — {niche} mein ye land nahi karega bina sharpening ke. Help karein?",
        "Ye thoda rough hai abhi. Pehle idea strengthen karein ya kuch alternatives dekhein?",
        "Strong nahi hai ye angle {niche} ke liye — fix kar sakte hain. Improve karein?",
        "Ye starting point hai, post-ready nahi. Refine karein pehle hooks likhne se pehle?",
        "Idea ko thoda aur sharpen karna padega. Improve karu ya alternatives suggest karun?",
    ],
}


# ── Template renderer ──────────────────────────────────────────────────────────

def _render(template: str, niche: str, tone: str, goal: str, style: str) -> str:
    """Safely fill template placeholders. Missing values fall back to sensible defaults."""
    replacements = {
        "{niche}": (niche or "your niche").lower(),
        "{tone}":  (tone  or "your").lower(),
        "{goal}":  (goal  or "grow").lower(),
        "{style}": (style or "your content style").lower(),
    }
    result = template
    for key, value in replacements.items():
        result = result.replace(key, value)
    return result


# ── Public API ─────────────────────────────────────────────────────────────────

def get_static_opening_message(
    win_score: int,
    language: str,
    niche: str,
    tone: str,
    goal: str,
    style: str,
) -> str:
    """
    Returns a random static opening message based on win_score + profile.
    Never calls any AI. Always returns a non-empty string.
    """
    group    = _score_group(max(1, min(10, win_score)))
    bank     = _MESSAGES_HINGLISH if language == "hinglish" else _MESSAGES_ENGLISH
    options  = bank.get(group, bank["decent"])
    template = random.choice(options)
    return _render(template, niche=niche, tone=tone, goal=goal, style=style)