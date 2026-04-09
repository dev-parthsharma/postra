# Postra Architecture

## Backend

- `backend/main.py` - FastAPI entry point
- `backend/app/api/` - API route definitions
- `backend/app/services/` - business logic and service layer
- `backend/app/integrations/` - Supabase integration and database queries
- `backend/app/core/` - configuration and environment management
- `backend/app/schemas/` - shared Pydantic models

## Frontend

- `frontend/src/components/` - reusable UI components
- `frontend/src/pages/` - routed page views
- `frontend/src/hooks/` - custom React hooks
- `frontend/src/utils/` - helper utilities
- `frontend/src/lib/` - Supabase client setup
- `frontend/src/styles/` - global and Tailwind styles

## Environment

- `backend/.env` - backend-only environment values
- `frontend/.env` - frontend-only environment values

## Deployment

- Keep secrets out of source control
- Enable Supabase row-level security for production
- Use CI/CD to install backend dependencies, build frontend, and deploy separately
