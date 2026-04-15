"""FastAPI application entry point."""
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Load .env from app directory so OPENAI_API_KEY and GOOGLE_APPLICATION_CREDENTIALS are set.
# override=True ensures .env wins over any existing shell/env values (e.g. after restart).
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(_env_path, override=True)

from app.routes import user, proposal

app = FastAPI(
    title="Freelance Proposal Optimizer API",
    description="Backend API for Freelance Proposal Optimizer SaaS",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://www.upwork.com",
        "https://upwork.com",
    ],
    allow_origin_regex=r"chrome-extension://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(user.router)
app.include_router(proposal.router)


@app.exception_handler(FileNotFoundError)
@app.exception_handler(ValueError)
async def firestore_config_error(_request: Request, exc: Exception):
    """Return 503 when Firebase/Firestore is not configured (missing service account)."""
    return JSONResponse(
        status_code=503,
        content={"detail": "Service temporarily unavailable. Backend Firebase is not configured."},
    )


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Freelance Proposal Optimizer API",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint (API only)."""
    return {"status": "healthy"}


@app.get("/health/db")
async def health_check_db():
    """
    Check if Firestore database is configured and reachable.
    Returns 200 with db status, or 503 if not configured / unreachable.
    """
    try:
        from app.services.firestore_client import get_firestore_client
        client = get_firestore_client()
        # Minimal read to verify connection (list collections is a cheap check)
        list(client.db.collections())
        return {"status": "healthy", "database": "firestore", "connected": True}
    except FileNotFoundError as e:
        path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "(not set)")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unavailable",
                "database": "firestore",
                "connected": False,
                "detail": str(e),
                "path_used": path,
                "file_exists": os.path.isfile(path) if path != "(not set)" else False,
            },
        )
    except ValueError as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unavailable",
                "database": "firestore",
                "connected": False,
                "detail": str(e),
                "path_expected": os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "(not set)"),
            },
        )
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unavailable",
                "database": "firestore",
                "connected": False,
                "detail": f"Database error: {str(e)}",
            },
        )

