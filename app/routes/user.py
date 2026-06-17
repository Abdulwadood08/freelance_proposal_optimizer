"""User-related API endpoints."""
import logging
from typing import Any, List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, EmailStr

from app.services.firestore_client import get_firestore_client
from app.services.openai_client import get_openai_client
from app.services.resume_extract import pdf_bytes_to_text


router = APIRouter()
logger = logging.getLogger(__name__)

MAX_RESUME_UPLOAD_BYTES = 5 * 1024 * 1024


class UserCreate(BaseModel):
    """Schema for creating a new user."""
    user_id: str
    name: str
    email: EmailStr
    skills: List[str]
    resume_url: str
    case_studies: List[Any]  # string or {title, description, ...}
    fiverr_gigs: List[str]
    upwork_profile: str


class UserUpdate(BaseModel):
    """Schema for partial user update (settings, profile name, etc.)."""
    name: Optional[str] = None
    email_notifications: Optional[bool] = None
    proposal_alerts: Optional[bool] = None


class UserResponse(BaseModel):
    """Schema for user response."""
    success: bool
    message: str


class WorkExperienceItem(BaseModel):
    title: str = ""
    company: str = ""
    period: str = ""


class ProfileSuggestionsRequest(BaseModel):
    """Snapshot of profile builder form for AI suggestions."""

    user_id: str
    name: str = ""
    email: str = ""
    skills: List[Any] = []
    case_studies: List[Any] = []
    resume_present: bool = False
    upwork_profile: str = ""
    portfolio_links: List[str] = []
    work_experience: List[WorkExperienceItem] = []


@router.post("/v1/profile/extract-resume")
async def extract_resume_profile(file: UploadFile = File(...)):
    """
    Upload a PDF résumé; extract text and use OpenAI to suggest profile fields.
    Auto-fill on the client uses this JSON (PDF only).
    """
    filename = (file.filename or "").lower()
    if not filename.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Résumé auto-fill supports PDF files only. DOC/DOCX can still be saved manually.",
        )
    try:
        data = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read upload: {str(e)}",
        )
    if len(data) > MAX_RESUME_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large (max 5MB).",
        )
    try:
        text = pdf_bytes_to_text(data)
    except Exception as e:
        logger.warning("extract-resume: pdf_bytes_to_text failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not read PDF: {str(e)}",
        )
    if len(text.strip()) < 50:
        logger.warning(
            "extract-resume: extracted text too short (%d chars after strip)",
            len(text.strip()),
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not extract enough text from this PDF (image-only scans are not supported).",
        )
    try:
        client = get_openai_client()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    try:
        parsed = client.extract_profile_from_resume_text(text)
        return jsonable_encoder(parsed)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )


@router.post("/v1/profile/suggestions")
async def profile_suggestions(body: ProfileSuggestionsRequest):
    """
    OpenAI-powered suggestions for improving the profile based on current form fields.
    """
    try:
        client = get_openai_client()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    try:
        payload = body.model_dump()
        result = client.suggest_profile_improvements(payload)
        return jsonable_encoder(result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate suggestions: {str(e)}",
        )


@router.post("/v1/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserCreate):
    """
    Create a new user profile.
    
    Args:
        user: User data to be saved
        
    Returns:
        Success response with message
    """
    try:
        firestore_client = get_firestore_client()
        
        # Convert Pydantic model to dictionary
        user_data = user.model_dump()
        
        # Save to Firestore
        firestore_client.save_user(user.user_id, user_data)
        
        return UserResponse(success=True, message="User saved")
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save user: {str(e)}"
        )


@router.get("/v1/users/{user_id}")
async def get_user(user_id: str):
    """
    Retrieve a user profile by user_id.
    
    Args:
        user_id: The ID of the user to retrieve
        
    Returns:
        User profile data
        
    Raises:
        HTTPException: If user is not found
    """
    try:
        firestore_client = get_firestore_client()
        user_data = firestore_client.get_user(user_id)
        
        if user_data is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id '{user_id}' not found"
            )
        
        return user_data
    
    except HTTPException:
        raise
    except ValueError as e:
        # e.g. GOOGLE_APPLICATION_CREDENTIALS not set or invalid service account
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Backend Firebase not configured: {str(e)}",
        )
    except FileNotFoundError as e:
        # Firebase service account JSON file missing at path in .env
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Firebase service account file not found. Set GOOGLE_APPLICATION_CREDENTIALS in app/.env to the path of your JSON file. {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve user: {str(e)}",
        )


@router.patch("/v1/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate):
    """
    Partially update user (name, notification preferences). Merges with existing Firestore doc.
    """
    try:
        firestore_client = get_firestore_client()
        updates = body.model_dump(exclude_unset=True)
        if not updates:
            return {"success": True, "message": "Nothing to update"}
        firestore_client.update_user(user_id, updates)
        return {"success": True, "message": "User updated"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user: {str(e)}",
        )

