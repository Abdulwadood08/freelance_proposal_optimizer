"""Proposal-related API endpoints."""
import logging

from fastapi import APIRouter, HTTPException, status, Query, Header
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from typing import List, Optional
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

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


class PluginGenerateProposalRequest(BaseModel):
    """Schema for extension plugin proposal generation."""
    job_title: str
    job_description: str
    tone: Optional[str] = "professional"


class PluginGenerateProposalResponse(BaseModel):
    """Schema for extension plugin proposal generation response."""
    proposal: str


class PluginAnalyzeJobRequest(BaseModel):
    """Schema for full extension assistant analysis."""
    job_title: str
    job_description: str
    job_url: Optional[str] = None
    tone: Optional[str] = "professional"


class PluginVariation(BaseModel):
    """Proposal variation payload."""
    tone: str
    proposal: str


class PluginAnalyzeJobResponse(BaseModel):
    """Schema for full extension assistant analysis response."""
    fit_score: int
    keywords: List[str]
    strategy: str
    proposal: str
    variations: List[PluginVariation]


def _get_user_id_from_bearer_token(authorization: Optional[str]) -> str:
    """
    Parse and verify Firebase ID token from Authorization header.

    Returns:
        Firebase user id (uid / sub)
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header.",
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Expected Bearer token.",
        )

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer token.",
        )

    try:
        decoded = google_id_token.verify_firebase_token(token, google_requests.Request())
        if not decoded:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Firebase token.",
            )
        user_id = decoded.get("user_id") or decoded.get("uid") or decoded.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not extract user id from token.",
            )
        return user_id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
        ) from e


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


@router.post("/plugin/generate-proposal", response_model=PluginGenerateProposalResponse)
async def generate_proposal_from_plugin(
    request: PluginGenerateProposalRequest,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
):
    """
    Plugin endpoint: generate proposal from Upwork job data.

    Steps:
    1) Get user_id from Firebase token
    2) Load user profile from Firestore
    3) Build prompt input (job title + description)
    4) Reuse OpenAI proposal generation logic
    5) Return proposal text
    """
    try:
        user_id = _get_user_id_from_bearer_token(authorization)

        firestore_client = _get_firestore()
        user_data = firestore_client.get_user(user_id)
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found. Please complete your profile first.",
            )

        job_post = (
            f"Job Title: {request.job_title.strip()}\n\n"
            f"Job Description:\n{request.job_description.strip()}"
        )

        user_skills = user_data.get("skills", [])
        case_studies = user_data.get("case_studies", [])
        winning_patterns = firestore_client.get_winning_patterns(user_id)

        openai_client = get_openai_client()
        proposal_result = openai_client.generate_proposal(
            user_skills=user_skills,
            case_studies=case_studies,
            job_post=job_post,
            preferred_tone=request.tone or "professional",
            proposal_length="medium",
            winning_patterns=winning_patterns if winning_patterns else None,
        )

        proposal_text = proposal_result.get("proposal", "").strip()
        if not proposal_text:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="OpenAI response did not contain a proposal.",
            )

        return {"proposal": proposal_text}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate plugin proposal: {str(e)}",
        )


@router.post("/plugin/analyze-job", response_model=PluginAnalyzeJobResponse)
async def analyze_job_from_plugin(
    request: PluginAnalyzeJobRequest,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
):
    """
    Plugin endpoint: analyze job + generate strategy + proposal for Upwork pages.
    """
    try:
        user_id = _get_user_id_from_bearer_token(authorization)
        firestore_client = _get_firestore()

        user_data = firestore_client.get_user(user_id)
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found. Please complete your profile first.",
            )

        user_skills = user_data.get("skills", [])
        case_studies = user_data.get("case_studies", [])
        winning_patterns = firestore_client.get_winning_patterns(user_id)

        job_post = (
            f"Job Title: {request.job_title.strip()}\n\n"
            f"Job Description:\n{request.job_description.strip()}\n\n"
            f"Job URL: {(request.job_url or '').strip()}"
        )

        openai_client = get_openai_client()

        analysis_result = openai_client.analyze_job_post(
            job_post=job_post,
            user_skills=user_skills,
            user_case_studies=case_studies,
        )

        proposal_result = openai_client.generate_proposal(
            user_skills=user_skills,
            case_studies=case_studies,
            job_post=job_post,
            preferred_tone=request.tone or "professional",
            proposal_length="medium",
            winning_patterns=winning_patterns if winning_patterns else None,
        )

        relevant_skills = analysis_result.get("relevant_skills", []) or []
        missing_skills = analysis_result.get("missing_skills", []) or []
        key_requirements = analysis_result.get("key_requirements", []) or []
        suggestions = analysis_result.get("suggestions", []) or []
        profile_gaps = analysis_result.get("profile_gaps", []) or []

        match_ratio = (
            len(relevant_skills) / (len(relevant_skills) + len(missing_skills))
            if (len(relevant_skills) + len(missing_skills)) > 0
            else 0.6
        )
        fit_score = int(max(35, min(95, round(match_ratio * 100))))

        keywords = key_requirements + relevant_skills
        deduped_keywords = list(dict.fromkeys([str(k).strip() for k in keywords if str(k).strip()]))

        strategy_parts = []
        if analysis_result.get("job_summary"):
            strategy_parts.append(f"Job Summary: {analysis_result['job_summary']}")
        if relevant_skills:
            strategy_parts.append(
                "Lead with these matching skills: " + ", ".join(relevant_skills[:5])
            )
        if suggestions:
            strategy_parts.append("Execution strategy: " + " ".join(suggestions[:2]))
        if profile_gaps:
            strategy_parts.append(
                "Profile gaps to address briefly in proposal: " + ", ".join(profile_gaps[:3])
            )
        strategy = "\n\n".join(strategy_parts) if strategy_parts else "Highlight relevance and provide a strong call-to-action."

        tone_variations = proposal_result.get("tone_variations", {}) or {}
        variations = []
        for tone_name in ["professional", "friendly", "confident"]:
            if tone_variations.get(tone_name):
                variations.append(
                    {"tone": tone_name, "proposal": tone_variations[tone_name]}
                )

        proposal_text = (proposal_result.get("proposal") or "").strip()
        if not proposal_text:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="OpenAI response did not contain a proposal.",
            )

        return {
            "fit_score": fit_score,
            "keywords": deduped_keywords[:12],
            "strategy": strategy,
            "proposal": proposal_text,
            "variations": variations,
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze plugin job: {str(e)}",
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

