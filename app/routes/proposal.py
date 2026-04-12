"""Proposal-related API endpoints."""
import logging

from fastapi import APIRouter, HTTPException, status, Query
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from typing import List, Optional

from app.services.firestore_client import get_firestore_client


def _get_firestore():
    """Get Firestore client; raise 503 if Firebase is not configured."""
    try:
        return get_firestore_client()
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service temporarily unavailable. Backend Firebase is not configured.",
        ) from e


from app.services.openai_client import get_openai_client

logger = logging.getLogger(__name__)
router = APIRouter()


class ProposalGenerateRequest(BaseModel):
    """Schema for generating a proposal."""
    user_id: str
    job_post: str
    preferred_tone: Optional[str] = "professional"  # professional, friendly, confident, balanced
    proposal_length: Optional[str] = "medium"  # short, medium, long


class ProposalResponse(BaseModel):
    """Schema for proposal response."""
    id: Optional[str] = None
    proposal: str
    cover_letter: str
    tone_variations: dict
    job_post: Optional[str] = None  # Required for scoring on the frontend


class ProposalUpdateRequest(BaseModel):
    """Schema for updating a proposal."""
    proposal: Optional[str] = None
    cover_letter: Optional[str] = None
    tone_variations: Optional[dict] = None
    job_post: Optional[str] = None


class JobPostAnalysisRequest(BaseModel):
    """Schema for analyzing a job post."""
    user_id: str
    job_post: str


class ProposalScoringRequest(BaseModel):
    """Schema for scoring a proposal."""
    user_id: str
    proposal: str
    job_post: str


class TemplateCreateRequest(BaseModel):
    """Schema for creating a template."""
    name: str
    description: Optional[str] = None
    proposal: str
    cover_letter: str
    tone_variations: dict


class TemplateUpdateRequest(BaseModel):
    """Schema for updating a template."""
    name: Optional[str] = None
    description: Optional[str] = None
    proposal: Optional[str] = None
    cover_letter: Optional[str] = None
    tone_variations: Optional[dict] = None


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
        firestore_client = _get_firestore()
        user_data = firestore_client.get_user(request.user_id)
        
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id '{request.user_id}' not found"
            )
        
        # Extract user information
        user_skills = user_data.get("skills", [])
        case_studies = user_data.get("case_studies", [])
        
        # Get winning patterns for personalization
        winning_patterns = firestore_client.get_winning_patterns(request.user_id)
        
        # 2. Call OpenAI GPT-4.1-mini API to generate proposal
        openai_client = get_openai_client()
        proposal_result = openai_client.generate_proposal(
            user_skills=user_skills,
            case_studies=case_studies,
            job_post=request.job_post,
            preferred_tone=request.preferred_tone or "professional",
            proposal_length=request.proposal_length or "medium",
            winning_patterns=winning_patterns if winning_patterns else None
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
            "job_post": request.job_post,
            "preferred_tone": request.preferred_tone or "professional",
            "proposal_length": request.proposal_length or "medium"
        }
        
        proposal_id = firestore_client.save_proposal(
            user_id=request.user_id,
            proposal_data=proposal_data
        )
        
        # Return the proposal response with ID
        response_data = {
            "id": proposal_id,
            "proposal": proposal_result["proposal"],
            "cover_letter": proposal_result["cover_letter"],
            "tone_variations": proposal_result["tone_variations"],
            "job_post": request.job_post  # Include job_post for scoring
        }
        return response_data
    
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


@router.get("/v1/proposals/user/{user_id}")
async def get_user_proposals(
    user_id: str,
    limit: int = Query(default=10, ge=1, le=50)
):
    """
    Get proposals for a specific user.
    
    Args:
        user_id: The ID of the user
        limit: Maximum number of proposals to return (1-50)
        
    Returns:
        List of proposals
    """
    try:
        firestore_client = _get_firestore()
        proposals = firestore_client.get_user_proposals(user_id, limit)
        # Ensure response is JSON-serializable (handles datetime, bytes, etc.)
        return jsonable_encoder({"proposals": proposals, "count": len(proposals)})
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("get_user_proposals failed for user_id=%s: %s", user_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve proposals. Please try again.",
        )


@router.get("/v1/proposals/user/{user_id}/count")
async def get_proposal_count(user_id: str):
    """
    Get total count of proposals for a user.
    
    Args:
        user_id: The ID of the user
        
    Returns:
        Total count of proposals
    """
    try:
        firestore_client = _get_firestore()
        count = firestore_client.get_proposal_count(user_id)
        return {"count": count}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get proposal count: {str(e)}"
        )


@router.get("/v1/proposals/{proposal_id}")
async def get_proposal(proposal_id: str, user_id: str = Query(...)):
    """
    Get a single proposal by ID.
    
    Args:
        proposal_id: The ID of the proposal
        user_id: The ID of the user (to verify ownership)
        
    Returns:
        Proposal data
    """
    try:
        firestore_client = _get_firestore()
        proposal = firestore_client.get_proposal(proposal_id)
        
        if not proposal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proposal with id '{proposal_id}' not found"
            )
        
        # Verify ownership
        if proposal.get("user_id") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this proposal"
            )
        
        return proposal
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve proposal: {str(e)}"
        )


@router.patch("/v1/proposals/{proposal_id}")
async def update_proposal(
    proposal_id: str,
    request: ProposalUpdateRequest,
    user_id: str = Query(...)
):
    """
    Update a proposal.
    
    Args:
        proposal_id: The ID of the proposal to update
        request: Updated proposal data
        user_id: The ID of the user (to verify ownership)
        
    Returns:
        Success response
    """
    try:
        firestore_client = _get_firestore()
        
        # Build update data (only include fields that are provided)
        update_data = {}
        if request.proposal is not None:
            update_data["proposal"] = request.proposal
        if request.cover_letter is not None:
            update_data["cover_letter"] = request.cover_letter
        if request.tone_variations is not None:
            update_data["tone_variations"] = request.tone_variations
        if request.job_post is not None:
            update_data["job_post"] = request.job_post
        
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields provided to update"
            )
        
        success = firestore_client.update_proposal(
            proposal_id=proposal_id,
            user_id=user_id,
            proposal_data=update_data
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proposal with id '{proposal_id}' not found"
            )
        
        return {"success": True, "message": "Proposal updated successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update proposal: {str(e)}"
        )


@router.delete("/v1/proposals/{proposal_id}")
async def delete_proposal(proposal_id: str, user_id: str = Query(...)):
    """
    Delete a proposal.
    
    Args:
        proposal_id: The ID of the proposal to delete
        user_id: The ID of the user (to verify ownership)
        
    Returns:
        Success response
    """
    try:
        firestore_client = _get_firestore()
        success = firestore_client.delete_proposal(
            proposal_id=proposal_id,
            user_id=user_id
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proposal with id '{proposal_id}' not found"
            )
        
        return {"success": True, "message": "Proposal deleted successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete proposal: {str(e)}"
        )


@router.patch("/v1/proposals/{proposal_id}/status")
async def update_proposal_status(
    proposal_id: str,
    status: str = Query(...),
    user_id: str = Query(...)
):
    """
    Update proposal status (draft, sent, won, lost).
    
    Args:
        proposal_id: The ID of the proposal
        status: New status (draft, sent, won, lost)
        user_id: The ID of the user (to verify ownership)
        
    Returns:
        Success response
    """
    try:
        firestore_client = _get_firestore()
        success = firestore_client.update_proposal_status(
            proposal_id=proposal_id,
            user_id=user_id,
            status=status
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proposal with id '{proposal_id}' not found"
            )
        
        return {"success": True, "message": f"Proposal status updated to '{status}'"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update proposal status: {str(e)}"
        )


@router.get("/v1/proposals/analytics/{user_id}")
async def get_proposal_analytics(user_id: str):
    """
    Get analytics data for user's proposals.
    
    Args:
        user_id: The ID of the user
        
    Returns:
        Analytics data including success rates, status counts, etc.
    """
    try:
        firestore_client = _get_firestore()
        analytics = firestore_client.get_proposal_analytics(user_id)
        return analytics
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get analytics: {str(e)}"
        )


@router.post("/v1/proposals/analyze-job")
async def analyze_job_post(request: JobPostAnalysisRequest):
    """
    Analyze a job post and provide smart suggestions.
    
    Args:
        request: Job post analysis request with user_id and job_post
        
    Returns:
        Analysis with suggestions for relevant skills, case studies, etc.
    """
    try:
        # 1. Fetch user profile from Firestore
        firestore_client = _get_firestore()
        user_data = firestore_client.get_user(request.user_id)
        
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id '{request.user_id}' not found"
            )
        
        # Extract user information
        user_skills = user_data.get("skills", [])
        case_studies = user_data.get("case_studies", [])
        
        # 2. Call OpenAI to analyze job post
        openai_client = get_openai_client()
        analysis_result = openai_client.analyze_job_post(
            job_post=request.job_post,
            user_skills=user_skills,
            user_case_studies=case_studies
        )
        
        return analysis_result
    
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
            detail=f"Failed to analyze job post: {str(e)}"
        )


@router.post("/v1/proposals/score")
async def score_proposal(request: ProposalScoringRequest):
    """
    Score a proposal's quality and provide feedback.
    
    Args:
        request: Proposal scoring request with user_id, proposal, and job_post
        
    Returns:
        Quality score and feedback
    """
    try:
        # 1. Fetch user profile to get skills
        firestore_client = _get_firestore()
        user_data = firestore_client.get_user(request.user_id)
        
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id '{request.user_id}' not found"
            )
        
        user_skills = user_data.get("skills", [])
        
        # 2. Call OpenAI to score the proposal
        openai_client = get_openai_client()
        scoring_result = openai_client.score_proposal_quality(
            proposal=request.proposal,
            job_post=request.job_post,
            user_skills=user_skills
        )
        
        return scoring_result
    
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
            detail=f"Failed to score proposal: {str(e)}"
        )


# Template endpoints
@router.post("/v1/templates", status_code=status.HTTP_201_CREATED)
async def create_template(
    request: TemplateCreateRequest,
    user_id: str = Query(...)
):
    """
    Create a new proposal template.
    
    Args:
        request: Template data
        user_id: The ID of the user
        
    Returns:
        Created template with ID
    """
    try:
        firestore_client = _get_firestore()
        
        template_data = {
            "name": request.name,
            "description": request.description,
            "proposal": request.proposal,
            "cover_letter": request.cover_letter,
            "tone_variations": request.tone_variations
        }
        
        template_id = firestore_client.save_template(
            user_id=user_id,
            template_data=template_data
        )
        
        return {
            "id": template_id,
            "success": True,
            "message": "Template created successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create template: {str(e)}"
        )


@router.get("/v1/templates")
async def get_user_templates(
    user_id: str = Query(...),
    limit: int = Query(default=50, ge=1, le=100)
):
    """
    Get templates for a specific user.
    
    Args:
        user_id: The ID of the user
        limit: Maximum number of templates to return (1-100)
        
    Returns:
        List of templates
    """
    try:
        firestore_client = _get_firestore()
        templates = firestore_client.get_user_templates(user_id, limit)
        return {"templates": templates, "count": len(templates)}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve templates: {str(e)}"
        )


@router.get("/v1/templates/{template_id}")
async def get_template(
    template_id: str,
    user_id: str = Query(...)
):
    """
    Get a single template by ID.
    
    Args:
        template_id: The ID of the template
        user_id: The ID of the user (to verify ownership)
        
    Returns:
        Template data
    """
    try:
        firestore_client = _get_firestore()
        template = firestore_client.get_template(template_id)
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with id '{template_id}' not found"
            )
        
        # Verify ownership
        if template.get("user_id") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this template"
            )
        
        return template
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve template: {str(e)}"
        )


@router.patch("/v1/templates/{template_id}")
async def update_template(
    template_id: str,
    request: TemplateUpdateRequest,
    user_id: str = Query(...)
):
    """
    Update a template.
    
    Args:
        template_id: The ID of the template to update
        request: Updated template data
        user_id: The ID of the user (to verify ownership)
        
    Returns:
        Success response
    """
    try:
        firestore_client = _get_firestore()
        
        # Build update data (only include fields that are provided)
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.description is not None:
            update_data["description"] = request.description
        if request.proposal is not None:
            update_data["proposal"] = request.proposal
        if request.cover_letter is not None:
            update_data["cover_letter"] = request.cover_letter
        if request.tone_variations is not None:
            update_data["tone_variations"] = request.tone_variations
        
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields provided to update"
            )
        
        success = firestore_client.update_template(
            template_id=template_id,
            user_id=user_id,
            template_data=update_data
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with id '{template_id}' not found"
            )
        
        return {"success": True, "message": "Template updated successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update template: {str(e)}"
        )


@router.delete("/v1/templates/{template_id}")
async def delete_template(
    template_id: str,
    user_id: str = Query(...)
):
    """
    Delete a template.
    
    Args:
        template_id: The ID of the template to delete
        user_id: The ID of the user (to verify ownership)
        
    Returns:
        Success response
    """
    try:
        firestore_client = _get_firestore()
        success = firestore_client.delete_template(
            template_id=template_id,
            user_id=user_id
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with id '{template_id}' not found"
            )
        
        return {"success": True, "message": "Template deleted successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete template: {str(e)}"
        )

