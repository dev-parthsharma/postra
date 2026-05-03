# backend/app/api/routes.py

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel, Field
from typing import Optional
import httpx
import os
from datetime import datetime, timezone

from app.integrations.queries import (
    fetch_user_count,
    insert_ideas,
    toggle_favourite,
    get_ideas_with_chat_status,
    create_chat,
    get_user_profile,
    delete_idea,
    update_user_streak
)
from app.schemas.auth import AuthRequest
from app.schemas.response import HealthResponse
from app.services.auth_service import AuthService
from app.integrations.supabase_client import get_supabase_client, get_http_client
from app.services import ideas_service
from app.services.ideas_service import IdeaInvalid, IdeaConfused, IdeaLimitReached
from app.core.settings import settings
from app.services.instagram_service import publish_reel_to_instagram

router = APIRouter()


# ── Auth helper ───────────────────────────────────────────────────────────────

def get_current_user_id(authorization: str = Header(...)) -> str:
    try:
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid auth format")
            
        token = authorization.split(" ")[1]
        
        # 🟢 Supabase SDK ka user fetch method
        client = get_supabase_client()
        user_resp = client.auth.get_user(token)
        
        # 🟢 .user check karne se pehle safety
        if user_resp and hasattr(user_resp, 'user') and user_resp.user:
            return user_resp.user.id
        else:
            raise HTTPException(status_code=401, detail="User not found in token")
            
    except Exception as e:
        print("JWT ERROR:", str(e))
        raise HTTPException(status_code=401, detail=f"Auth failed: {str(e)}")


def get_supabase():
    return get_supabase_client()


# ── Request schemas ───────────────────────────────────────────────────────────

class SaveIdeaRequest(BaseModel):
    idea: str = Field(..., min_length=1, max_length=500)

class ToggleFavouriteRequest(BaseModel):
    idea_id: str
    is_favourite: bool

class ConfirmIdeaRequest(BaseModel):
    idea_id: str
    idea_text: str

class ImproveIdeaRequest(BaseModel):
    idea_id: str
    idea_text: str = Field(..., min_length=1, max_length=500)

class UpdateIdeaRequest(BaseModel):
    chat_id: str
    idea_text: str = Field(..., min_length=1, max_length=500)
    why_it_works: str
    win_score: int

class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    intent: Optional[str] = None

class SaveSelectionRequest(BaseModel):
    chat_id:  str
    hook:     Optional[str] = None
    caption:  Optional[str] = None
    script:   Optional[str] = None

class EditScriptRequest(BaseModel):
    current_script: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1, max_length=1000)

class IGConnectRequest(BaseModel):
    fb_access_token: str


# ── Health ────────────────────────────────────────────────────────────────────

@router.get("/health", response_model=HealthResponse)
def health() -> dict:
    return {"status": "ok", "service": "postra-backend", "environment": "production"}


@router.get("/supabase-test")
def supabase_test() -> dict:
    count = fetch_user_count()
    return {"message": "Supabase connection verified", "user_count": count}


# ── Auth ──────────────────────────────────────────────────────────────────────

@router.post("/signup")
def signup(payload: AuthRequest):
    try:
        user = AuthService.create_user(payload.email, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"user_id": user["id"], "email": user["email"]}


# ── Ideas ─────────────────────────────────────────────────────────────────────

@router.post("/ideas/generate")
async def generate_ideas(
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
):
    """
    Returns structured ideas:
    {
      "recommended": { "idea": str, "why_it_works": str, "win_score": int, ...db fields },
      "alternatives": [ {...}, {...} ]
    }
    """
    try:
        result = await ideas_service.handle_generate_ideas(supabase, user_id)
        return result
    except IdeaLimitReached as e:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "limit reached",
                "message": f"Free plan allows only 3 ideas per day",
                "plan": e.plan,
                "used": e.used,
                "limit": e.limit,
            },
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        print("RUNTIME ERROR:", str(e))
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        print("UNEXPECTED ERROR:", str(e))
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/ideas/save")
async def save_user_idea(
    body: SaveIdeaRequest,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
):
    """
    Validate idea text BEFORE saving to the database.

    Responses:
      200 → { idea }                                   ← VALID, saved
      200 → { idea, warning, suggestion }              ← CONFUSED, saved with warning
      422 → { detail: { error, type } }                ← INVALID, NOT saved
    """
    try:
        idea = await ideas_service.handle_save_user_idea(supabase, user_id, body.idea)
        return {"idea": idea}

    except IdeaInvalid:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid text",
                "type": "INVALID",
                "message": "That doesn't look like a real idea. Write something meaningful.",
            },
        )

    except IdeaConfused as e:
        from app.integrations.queries import insert_ideas
        saved = insert_ideas(supabase, user_id, [body.idea.strip()], source="user")
        idea = saved[0]
        return {
            "idea": idea,
            "warning": True,
            "type": "CONFUSED",
            "message": "Bhai ye kya likh diya 😂 — this idea is a bit vague.",
            "suggestion": "Do you want me to help clarify this idea?",
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ideas/improve")
async def improve_idea(
    body: ImproveIdeaRequest,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
):
    """
    Improve an existing idea using AI (Gemini → Groq fallback).
    Returns: { improved_idea: str, why_it_works: str, win_score: int }
    """
    try:
        profile = get_user_profile(supabase, user_id) or {}
        niche = profile.get("niche", "Lifestyle")
        language = profile.get("language", "english")

        result = await ideas_service.handle_improve_idea(
            idea_text=body.idea_text,
            niche=niche,
            language=language,
        )
        return result

    except RuntimeError as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "ai_unavailable",
                "message": "AI is temporarily unavailable. Please try again later.",
            },
        )
    except Exception as e:
        print("IMPROVE IDEA ERROR:", str(e))
        raise HTTPException(
            status_code=503,
            detail={
                "error": "ai_unavailable",
                "message": "AI is temporarily unavailable. Please try again later.",
            },
        )


@router.patch("/ideas/favourite")
def toggle_favourite_route(
    body: ToggleFavouriteRequest,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
):
    try:
        idea = ideas_service.handle_toggle_favourite(
            supabase, user_id, body.idea_id, body.is_favourite
        )
        return {"idea": idea}
    except RuntimeError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/ideas/confirm")
def confirm_idea(
    body: ConfirmIdeaRequest,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
):
    """
    Create a chat from an already-saved idea.
    Idea was validated at save time — no re-validation needed.
    """
    try:
        chat = ideas_service.handle_confirm_idea(
            supabase, user_id, body.idea_id, body.idea_text
        )
        return {"chat": chat}
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@router.patch("/ideas/{idea_id}")
def update_idea_route(
    idea_id: str,
    body: UpdateIdeaRequest,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
):

    try:
        result = ideas_service.handle_update_idea(
            supabase, 
            user_id, 
            idea_id, 
            body.chat_id,
            body.idea_text, 
            body.why_it_works, 
            body.win_score
        )
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/ideas")
def list_ideas(
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
):
    ideas = ideas_service.handle_get_ideas(supabase, user_id)
    return {"ideas": ideas}


@router.delete("/ideas/{idea_id}")
def delete_idea_route(
    idea_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
):
    try:
        delete_idea(supabase, idea_id, user_id)
        return {"success": True}
    except RuntimeError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Chat ──────────────────────────────────────────────────────────────────────

@router.get("/chat/{chat_id}")
async def get_chat(
    chat_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
):
    try:
        chat = await ideas_service.handle_get_chat(supabase, chat_id, user_id)
        return chat
    except RuntimeError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print("CHAT GET ERROR:", str(e))
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/chat/{chat_id}/message")
async def send_message(
    chat_id: str,
    body: SendMessageRequest,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
):
    try:
        result = await ideas_service.handle_send_message(
            supabase, chat_id, user_id, body.content, body.intent
        )
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print("CHAT MESSAGE ERROR:", str(e))
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/chat/select")
async def save_selection(
    body: SaveSelectionRequest,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
):
    provided = sum([
        body.hook is not None,
        body.caption is not None,
        body.script is not None,
    ])
    if provided != 1:
        raise HTTPException(
            status_code=400,
            detail="Exactly one of hook, caption, or script must be provided"
        )

    try:
        result = await ideas_service.handle_save_selection(
            supabase,
            user_id=user_id,
            chat_id=body.chat_id,
            hook=body.hook,
            caption=body.caption,
            script=body.script,
        )
        return result
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print("CHAT SELECT ERROR:", str(e))
        raise HTTPException(status_code=502, detail=str(e))
    
@router.post("/chat/{chat_id}/edit-script")
async def edit_script_with_ai(
    chat_id: str,
    body: EditScriptRequest,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
):
    try:
        result = await ideas_service.handle_edit_script(
            supabase, chat_id, user_id, body.current_script, body.prompt
        )
        return result
    except Exception as e:
        print("EDIT SCRIPT ERROR:", str(e))
        raise HTTPException(status_code=502, detail=str(e))
    
@router.post("/chat/{chat_id}/unlock-script")
async def unlock_script_endpoint(
    chat_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
):
    try:
        result = await ideas_service.handle_unlock_script_content(supabase, chat_id, user_id)
        return result
    except Exception as e:
        print("UNLOCK SCRIPT ERROR:", str(e))
        raise HTTPException(status_code=502, detail=str(e))
    
@router.post("/integrations/instagram/connect")
async def connect_instagram(req: IGConnectRequest, request: Request):
    # 1. Verify User from Supabase
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing auth token")
    
    token = auth_header.replace("Bearer ", "")
    supabase = get_supabase_client()
    
    try:
        user_resp = supabase.auth.get_user(token)
        # PYLANCE FIX: Safely check if user object exists before calling .id
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
            
        user_id = user_resp.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

    fb_token = req.fb_access_token
    APP_ID = os.getenv("FB_APP_ID")
    APP_SECRET = os.getenv("FB_APP_SECRET")
    
    async with httpx.AsyncClient() as client:
        exchange_url = f"https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={fb_token}"
        exchange_res = await client.get(exchange_url)
        token_data = exchange_res.json()

        long_lived_token = exchange_res.json().get("access_token")
        if not long_lived_token:
            raise HTTPException(status_code=400, detail="Failed to get long-lived token")

        pages_resp = await client.get(f"https://graph.facebook.com/v19.0/me/accounts?access_token={long_lived_token}")
        pages_data = pages_resp.json()
        print("DEBUG PAGES DATA:", pages_data)

        if "data" not in pages_data or not pages_data["data"]:
            raise HTTPException(status_code=400, detail="No Facebook Pages found.")

        ig_account_id = None
        
        # Loop through pages to find the attached IG Business Account
        for page in pages_data["data"]:
            page_id = page["id"]
            page_token = page.get("access_token") 
            ig_resp = await client.get(f"https://graph.facebook.com/v19.0/{page_id}?fields=instagram_business_account&access_token={page_token}")
            ig_data = ig_resp.json()
            if "instagram_business_account" in ig_data:
                ig_account_id = ig_data["instagram_business_account"]["id"]
                final_token = page_token 
                break

        if not ig_account_id:
            raise HTTPException(status_code=400, detail="No Instagram Professional Account found. Make sure your IG account is a Creator/Business account and linked to your FB Page.")

        # Get IG Username
        user_resp = await client.get(f"https://graph.facebook.com/v19.0/{ig_account_id}?fields=username&access_token={final_token}")
        user_data = user_resp.json()
        ig_username = user_data.get("username")

        if not ig_username:
            raise HTTPException(status_code=400, detail="Could not fetch Instagram username.")

        # 3. Save to Database (instagram_connections table)
        data_to_save = {
            "user_id": user_id,
            "instagram_user_id": ig_account_id,
            "instagram_username": ig_username,
            "access_token": final_token,
        }

        # Check if row already exists to Upsert
        existing = supabase.table("instagram_connections").select("id").eq("user_id", user_id).execute()
        
        if existing.data:
            supabase.table("instagram_connections").update(data_to_save).eq("user_id", user_id).execute()
        else:
            supabase.table("instagram_connections").insert(data_to_save).execute()

        return {"success": True, "username": ig_username}
    
# @router.post("/integrations/instagram/test-publish/{post_id}")
# async def test_publish_route(
#     post_id: str,
#     user_id: str = Depends(get_current_user_id),
#     supabase=Depends(get_supabase)
# ):
    # try:
    #     result = await publish_post_to_instagram(supabase, user_id, post_id)
    #     return result
    # except Exception as e:
    #     raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/integrations/instagram/publish/{post_id}")
async def publish_route(post_id: str, user_id: str = Depends(get_current_user_id), supabase=Depends(get_supabase)):
    try:
        result = await publish_reel_to_instagram(supabase, user_id, post_id)
        # 🟢 Premium users ke publish success hote hi streak update kar do
        if result.get("success"):
            update_user_streak(supabase, user_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/integrations/instagram/manual-publish/{post_id}")
async def manual_publish_route(
    post_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase)
):
    try:
        # Update post status to published
        post_resp = supabase.table("posts").update({
            "status": "published",
            "posted_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", post_id).eq("user_id", user_id).execute()
        if not post_resp.data:
            raise HTTPException(status_code=404, detail="Post not found")
            
        # Update streak
        stat = update_user_streak(supabase, user_id)
        
        return {"success": True, "message": "Marked as published manually", "streak_count": stat["streak_count"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))