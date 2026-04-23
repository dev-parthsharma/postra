# backend/app/services/llm_service.py
# Gemini API wrapper with 3-round retry logic.
# Falls back to Groq (llama) if all Gemini rounds fail.
# Each round shuffles all available keys independently.
# Cooldown between rounds keeps retries efficient without hammering the API.

import random
import time
import requests
from app.core.config import GEMINI_API_KEYS
from app.core.settings import settings

GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent"
)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

RETRYABLE_STATUS = {429, 500, 502, 503, 504}

# Retry configuration
MAX_ROUNDS = 3
ROUND_COOLDOWN_BASE = 0.8   # seconds between rounds (increases per round)
PER_KEY_DELAY = (0.3, 0.8)  # (min, max) random delay between key attempts


def _call_groq(prompt: str, timeout: float = 15.0) -> str:
    """
    Call Groq API as a fallback when Gemini is unavailable.
    Raises RuntimeError if Groq also fails.
    """
    api_key = getattr(settings, "groq_api_key", None)
    if not api_key:
        raise RuntimeError("Groq API key not configured")

    payload = {
        "model": GROQ_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.8,
        "max_tokens": 1024,
    }

    try:
        response = requests.post(
            GROQ_API_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=timeout,
        )
        print(f"[Groq] status={response.status_code}")
        if response.status_code == 200:
            data = response.json()
            text = data["choices"][0]["message"]["content"].strip()
            if text:
                return text
            raise RuntimeError("Groq returned empty response")
        raise RuntimeError(f"Groq HTTP {response.status_code}: {response.text[:200]}")
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Groq network error: {type(e).__name__}: {e}")


def generate_content(prompt: str, timeout: float = 12.0) -> str:
    """
    Try to generate content using Gemini with 3 full retry rounds.
    Falls back to Groq if all Gemini rounds fail.

    Round structure (Gemini):
      - Round 1: try all keys in random order, short delays
      - Round 2: wait ROUND_COOLDOWN_BASE seconds, try all keys again
      - Round 3: wait ROUND_COOLDOWN_BASE * 2 seconds, final attempt

    Raises RuntimeError if both Gemini and Groq fail.
    """
    keys = [k for k in GEMINI_API_KEYS if k]
    if not keys:
        print("[LLM] No Gemini keys configured — trying Groq directly")
        return _call_groq(prompt, timeout=15.0)

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.9,
            "maxOutputTokens": 1024,
        },
    }

    all_errors: list[str] = []

    for round_num in range(1, MAX_ROUNDS + 1):
        # Cooldown before rounds 2 and 3
        if round_num > 1:
            cooldown = ROUND_COOLDOWN_BASE * (round_num - 1)
            time.sleep(cooldown)

        # Shuffle keys independently each round
        shuffled_keys = keys[:]
        random.shuffle(shuffled_keys)

        round_errors: list[str] = []

        for attempt, key in enumerate(shuffled_keys, start=1):
            try:
                response = requests.post(
                    f"{GEMINI_API_URL}?key={key}",
                    json=payload,
                    timeout=timeout,
                )

                print(f"[Gemini] round={round_num} key={attempt}/{len(shuffled_keys)} status={response.status_code}")

                if response.status_code == 200:
                    data = response.json()
                    parts = (
                        data.get("candidates", [{}])[0]
                        .get("content", {})
                        .get("parts", [])
                    )
                    text = "".join(p.get("text", "") for p in parts).strip()
                    if text:
                        return text
                    # Empty response — treat as retryable
                    round_errors.append(f"r{round_num}k{attempt}: empty response")
                    continue

                if response.status_code in RETRYABLE_STATUS:
                    round_errors.append(f"r{round_num}k{attempt}: HTTP {response.status_code}")
                    # Small delay between key attempts
                    time.sleep(random.uniform(*PER_KEY_DELAY))
                    continue

                # Non-retryable status — log but continue to next key anyway
                round_errors.append(f"r{round_num}k{attempt}: HTTP {response.status_code} non-retryable")
                continue

            except requests.exceptions.Timeout:
                round_errors.append(f"r{round_num}k{attempt}: timeout after {timeout}s")
                time.sleep(random.uniform(*PER_KEY_DELAY))
                continue

            except requests.exceptions.RequestException as e:
                round_errors.append(f"r{round_num}k{attempt}: network error: {type(e).__name__}")
                time.sleep(random.uniform(*PER_KEY_DELAY))
                continue

        all_errors.extend(round_errors)
        print(f"[Gemini] round={round_num} failed — {len(round_errors)} errors")

    # All Gemini rounds failed — try Groq as fallback
    print(f"[LLM] All {MAX_ROUNDS} Gemini rounds failed. Trying Groq fallback...")
    try:
        result = _call_groq(prompt, timeout=15.0)
        print("[LLM] Groq fallback succeeded")
        return result
    except RuntimeError as groq_err:
        raise RuntimeError(
            f"All {MAX_ROUNDS} Gemini rounds failed AND Groq fallback failed. "
            f"Gemini errors: {' | '.join(all_errors[-6:])} | Groq: {groq_err}"
        )