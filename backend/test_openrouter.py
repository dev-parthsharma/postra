# import asyncio, httpx
# from app.core.settings import settings

# async def test():
#     async with httpx.AsyncClient(timeout=30) as client:
#         r = await client.post(
#             'https://openrouter.ai/api/v1/chat/completions',
#             headers={'Authorization': f'Bearer {settings.google_api_key}', 'Content-Type': 'application/json'},
#             json={'model': 'google/gemma-3-4b-it:free', 'messages': [{'role': 'user', 'content': 'Say hi'}], 'max_tokens': 10}
#         )
#         print(r.status_code, r.text[:300])

# asyncio.run(test())