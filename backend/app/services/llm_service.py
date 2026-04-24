# backend/app/services/llm_service.py
#
# Generation priority:
#   1. Groq  (attempt 1)
#   2. Groq  (attempt 2 — one retry, short delay)
#   3. Gemini (single attempt across all keys, no retry round)
#   4. Caller catches RuntimeError and uses fallback_ideas
#
# This ordering gives the fastest p50 (Groq is ~2–4 s) while keeping
# Gemini as a reliable safety net.  fallback_ideas is only reached when
# both APIs are genuinely down.

import random
import time
import requests
from app.core.config import GEMINI_API_KEYS, GROQ_API_KEYS

# ── Gemini ────────────────────────────────────────────────────────────────────
GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1/models/"
    "gemini-2.5-flash:generateContent"
)
GEMINI_RETRYABLE_STATUS = {429, 500, 502, 503, 504}
GEMINI_TIMEOUT = 15.0          # seconds — slightly more generous as a fallback
PER_KEY_DELAY  = (0.2, 0.5)   # random sleep between key attempts

# ── Groq ──────────────────────────────────────────────────────────────────────
GROQ_API_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL     = "llama-3.3-70b-versatile"
GROQ_TIMEOUT   = 12.0          # seconds — Groq is fast, fail quickly
GROQ_RETRY_DELAY = 0.5         # seconds between attempt 1 and attempt 2


# ══════════════════════════════════════════════════════════════════════════════
# Internal helpers
# ══════════════════════════════════════════════════════════════════════════════

def _call_groq_once(prompt: str, key: str, max_tokens: int = 1024) -> str:
    """
    Single Groq attempt with a given key.
    Raises RuntimeError on any failure (network, HTTP error, empty body).
    """
    try:
        response = requests.post(
            GROQ_API_URL,
            json={
                "model":       GROQ_MODEL,
                "messages":    [{"role": "user", "content": prompt}],
                "temperature": 0.9,
                "max_tokens":  max_tokens,
            },
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type":  "application/json",
            },
            timeout=GROQ_TIMEOUT,
        )
    except requests.exceptions.Timeout:
        raise RuntimeError(f"Groq timeout after {GROQ_TIMEOUT}s")
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f"Groq network error: {type(exc).__name__}: {exc}")

    print(f"[Groq] status={response.status_code} model={GROQ_MODEL}")

    if response.status_code != 200:
        raise RuntimeError(
            f"Groq HTTP {response.status_code}: {response.text[:300]}"
        )

    try:
        text = response.json()["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError) as exc:
        raise RuntimeError(f"Groq response parse error: {exc}")

    if not text:
        raise RuntimeError("Groq returned empty response")

    return text


def _call_groq_with_retry(prompt: str, max_tokens: int = 1024) -> str:
    """
    Try Groq up to 2 times (attempt 1, short delay, attempt 2).
    Randomly picks a key each attempt (different key on retry if pool > 1).
    Raises RuntimeError if both attempts fail.
    """
    keys = [k for k in GROQ_API_KEYS if k]
    if not keys:
        raise RuntimeError("No Groq API keys configured")

    errors: list[str] = []

    for attempt in range(1, 3):          # attempt 1 and 2
        key = random.choice(keys)
        try:
            result = _call_groq_once(prompt, key, max_tokens)
            if attempt > 1:
                print(f"[Groq] succeeded on attempt {attempt}")
            return result
        except RuntimeError as exc:
            errors.append(f"attempt {attempt}: {exc}")
            print(f"[Groq] attempt {attempt} failed — {exc}")
            if attempt < 2:
                time.sleep(GROQ_RETRY_DELAY)

    raise RuntimeError(
        f"Groq failed after 2 attempts: {' | '.join(errors)}"
    )


def _call_gemini_once(prompt: str, max_tokens: int = 1024) -> str:
    """
    Try every Gemini key in random order — one pass, no retry rounds.
    Raises RuntimeError if all keys fail.
    """
    keys = [k for k in GEMINI_API_KEYS if k]
    if not keys:
        raise RuntimeError("No Gemini API keys configured")

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature":     0.9,
            "maxOutputTokens": max_tokens,
        },
    }

    shuffled = keys[:]
    random.shuffle(shuffled)
    errors: list[str] = []

    for idx, key in enumerate(shuffled, start=1):
        try:
            response = requests.post(
                f"{GEMINI_API_URL}?key={key}",
                json=payload,
                timeout=GEMINI_TIMEOUT,
            )
            print(f"[Gemini] key={idx}/{len(shuffled)} status={response.status_code}")

            if response.status_code == 200:
                data  = response.json()
                parts = (
                    data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [])
                )
                text = "".join(p.get("text", "") for p in parts).strip()
                if text:
                    return text
                errors.append(f"key{idx}: empty response")
                continue

            if response.status_code in GEMINI_RETRYABLE_STATUS:
                errors.append(f"key{idx}: HTTP {response.status_code}")
                time.sleep(random.uniform(*PER_KEY_DELAY))
                continue

            # Non-retryable (e.g. 400 bad request) — still try next key
            errors.append(f"key{idx}: HTTP {response.status_code} non-retryable")
            continue

        except requests.exceptions.Timeout:
            errors.append(f"key{idx}: timeout after {GEMINI_TIMEOUT}s")
            time.sleep(random.uniform(*PER_KEY_DELAY))
            continue
        except requests.exceptions.RequestException as exc:
            errors.append(f"key{idx}: network error: {type(exc).__name__}")
            time.sleep(random.uniform(*PER_KEY_DELAY))
            continue

    raise RuntimeError(
        f"Gemini failed across all {len(shuffled)} keys: {' | '.join(errors)}"
    )


# ══════════════════════════════════════════════════════════════════════════════
# Public API  (used by ideas_service and other callers)
# ══════════════════════════════════════════════════════════════════════════════

def generate_content(prompt: str) -> str:
    """
    Idea generation entry-point.  Groq first (fast), Gemini as fallback.

    Priority:
      1. Groq  (attempt 1)
      2. Groq  (attempt 2, 0.5 s later)
      3. Gemini (single pass through all keys)

    Raises RuntimeError if all stages fail — caller falls back to
    fallback_ideas (handled in handle_generate_ideas).
    """
    groq_error_msg = ""
    try:
        result = _call_groq_with_retry(prompt)
        print("[LLM] Groq succeeded ✓")
        return result
    except RuntimeError as groq_err:
        groq_error_msg = str(groq_err)
        print(f"[LLM] Groq exhausted → falling back to Gemini. ({groq_error_msg})")

    try:
        result = _call_gemini_once(prompt)
        print("[LLM] Gemini fallback succeeded ✓")
        return result
    except RuntimeError as gemini_err:
        raise RuntimeError(
            f"All LLM providers failed. "
            f"Groq: {groq_error_msg} | Gemini: {gemini_err}"
        )


def generate_content_gemini_first(prompt: str) -> str:
    """
    Improve-idea entry-point.  Gemini first (higher quality), Groq as fallback.
    Uses 2048 max tokens — improve prompts produce longer JSON than generation.

    Priority:
      1. Gemini (single pass through all keys)
      2. Groq   (attempt 1)
      3. Groq   (attempt 2, 0.5 s later)

    Raises RuntimeError if both fail — caller should show a user-facing
    error message (no silent fallback for improve).
    """
    # Improve responses are longer than generation — bump token limit to avoid truncation
    MAX_TOKENS = 2048

    gemini_error_msg = ""
    try:
        result = _call_gemini_once(prompt, max_tokens=MAX_TOKENS)
        print("[LLM] Gemini succeeded ✓")
        return result
    except RuntimeError as gemini_err:
        gemini_error_msg = str(gemini_err)
        print(f"[LLM] Gemini failed → falling back to Groq. ({gemini_error_msg})")

    try:
        result = _call_groq_with_retry(prompt, max_tokens=MAX_TOKENS)
        print("[LLM] Groq fallback succeeded ✓")
        return result
    except RuntimeError as groq_err:
        raise RuntimeError(
            f"All LLM providers failed. "
            f"Gemini: {gemini_error_msg} | Groq: {groq_err}"
        )