"""User-related API endpoints."""
from typing import List, Optional
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
    case_studies: List[str]
    fiverr_gigs: List[str]
    upwork_profile: str


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
            detail=f"Failed to retrieve user: {str(e)}"
        )

