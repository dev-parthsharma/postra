# import asyncio, httpx, json
# from app.core.settings import settings

# MODEL = "gemini-2.0-flash"

# PROMPT = """You are a professional Instagram content strategist.
# Generate exactly 3 fresh content ideas for a Lifestyle creator with a Casual tone.
# Return ONLY valid JSON, no explanation, no markdown.
# Format:
# {"ideas": ["Idea one here", "Idea two here", "Idea three here"]}"""

# async def test():
#     async with httpx.AsyncClient(timeout=30) as client:
#         r = await client.post(
#             'https://openrouter.ai/api/v1/chat/completions',
#             headers={'Authorization': f'Bearer {settings.google_api_key}', 'Content-Type': 'application/json'},
#             json={'model': MODEL, 'messages': [{'role': 'user', 'content': PROMPT}], 'max_tokens': 300}
#         )
#         print("STATUS:", r.status_code)
#         if r.status_code == 200:
#             data = r.json()
#             content = data["choices"][0]["message"]["content"]
#             print("RAW CONTENT:", repr(content))
#             try:
#                 parsed = json.loads(content)
#                 print("PARSED OK:", parsed)
#             except Exception as e:
#                 print("PARSE ERROR:", e)
#         else:
#             print("ERROR:", r.text[:300])

# asyncio.run(test())