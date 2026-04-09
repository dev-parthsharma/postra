from fastapi import APIRouter, Depends, HTTPException

from app.integrations.queries import fetch_user_count
from app.schemas.auth import AuthRequest
from app.schemas.response import HealthResponse
from app.services.auth_service import AuthService

router = APIRouter()


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
    return {"user_id": user.id, "email": user.email}
