# backend/app/api/routes.py

import os
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field

from app.integrations.queries import fetch_user_count, insert_ideas, toggle_favourite, get_ideas_with_chat_status, create_chat, get_user_profile, delete_idea
from app.schemas.auth import AuthRequest
from app.schemas.response import HealthResponse
from app.services.auth_service import AuthService
from app.integrations.supabase_client import get_supabase_client, get_http_client
from app.services import ideas_service
from app.core.settings import settings

# Single router — no prefix so existing routes stay at their original paths
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


# ── Existing routes ───────────────────────────────────────────────────────────

@router.get("/health", response_model=HealthResponse)
def health() -> dict:
    return {"status": "ok", "service": "postra-backend", "environment": "production"}


@router.get("/supabase-test")
def supabase_test() -> dict:
    count = fetch_user_count()
    return {"message": "Supabase connection verified", "user_count": count}


@router.post("/signup")
def signup(payload: AuthRequest):
    try:
        user = AuthService.create_user(payload.email, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "user_id": user["id"],
        "email": user["email"]
    }


# ── Ideas routes ──────────────────────────────────────────────────────────────

@router.post("/ideas/generate")
async def generate_ideas(
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
):
    try:
        ideas = await ideas_service.handle_generate_ideas(supabase, user_id)
        return {"ideas": ideas}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        print("RUNTIME ERROR:", str(e))  # ADD THIS
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        print("UNEXPECTED ERROR:", str(e))  # ADD THIS
        raise HTTPException(status_code=502, detail=str(e))



@router.post("/ideas/save")
def save_user_idea(
    body: SaveIdeaRequest,
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
):
    try:
        idea = ideas_service.handle_save_user_idea(supabase, user_id, body.idea)
        return {"idea": idea}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


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
    try:
        chat = ideas_service.handle_confirm_idea(
            supabase, user_id, body.idea_id, body.idea_text
        )
        return {"chat": chat}
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