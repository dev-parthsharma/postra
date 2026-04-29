# backend/app/api/routes.py

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from typing import Optional

from app.integrations.queries import (
    fetch_user_count,
    insert_ideas,
    toggle_favourite,
    get_ideas_with_chat_status,
    create_chat,
    get_user_profile,
    delete_idea,
)
from app.schemas.auth import AuthRequest
from app.schemas.response import HealthResponse
from app.services.auth_service import AuthService
from app.integrations.supabase_client import get_supabase_client, get_http_client
from app.services import ideas_service
from app.services.ideas_service import IdeaInvalid, IdeaConfused, IdeaLimitReached
from app.core.settings import settings

router = APIRouter()


# ── Auth helper ───────────────────────────────────────────────────────────────

def get_current_user_id(authorization: str = Header(...)) -> str:
    try:
        token = authorization.split(" ")[1]
        response = get_http_client().get(
            "/auth/v1/user",
            headers={"Authorization": f"Bearer {token}"},
        )
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return response.json()["id"]
    except HTTPException:
        raise
    except Exception as e:
        print("JWT ERROR:", str(e))
        raise HTTPException(status_code=401, detail="Invalid or expired token")


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