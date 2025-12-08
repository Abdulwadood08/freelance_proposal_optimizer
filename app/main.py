"""FastAPI application entry point."""
from fastapi import FastAPI

from app.routes import user

app = FastAPI(
    title="Freelance Proposal Optimizer API",
    description="Backend API for Freelance Proposal Optimizer SaaS",
    version="1.0.0"
)

# Include routers
app.include_router(user.router)


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

