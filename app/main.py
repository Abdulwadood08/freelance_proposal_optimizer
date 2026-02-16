"""FastAPI application entry point."""
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env from app directory so OPENAI_API_KEY and GOOGLE_APPLICATION_CREDENTIALS are set
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(_env_path)

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
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(user.router)
app.include_router(proposal.router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Freelance Proposal Optimizer API",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

