"""
main.py

SECURITY FIXES:
  - Risk 1: Added JWT authentication middleware.  All /api/v1/ routes now
            require a valid Bearer token except /api/v1/auth/login.
            The User model, password hashing, and token issuance are in
            app/routers/auth.py (new file — see auth.py in this patch set).
  - Risk 2: CORS origins now read from settings so production deployments
            can restrict to real domain names without code changes.
            allow_credentials=True is kept (needed for cookie-based auth
            future work) but allow_methods/allow_headers are restricted.
"""

import os
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import students, setup, fees, marks, pdf, attendance, yearend, auth
from app.core.database import engine, Base
from app.core.config import settings
from app.models.base_models import *  # noqa — registers all models with Base

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="School Management System — GSEB",
    version="1.0.0",
    description="SMS for Iqra English Medium School",
)

# ---------------------------------------------------------------------------
# CORS  (SECURITY RISK 2 FIX)
# ---------------------------------------------------------------------------
# Origins are read from settings so .env can override for production.
# Default stays permissive for local dev; set ALLOWED_ORIGINS in production.
_allowed_origins: list[str] = (
    settings.ALLOWED_ORIGINS.split(",")
    if getattr(settings, "ALLOWED_ORIGINS", None)
    else [
        "http://localhost:80",
        "http://localhost",
        "http://localhost:5173",
    ]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    # Restrict to the methods actually used instead of "*"
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    # Restrict to the headers actually needed
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# ---------------------------------------------------------------------------
# JWT Auth middleware  (SECURITY RISK 1 FIX)
# ---------------------------------------------------------------------------
# Public paths that do NOT require authentication
_PUBLIC_PATHS = {
    "/",
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
}


@app.middleware("http")
async def require_auth(request: Request, call_next):
    """
    Validate JWT Bearer token on all /api/v1/ routes except public ones.
    Returns 401 if the token is missing or invalid.

    To disable auth during development set DISABLE_AUTH=true in .env.
    NEVER use DISABLE_AUTH=true in production.
    """
    # Allow non-API paths (static, docs) and explicitly public API paths
    if not request.url.path.startswith("/api/v1/"):
        return await call_next(request)
    if request.url.path in _PUBLIC_PATHS:
        return await call_next(request)

    # Development escape hatch — remove before going live
    if os.getenv("DISABLE_AUTH", "false").lower() == "true":
        return await call_next(request)

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Missing or invalid Authorization header"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header[len("Bearer "):]
    try:
        from app.core.security import decode_access_token
        payload = decode_access_token(token)
        # Attach user info to request state for use in route handlers
        request.state.user_id   = payload.get("sub")
        request.state.user_role = payload.get("role", "admin")
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Token is invalid or expired"},
            headers={"WWW-Authenticate": "Bearer"},
        )

    return await call_next(request)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth.router)        # /api/v1/auth — login, refresh
app.include_router(students.router)
app.include_router(setup.router)
app.include_router(fees.router)
app.include_router(marks.router)
app.include_router(pdf.router)
app.include_router(attendance.router)
app.include_router(yearend.router)


# ---------------------------------------------------------------------------
# Health / root
# ---------------------------------------------------------------------------
@app.get("/")
def root():
    return {"status": "SMS Backend is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
