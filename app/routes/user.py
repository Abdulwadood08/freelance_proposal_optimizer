"""User-related API endpoints."""
from typing import Any, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.services.firestore_client import get_firestore_client


router = APIRouter()


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

