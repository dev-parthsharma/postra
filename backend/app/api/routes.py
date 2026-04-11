# backend/app/api/routes.py

import os
import jwt
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field

from app.integrations.queries import fetch_user_count, insert_ideas, toggle_favourite, get_ideas_for_user, create_chat, get_user_profile
from app.schemas.auth import AuthRequest
from app.schemas.response import HealthResponse
from app.services.auth_service import AuthService
from app.integrations.supabase_client import get_supabase_client
from app.services import ideas_service

# Single router — no prefix so existing routes stay at their original paths
router = APIRouter()


# ── Auth helper ───────────────────────────────────────────────────────────────

def get_current_user_id(authorization: str = Header(...)) -> str:
    """
    Extract user_id from 'Bearer <supabase_jwt>' header.
    JWT secret lives in backend/.env as SUPABASE_JWT_SECRET.
    Find it in: Supabase dashboard → Settings → API → JWT Secret
    """
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        raise HTTPException(status_code=500, detail="JWT secret not configured")
    try:
        token = authorization.split(" ")[1]
        payload = jwt.decode(token, secret, algorithms=["HS256"], audience="authenticated")
        return payload["sub"]  # sub = user UUID
    except Exception:
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

@router.post("/api/ideas/generate")
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
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/api/ideas/save")
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


@router.patch("/api/ideas/favourite")
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


@router.post("/api/ideas/confirm")
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


@router.get("/api/ideas")
def list_ideas(
    user_id: str = Depends(get_current_user_id),
    supabase=Depends(get_supabase),
):
    ideas = ideas_service.handle_get_ideas(supabase, user_id)
    return {"ideas": ideas}