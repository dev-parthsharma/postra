import random
import requests
from app.core.config import GEMINI_API_KEYS

GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent"
)

def generate_content(prompt: str) -> str:
    keys = [k for k in GEMINI_API_KEYS if k]
    if not keys:
        raise Exception("No Gemini API keys configured")

    random.shuffle(keys)

    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }

    errors = []

    for attempt, key in enumerate(keys, start=1):
        try:
            response = requests.post(
                f"{GEMINI_API_URL}?key={key}",
                json=payload,
                timeout=15,
            )

            print(f"[Gemini] attempt={attempt} status={response.status_code}")
            print(f"[Gemini] body={response.text[:300]}")

            if response.status_code == 200:
                data = response.json()
                parts = (
                    data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [])
                )
                text = "".join(p.get("text", "") for p in parts).strip()
                if not text:
                    raise Exception("Gemini returned empty text")
                return text

            if response.status_code == 429:
                errors.append(f"attempt {attempt}: 429 rate limited")
                continue

            raise Exception(
                f"attempt {attempt}: HTTP {response.status_code}: {response.text}"
            )

        except requests.exceptions.RequestException as e:
            errors.append(f"attempt {attempt}: network error: {e}")
            continue

    raise Exception("All Gemini keys failed: " + " | ".join(errors))