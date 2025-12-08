"""Proposal-related API endpoints."""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List

from app.services.firestore_client import get_firestore_client
from app.services.openai_client import get_openai_client


router = APIRouter()


class ProposalGenerateRequest(BaseModel):
    """Schema for generating a proposal."""
    user_id: str
    job_post: str


class ProposalResponse(BaseModel):
    """Schema for proposal response."""
    proposal: str
    cover_letter: str
    tone_variations: dict


@router.post("/v1/proposals/generate", response_model=ProposalResponse, status_code=status.HTTP_201_CREATED)
async def generate_proposal(request: ProposalGenerateRequest):
    """
    Generate a tailored Upwork proposal using GPT-4.1-mini.
    
    Args:
        request: Proposal generation request with user_id and job_post
        
    Returns:
        Generated proposal with cover letter and tone variations
    """
    try:
        # 1. Fetch user profile from Firestore
        firestore_client = get_firestore_client()
        user_data = firestore_client.get_user(request.user_id)
        
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id '{request.user_id}' not found"
            )
        
        # Extract user information
        user_skills = user_data.get("skills", [])
        case_studies = user_data.get("case_studies", [])
        
        # 2. Call OpenAI GPT-4.1-mini API to generate proposal
        openai_client = get_openai_client()
        proposal_result = openai_client.generate_proposal(
            user_skills=user_skills,
            case_studies=case_studies,
            job_post=request.job_post
        )
        
        # Validate the response structure
        if not all(key in proposal_result for key in ["proposal", "cover_letter", "tone_variations"]):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Invalid response format from OpenAI API"
            )
        
        # 3. Save generated proposal to Firestore
        proposal_data = {
            "proposal": proposal_result["proposal"],
            "cover_letter": proposal_result["cover_letter"],
            "tone_variations": proposal_result["tone_variations"],
            "job_post": request.job_post
        }
        
        proposal_id = firestore_client.save_proposal(
            user_id=request.user_id,
            proposal_data=proposal_data
        )
        
        # Return the proposal response
        return ProposalResponse(
            proposal=proposal_result["proposal"],
            cover_letter=proposal_result["cover_letter"],
            tone_variations=proposal_result["tone_variations"]
        )
    
    except HTTPException:
        raise
    except ValueError as e:
        error_msg = str(e)
        if "OPENAI_API_KEY" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate proposal: {str(e)}"
        )

