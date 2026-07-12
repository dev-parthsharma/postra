# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.settings import settings

app = FastAPI(title="Postra API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://app.postra.co.in",  # Production Web App Subdomain
        "https://postra.co.in",      # Production Landing Page Domain
        "https://localhost:5173",    # Local HTTPS Testing
        "http://localhost:5173",     # Local HTTP Testing Fallback
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")