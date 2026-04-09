# Postra

A production-ready SaaS MVP scaffold for Postra.

## Overview

- Backend: Python + FastAPI
- Frontend: React + Vite + Tailwind CSS
- Auth & Database: Supabase

## Structure

- `backend/` - FastAPI app with modular layers
- `frontend/` - React app with scalable folder structure
- `docs/` - project documentation
- `assets/` - images and logo assets
- `scripts/` - automation scripts

## Setup

### Backend

1. Open a terminal in `backend/`
2. Create a virtual environment:
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
3. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
4. Copy `.env` and update Supabase values:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`

5. Run backend:
   ```powershell
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend

1. Open a terminal in `frontend/`
2. Install Node dependencies:
   ```powershell
   npm install
   ```
3. Copy `.env` and update Supabase values:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

4. Run frontend:
   ```powershell
   npm run dev
   ```

## Notes

- Backend uses Supabase service role key for secure operations.
- Frontend uses Supabase auth client for signup, login, and session handling.
- `.gitignore` excludes sensitive files and generated artifacts.
