"""FastAPI application entry point."""
from dotenv import load_dotenv
from fastapi import FastAPI

# Load environment variables from .env file
load_dotenv()

from app.routes import user, proposal

app = FastAPI(
    title="Freelance Proposal Optimizer API",
    description="Backend API for Freelance Proposal Optimizer SaaS",
    version="1.0.0"
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

