from fastapi import FastAPI

from app.api.routes import router
from app.core.config import settings

app = FastAPI(title="Postra API", version="0.1.0")
app.include_router(router, prefix="/api")


@app.get("/healthz")
def health_check() -> dict:
    return {"status": "ok", "service": "postra-backend", "environment": settings().environment}
