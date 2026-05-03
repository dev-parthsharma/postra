# backend\app\services\instagram_service.py

import httpx
import time
from typing import Any
from fastapi import HTTPException
from datetime import datetime, timezone

async def publish_reel_to_instagram(supabase, user_id: str, post_id: str) -> Any:
    try:
        # Fetch connection
        conn = supabase.table("instagram_connections").select("*").eq("user_id", user_id).single().execute()
        access_token = conn.data["access_token"]
        ig_user_id = conn.data["instagram_user_id"]

        # Fetch Post
        post_resp = supabase.table("posts").select("*, post_media(media(file_url, type))").eq("id", post_id).execute()
        if not post_resp.data: raise Exception("Post not found")
        post_data = post_resp.data[0]
        
        reel = next((m["media"] for m in post_data.get("post_media", []) if "video" in m["media"]["type"].lower()), None)
        if not reel: raise Exception("No video found.")

        async with httpx.AsyncClient(timeout=60.0) as client:
            # 1. Create Container
            payload = {
                "video_url": reel["file_url"],
                "caption": post_data.get("caption") or " ",
                "media_type": "REELS",
                "access_token": access_token
            }
            
            # 🟢 YAHAN CHANGE KIYA HAI: Add cover image if it exists in the database
            cover_img = post_data.get("cover_image")
            if cover_img:
                payload["cover_url"] = cover_img
                print(f"DEBUG: Attaching cover image: {cover_img}")

            res = await client.post(f"https://graph.facebook.com/v19.0/{ig_user_id}/media", data=payload)
            data = res.json()
            if "id" not in data: raise Exception(f"Container Error: {data}")
            creation_id = data["id"]

            # 2. Robust Polling
            print(f"DEBUG: Waiting for media {creation_id} to be ready...")
            media_ready = False
            for i in range(15): # 15 tries * 5s = 75 seconds wait
                status_res = await client.get(f"https://graph.facebook.com/v19.0/{creation_id}?fields=status_code&access_token={access_token}")
                status_data = status_res.json()
                status = status_data.get("status_code")
                
                print(f"DEBUG: Meta status attempt {i+1}: {status}")
                
                if status == "FINISHED":
                    media_ready = True
                    break
                elif status == "ERROR":
                    raise Exception("Meta processing error.")
                
                time.sleep(5) 
            
            if not media_ready:
                raise Exception("Timed out: Meta media processing taking too long.")
            
            # 3. Publish
            print("DEBUG: Publishing...")
            pub_res = await client.post(f"https://graph.facebook.com/v19.0/{ig_user_id}/media_publish", 
                                       data={"creation_id": creation_id, "access_token": access_token})
            pub_data = pub_res.json()
            
            print(f"DEBUG: Publish Response: {pub_data}")
            
            if "id" not in pub_data: 
                raise Exception(f"Publish Error: {pub_data}")

            # 4. DB Update
            supabase.table("posts").update({
                "status": "published", 
                "posted_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", post_id).execute()
            return {"success": True}

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))