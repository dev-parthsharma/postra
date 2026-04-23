# backend/app/services/groq_service.py
# Single-attempt Groq wrapper.
# Picks one random key from the pool and tries once — no retry.
# Raises RuntimeError on any failure so the caller can fall back to Gemini.

import random
import requests
from app.core.config import GROQ_API_KEYS

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "llama-3.3-70b-versatile"


def _pick_key() -> str:
    keys = [k for k in GROQ_API_KEYS if k]
    if not keys:
        raise RuntimeError("No Groq API keys configured")
    return random.choice(keys)


def _post(messages: list[dict], max_tokens: int, timeout: float) -> str:
    """
    Core POST to Groq.  Raises RuntimeError on any failure.
    messages must be a list of {"role": ..., "content": ...} dicts.
    """
    key = _pick_key()

    try:
        response = requests.post(
            GROQ_API_URL,
            json={
                "model":       GROQ_MODEL,
                "messages":    messages,
                "max_tokens":  max_tokens,
                "temperature": 0.9,
            },
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type":  "application/json",
            },
            timeout=timeout,
        )
    except requests.exceptions.Timeout:
        raise RuntimeError(f"Groq timeout after {timeout}s")
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Groq network error: {type(e).__name__}: {e}")

    print(f"[Groq] status={response.status_code} model={GROQ_MODEL}")

    if response.status_code != 200:
        raise RuntimeError(
            f"Groq HTTP {response.status_code}: {response.text[:300]}"
        )

    try:
        text = response.json()["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Groq response parse error: {e}")

    if not text:
        raise RuntimeError("Groq returned empty response")

    return text


def generate_content_groq(prompt: str, timeout: float = 15.0) -> str:
    """
    Single-turn generation: one user message, no system prompt.
    Used for: idea generation prompt (JSON output).
    """
    return _post(
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024,
        timeout=timeout,
    )


def chat_groq(messages: list[dict], max_tokens: int = 600, timeout: float = 15.0) -> str:
    """
    Multi-turn chat: passes the full messages list (system + history + user).
    Used for: opening message generation, send-message replies, validation.
    """
    return _post(messages=messages, max_tokens=max_tokens, timeout=timeout)