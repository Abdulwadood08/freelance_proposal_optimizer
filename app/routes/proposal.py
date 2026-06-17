"""Proposal-related API endpoints."""
import logging
import os

from fastapi import APIRouter, HTTPException, status, Query, Header
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
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


from app.services.llm_router import (
    get_analysis_client,
    get_scoring_client,
)
from app.services.huggingface_client import get_huggingface_client
from app.services.openai_client import get_openai_client
from app.services.fit_score_service import calculate_fit_score

logger = logging.getLogger(__name__)
router = APIRouter()


def _freelancer_display_name(user_data: Optional[dict]) -> Optional[str]:
    if not user_data:
        return None
    name = (user_data.get("name") or user_data.get("full_name") or "").strip()
    return name or None


def _compose_plugin_job_post(
    *,
    job_title: str,
    job_description: str,
    job_url: Optional[str] = None,
    client_name: Optional[str] = None,
    job_skills: Optional[List[str]] = None,
    budget_display: Optional[str] = None,
    proposal_activity: Optional[str] = None,
    posted_time: Optional[str] = None,
    experience_level: Optional[str] = None,
    project_type_label: Optional[str] = None,
) -> str:
    """Single enriched job-post string for prompts (public listing fields only)."""
    title = (job_title or "").strip()
    desc = (job_description or "").strip()
    lines: List[str] = [f"Job Title: {title}", ""]
    meta: List[str] = []

    cn = (client_name or "").strip()
    if cn:
        meta.append(f"Client / listing label (public): {cn}")

    bd = (budget_display or "").strip()
    if bd:
        meta.append(f"Budget / rate shown on listing: {bd}")

    pt = (project_type_label or "").strip()
    if pt:
        meta.append(f"Engagement type (from listing): {pt}")

    el = (experience_level or "").strip()
    if el:
        meta.append(f"Experience level (from listing): {el}")

    pa = (proposal_activity or "").strip()
    if pa:
        meta.append(f"Proposal competition / activity (public): {pa}")

    pst = (posted_time or "").strip()
    if pst:
        meta.append(f"Posted (relative): {pst}")

    skills = [str(s).strip() for s in (job_skills or []) if str(s).strip()]
    if skills:
        bullet = "\n- ".join(skills[:45])
        meta.append(f"Skills / tags visible on this job:\n- {bullet}")

    if meta:
        lines.append(
            "PUBLIC JOB LISTING CONTEXT (factual fields only; do not infer private client data):"
        )
        lines.extend(meta)
        lines.append("")

    lines.append("Job Description:")
    lines.append(desc)
    lines.append("")
    lines.append(
        "PROPOSAL QUALITY: Mirror vocabulary from the title and description. "
        "Naturally include listing skill tags when they honestly apply — no keyword stuffing or fabrication."
    )

    ju = (job_url or "").strip()
    if ju:
        lines.extend(["", f"Job URL: {ju}"])

    return "\n".join(lines).strip()


def _generate_proposal_dual_backend(**kwargs):
    """
    Prefer OpenAI for grounded proposals (set PROPOSAL_PROVIDER_ORDER=hf_first to reverse).

    openai_first (default): OpenAI then HuggingFace/Ollama fallback.
    hf_first: HuggingFace/Ollama then OpenAI fallback.
    """
    order = os.getenv("PROPOSAL_PROVIDER_ORDER", "openai_first").strip().lower()
    if order == "hf_first":
        try:
            return get_huggingface_client().generate_proposal(**kwargs)
        except Exception as hf_error:
            logger.warning("HF/Ollama proposal failed, using OpenAI fallback: %s", hf_error)
            return get_openai_client().generate_proposal(**kwargs)
    try:
        return get_openai_client().generate_proposal(**kwargs)
    except Exception as oa_error:
        logger.warning("OpenAI proposal failed, using HF/Ollama fallback: %s", oa_error)
        return get_huggingface_client().generate_proposal(**kwargs)


PLUGIN_ANALYSIS_TEMPERATURE = 0.2
PLUGIN_PROPOSAL_TEMPERATURE = 0.35


def _normalize_proposal_length(value: Optional[str]) -> str:
    normalized = (value or "medium").strip().lower()
    if normalized in {"short", "medium", "long"}:
        return normalized
    return "medium"


def _analysis_result_from_cache(cache: PluginAnalysisCache) -> dict:
    return {
        "relevant_skills": list(cache.relevant_skills or []),
        "missing_skills": list(cache.missing_skills or []),
        "key_requirements": list(cache.key_requirements or []),
        "job_summary": cache.job_summary,
        "suggestions": list(cache.suggestions or []),
        "profile_gaps": list(cache.profile_gaps or []),
    }


def _plugin_analysis_cache_from_result(analysis_result: dict) -> PluginAnalysisCache:
    return PluginAnalysisCache(
        relevant_skills=analysis_result.get("relevant_skills", []) or [],
        missing_skills=analysis_result.get("missing_skills", []) or [],
        key_requirements=analysis_result.get("key_requirements", []) or [],
        job_summary=analysis_result.get("job_summary"),
        suggestions=analysis_result.get("suggestions", []) or [],
        profile_gaps=analysis_result.get("profile_gaps", []) or [],
    )


def _build_plugin_strategy(
    analysis_result: dict,
    *,
    relevant_skills: List[str],
    suggestions: List[str],
    profile_gaps: List[str],
) -> str:
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
    return (
        "\n\n".join(strategy_parts)
        if strategy_parts
        else "Highlight relevance and provide a strong call-to-action."
    )


def _build_job_grounding_from_analysis(analysis_result: dict) -> Optional[str]:
    parts: List[str] = []
    summary = (analysis_result.get("job_summary") or "").strip()
    if summary:
        parts.append(f"- Job focus (stay aligned): {summary}")
    for req in (analysis_result.get("key_requirements") or [])[:12]:
        rs = str(req).strip()
        if rs:
            parts.append(f"- Requirement from posting: {rs}")
    for sk in (analysis_result.get("relevant_skills") or [])[:10]:
        ss = str(sk).strip()
        if ss:
            parts.append(f"- Matching skill you may emphasize if truthful: {ss}")
    if not parts:
        return None
    return "\n".join(parts)


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


class ProposalGenerateImprovedResponse(ProposalResponse):
    """Schema for improved proposal generation response."""
    original_proposal: Optional[str] = None
    improved_proposal_candidate: Optional[str] = None
    score_before: Optional[float] = None
    score_after: Optional[float] = None
    improvement_attempted: bool = False
    improvement_applied: bool = False
    improvement_reason: Optional[str] = None


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
    job_url: Optional[str] = None
    client_name: Optional[str] = None
    job_skills: List[str] = Field(default_factory=list)
    budget_display: Optional[str] = None
    proposal_activity: Optional[str] = None
    posted_time: Optional[str] = None
    experience_level: Optional[str] = None
    project_type_label: Optional[str] = None


class PluginGenerateProposalResponse(BaseModel):
    """Schema for extension plugin proposal generation response."""
    id: Optional[str] = None
    proposal: str


class PluginAnalysisCache(BaseModel):
    """Cached job analysis for stable fit scoring on proposal regenerate."""
    relevant_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    key_requirements: List[str] = Field(default_factory=list)
    job_summary: Optional[str] = None
    suggestions: List[str] = Field(default_factory=list)
    profile_gaps: List[str] = Field(default_factory=list)


class PluginAnalyzeJobRequest(BaseModel):
    """Schema for full extension assistant analysis."""
    job_title: str
    job_description: str
    job_url: Optional[str] = None
    tone: Optional[str] = "professional"
    proposal_length: Optional[str] = "medium"
    reuse_analysis: bool = False
    analysis_cache: Optional[PluginAnalysisCache] = None
    client_name: Optional[str] = None
    job_skills: List[str] = Field(default_factory=list)
    budget_display: Optional[str] = None
    proposal_activity: Optional[str] = None
    posted_time: Optional[str] = None
    experience_level: Optional[str] = None
    project_type_label: Optional[str] = None


class PluginVariation(BaseModel):
    """Proposal variation payload."""
    tone: str
    proposal: str


class PluginAnalyzeJobResponse(BaseModel):
    """Schema for full extension assistant analysis response."""
    id: Optional[str] = None
    fit_score: int
    breakdown: dict
    keywords: List[str]
    strategy: str
    proposal: str
    variations: List[PluginVariation]
    analysis_cache: Optional[PluginAnalysisCache] = None


class PluginShortenProposalRequest(BaseModel):
    """Schema for shortening an existing plugin proposal draft."""
    job_title: str
    job_description: str
    proposal_text: str
    tone: Optional[str] = "professional"
    job_url: Optional[str] = None
    analysis_cache: Optional[PluginAnalysisCache] = None


class PluginShortenProposalResponse(BaseModel):
    """Shortened proposal plus optional refreshed fit score."""
    proposal: str
    fit_score: Optional[int] = None
    breakdown: Optional[dict] = None


class PluginRecommendBidRequest(BaseModel):
    """Schema for extension bid recommendation."""
    job_title: str
    job_description: str
    job_url: Optional[str] = None
    tone: Optional[str] = "professional"
    fit_score: Optional[int] = None
    client_budget_text: Optional[str] = None
    payment_type_hint: Optional[str] = None
    risk_level: Optional[str] = "balanced"  # conservative, balanced, aggressive
    client_name: Optional[str] = None
    job_skills: List[str] = Field(default_factory=list)
    budget_display: Optional[str] = None
    proposal_activity: Optional[str] = None
    posted_time: Optional[str] = None
    experience_level: Optional[str] = None
    project_type_label: Optional[str] = None


class PluginRecommendBidResponse(BaseModel):
    """Schema for extension bid recommendation response."""
    payment_type: str
    recommended_hourly_rate: Optional[float] = None
    recommended_fixed_bid: Optional[float] = None
    bid_range_low: Optional[float] = None
    bid_range_high: Optional[float] = None
    confidence: int
    positioning: str
    risk_flags: List[str]
    why_this_bid: List[str]
    negotiation_script: str
    fit_score: int


class ToneVariationGenerateRequest(BaseModel):
    """Schema for on-demand tone generation."""
    user_id: str
    tone: str  # professional, friendly, confident


class FeedbackCreateRequest(BaseModel):
    """Schema for storing proposal feedback."""
    user_id: str
    proposal_id: str
    job_id: str
    rating: int  # 1 (good) or -1 (bad)


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
        
        proposal_result = _generate_proposal_dual_backend(
            user_skills=user_skills,
            case_studies=case_studies,
            job_post=request.job_post,
            preferred_tone=request.preferred_tone or "professional",
            proposal_length=request.proposal_length or "medium",
            winning_patterns=winning_patterns if winning_patterns else None,
            freelancer_display_name=_freelancer_display_name(user_data),
            job_grounding_context=None,
        )
        
        # Validate the response structure
        if not all(key in proposal_result for key in ["proposal", "cover_letter", "tone_variations"]):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Invalid response format from OpenAI API"
            )
        tone_variations = proposal_result.get("tone_variations") or {}
        normalized_tone_variations = {
            "professional": tone_variations.get("professional", ""),
            "friendly": tone_variations.get("friendly", ""),
            "confident": tone_variations.get("confident", ""),
        }
        
        # 3. Save generated proposal to Firestore
        proposal_data = {
            "proposal": proposal_result["proposal"],
            "cover_letter": proposal_result["cover_letter"],
            "tone_variations": normalized_tone_variations,
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
            "tone_variations": normalized_tone_variations,
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
        if "HF_MODEL_ID" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="HuggingFace model is not configured. Please set HF_MODEL_ID environment variable."
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


@router.post("/v1/proposals/{proposal_id}/tone", response_model=ProposalResponse)
async def generate_tone_variation(proposal_id: str, request: ToneVariationGenerateRequest):
    """Generate a specific tone variation only when requested by the user."""
    try:
        target_tone = (request.tone or "").strip().lower()
        if target_tone not in {"professional", "friendly", "confident"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="tone must be one of: professional, friendly, confident",
            )

        firestore_client = _get_firestore()
        proposal_doc = firestore_client.get_proposal(proposal_id)
        if not proposal_doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Proposal with id '{proposal_id}' not found",
            )
        if proposal_doc.get("user_id") != request.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to update this proposal",
            )

        user_data = firestore_client.get_user(request.user_id)
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id '{request.user_id}' not found",
            )

        generated = _generate_proposal_dual_backend(
            user_skills=user_data.get("skills", []),
            case_studies=user_data.get("case_studies", []),
            job_post=proposal_doc.get("job_post", ""),
            preferred_tone=target_tone,
            proposal_length=proposal_doc.get("proposal_length", "medium"),
            winning_patterns=firestore_client.get_winning_patterns(request.user_id) or None,
            freelancer_display_name=_freelancer_display_name(user_data),
            job_grounding_context=None,
        )
        generated_text = (generated.get("proposal") or "").strip()
        if not generated_text:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Tone generation returned empty proposal text.",
            )

        existing_tones = proposal_doc.get("tone_variations") or {}
        updated_tones = {
            "professional": existing_tones.get("professional", ""),
            "friendly": existing_tones.get("friendly", ""),
            "confident": existing_tones.get("confident", ""),
        }
        updated_tones[target_tone] = generated_text

        update_data = {"tone_variations": updated_tones}
        if target_tone == (proposal_doc.get("preferred_tone") or "professional"):
            update_data["proposal"] = generated_text
            update_data["cover_letter"] = generated_text
            proposal_doc["proposal"] = generated_text
            proposal_doc["cover_letter"] = generated_text

        firestore_client.update_proposal(
            proposal_id=proposal_id,
            user_id=request.user_id,
            proposal_data=update_data,
        )

        return {
            "id": proposal_doc.get("id", proposal_id),
            "proposal": proposal_doc.get("proposal", ""),
            "cover_letter": proposal_doc.get("cover_letter", ""),
            "tone_variations": updated_tones,
            "job_post": proposal_doc.get("job_post"),
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
            detail=f"Failed to generate tone variation: {str(e)}",
        )


@router.post(
    "/v1/proposals/generate-improved",
    response_model=ProposalGenerateImprovedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_improved_proposal(request: ProposalGenerateRequest):
    """
    Generate proposal, score it, and auto-improve once if score is below threshold.
    """
    try:
        firestore_client = _get_firestore()
        user_data = firestore_client.get_user(request.user_id)
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id '{request.user_id}' not found",
            )

        user_skills = user_data.get("skills", [])
        case_studies = user_data.get("case_studies", [])
        winning_patterns = firestore_client.get_winning_patterns(request.user_id)

        base_result = _generate_proposal_dual_backend(
            user_skills=user_skills,
            case_studies=case_studies,
            job_post=request.job_post,
            preferred_tone=request.preferred_tone or "professional",
            proposal_length=request.proposal_length or "medium",
            winning_patterns=winning_patterns if winning_patterns else None,
            freelancer_display_name=_freelancer_display_name(user_data),
            job_grounding_context=None,
        )

        if not all(k in base_result for k in ["proposal", "cover_letter", "tone_variations"]):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Invalid response format from proposal generation provider.",
            )

        scoring_client = get_scoring_client()
        score_before_result = scoring_client.score_proposal_quality(
            proposal=base_result.get("proposal", ""),
            job_post=request.job_post,
            user_skills=user_skills,
        )

        try:
            score_before = float(score_before_result.get("score", 0))
        except (TypeError, ValueError):
            score_before = 0.0

        final_proposal = base_result.get("proposal", "")
        improved_candidate = None
        score_after = score_before
        improvement_attempted = False
        improvement_applied = False
        improvement_reason = "Initial score met threshold; no rewrite needed."

        if score_before < 8.0:
            improvement_attempted = True
            openai_client = get_openai_client()
            improved_proposal = openai_client.improve_proposal_once(
                proposal=base_result.get("proposal", ""),
                job_post=request.job_post,
                user_skills=user_skills,
                weaknesses=score_before_result.get("weaknesses", []),
                suggestions=score_before_result.get("suggestions", []),
                preferred_tone=request.preferred_tone or "professional",
                target_length=request.proposal_length or "medium",
                freelancer_display_name=_freelancer_display_name(user_data),
            )
            improved_candidate = improved_proposal

            score_after_result = scoring_client.score_proposal_quality(
                proposal=improved_proposal,
                job_post=request.job_post,
                user_skills=user_skills,
            )
            try:
                rescored = float(score_after_result.get("score", 0))
            except (TypeError, ValueError):
                rescored = score_before

            if rescored >= score_before:
                final_proposal = improved_proposal
                score_after = rescored
                improvement_applied = True
                improvement_reason = "Improved draft accepted (score maintained or increased)."
            else:
                score_after = rescored
                improvement_reason = "Improved draft rejected because score decreased."

        preferred_tone_key = (
            request.preferred_tone
            if request.preferred_tone in {"professional", "friendly", "confident"}
            else "professional"
        )
        base_tone_variations = base_result.get("tone_variations", {}) or {}
        # Preserve model-provided tone variants; only update selected tone when rewrite is accepted.
        tone_variations = {
            "professional": base_tone_variations.get(
                "professional", base_result.get("proposal", "")
            ),
            "friendly": base_tone_variations.get(
                "friendly", base_result.get("proposal", "")
            ),
            "confident": base_tone_variations.get(
                "confident", base_result.get("proposal", "")
            ),
        }
        if improvement_applied:
            tone_variations[preferred_tone_key] = final_proposal

        proposal_data = {
            "proposal": final_proposal,
            "cover_letter": final_proposal,
            "tone_variations": tone_variations,
            "job_post": request.job_post,
            "preferred_tone": request.preferred_tone or "professional",
            "proposal_length": request.proposal_length or "medium",
            "proposal_original": base_result.get("proposal", ""),
            "proposal_improved_candidate": improved_candidate,
            "score_before": score_before,
            "score_after": score_after,
            "improvement_attempted": improvement_attempted,
            "improvement_applied": improvement_applied,
            "improvement_reason": improvement_reason,
        }
        proposal_id = firestore_client.save_proposal(
            user_id=request.user_id,
            proposal_data=proposal_data,
        )

        return {
            "id": proposal_id,
            "proposal": final_proposal,
            "cover_letter": final_proposal,
            "tone_variations": tone_variations,
            "job_post": request.job_post,
            "original_proposal": base_result.get("proposal", ""),
            "improved_proposal_candidate": improved_candidate,
            "score_before": score_before,
            "score_after": score_after,
            "improvement_attempted": improvement_attempted,
            "improvement_applied": improvement_applied,
            "improvement_reason": improvement_reason,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate improved proposal: {str(e)}",
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

        budget_line = (request.budget_display or "").strip()
        job_post = _compose_plugin_job_post(
            job_title=request.job_title,
            job_description=request.job_description,
            job_url=request.job_url,
            client_name=request.client_name,
            job_skills=request.job_skills or [],
            budget_display=budget_line or None,
            proposal_activity=request.proposal_activity,
            posted_time=request.posted_time,
            experience_level=request.experience_level,
            project_type_label=request.project_type_label,
        )

        user_skills = user_data.get("skills", [])
        case_studies = user_data.get("case_studies", [])
        winning_patterns = firestore_client.get_winning_patterns(user_id)

        proposal_result = _generate_proposal_dual_backend(
            user_skills=user_skills,
            case_studies=case_studies,
            job_post=job_post,
            preferred_tone=request.tone or "professional",
            proposal_length="medium",
            winning_patterns=winning_patterns if winning_patterns else None,
            freelancer_display_name=_freelancer_display_name(user_data),
            job_grounding_context=None,
        )

        proposal_text = proposal_result.get("proposal", "").strip()
        if not proposal_text:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="OpenAI response did not contain a proposal.",
            )

        proposal_data = {
            "proposal": proposal_result.get("proposal", ""),
            "cover_letter": proposal_result.get("cover_letter", ""),
            "tone_variations": proposal_result.get("tone_variations", {}),
            "job_post": job_post,
            "preferred_tone": request.tone or "professional",
            "proposal_length": "medium",
            "source": "plugin_generate",
            "status": "draft",
        }
        proposal_id = firestore_client.save_proposal(user_id=user_id, proposal_data=proposal_data)

        return {"id": proposal_id, "proposal": proposal_text}
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

        budget_line = (request.budget_display or "").strip()
        job_post = _compose_plugin_job_post(
            job_title=request.job_title,
            job_description=request.job_description,
            job_url=request.job_url,
            client_name=request.client_name,
            job_skills=request.job_skills or [],
            budget_display=budget_line or None,
            proposal_activity=request.proposal_activity,
            posted_time=request.posted_time,
            experience_level=request.experience_level,
            project_type_label=request.project_type_label,
        )

        proposal_length = _normalize_proposal_length(request.proposal_length)
        analysis_client = get_analysis_client()

        if request.reuse_analysis and request.analysis_cache:
            analysis_result = _analysis_result_from_cache(request.analysis_cache)
        else:
            analysis_result = analysis_client.analyze_job_post(
                job_post=job_post,
                user_skills=user_skills,
                user_case_studies=case_studies,
                temperature=PLUGIN_ANALYSIS_TEMPERATURE,
            )

        job_grounding_context = _build_job_grounding_from_analysis(analysis_result)
        analysis_cache = _plugin_analysis_cache_from_result(analysis_result)

        proposal_result = _generate_proposal_dual_backend(
            user_skills=user_skills,
            case_studies=case_studies,
            job_post=job_post,
            preferred_tone=request.tone or "professional",
            proposal_length=proposal_length,
            winning_patterns=winning_patterns if winning_patterns else None,
            freelancer_display_name=_freelancer_display_name(user_data),
            job_grounding_context=job_grounding_context,
            temperature=PLUGIN_PROPOSAL_TEMPERATURE,
        )

        relevant_skills = analysis_result.get("relevant_skills", []) or []
        missing_skills = analysis_result.get("missing_skills", []) or []
        key_requirements = analysis_result.get("key_requirements", []) or []
        suggestions = analysis_result.get("suggestions", []) or []
        profile_gaps = analysis_result.get("profile_gaps", []) or []

        listing_skill_tokens = [str(s).strip() for s in (request.job_skills or []) if str(s).strip()]
        keywords = key_requirements + relevant_skills + listing_skill_tokens
        deduped_keywords = list(dict.fromkeys([str(k).strip() for k in keywords if str(k).strip()]))[
            :30
        ]

        strategy = _build_plugin_strategy(
            analysis_result,
            relevant_skills=relevant_skills,
            suggestions=suggestions,
            profile_gaps=profile_gaps,
        )

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

        fit_result = calculate_fit_score(
            relevant_skills=relevant_skills,
            missing_skills=missing_skills,
            key_requirements=key_requirements,
            user_data=user_data,
            job_post=job_post,
            proposal_text=proposal_text,
        )
        fit_score = fit_result["fit_score"]
        fit_breakdown = fit_result["breakdown"]

        proposal_data = {
            "proposal": proposal_text,
            "cover_letter": proposal_result.get("cover_letter", ""),
            "tone_variations": tone_variations,
            "job_post": job_post,
            "preferred_tone": request.tone or "professional",
            "proposal_length": proposal_length,
            "source": "plugin_analyze",
            "status": "draft",
            "fit_score": fit_score,
            "fit_breakdown": fit_breakdown,
            "analysis_keywords": deduped_keywords[:12],
            "analysis_strategy": strategy,
        }
        proposal_id = firestore_client.save_proposal(user_id=user_id, proposal_data=proposal_data)

        return {
            "id": proposal_id,
            "fit_score": fit_score,
            "breakdown": fit_breakdown,
            "keywords": deduped_keywords[:12],
            "strategy": strategy,
            "proposal": proposal_text,
            "variations": variations,
            "analysis_cache": analysis_cache,
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


@router.post("/plugin/shorten-proposal", response_model=PluginShortenProposalResponse)
async def shorten_proposal_from_plugin(
    request: PluginShortenProposalRequest,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
):
    """Shorten an existing proposal draft without re-running full job analysis."""
    try:
        user_id = _get_user_id_from_bearer_token(authorization)
        firestore_client = _get_firestore()

        user_data = firestore_client.get_user(user_id)
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found. Please complete your profile first.",
            )

        proposal_text = (request.proposal_text or "").strip()
        if not proposal_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="proposal_text is required.",
            )

        user_skills = user_data.get("skills", [])
        job_post = _compose_plugin_job_post(
            job_title=request.job_title,
            job_description=request.job_description,
            job_url=request.job_url,
            client_name=None,
            job_skills=[],
            budget_display=None,
        )

        openai_client = get_openai_client()
        shortened = openai_client.improve_proposal_once(
            proposal=proposal_text,
            job_post=job_post,
            user_skills=user_skills,
            weaknesses=["Proposal is longer than ideal for Upwork cover letters."],
            suggestions=[
                "Shorten by roughly 25-35% while keeping the strongest job-specific points.",
                "Keep one clear call-to-action.",
            ],
            preferred_tone=request.tone or "professional",
            target_length="short",
            freelancer_display_name=_freelancer_display_name(user_data),
        )

        fit_score = None
        fit_breakdown = None
        if request.analysis_cache:
            analysis_result = _analysis_result_from_cache(request.analysis_cache)
            fit_result = calculate_fit_score(
                relevant_skills=analysis_result.get("relevant_skills", []) or [],
                missing_skills=analysis_result.get("missing_skills", []) or [],
                key_requirements=analysis_result.get("key_requirements", []) or [],
                user_data=user_data,
                job_post=job_post,
                proposal_text=shortened,
            )
            fit_score = fit_result["fit_score"]
            fit_breakdown = fit_result["breakdown"]

        return {
            "proposal": shortened,
            "fit_score": fit_score,
            "breakdown": fit_breakdown,
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
            detail=f"Failed to shorten plugin proposal: {str(e)}",
        )


@router.post("/plugin/recommend-bid", response_model=PluginRecommendBidResponse)
async def recommend_bid_from_plugin(
    request: PluginRecommendBidRequest,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
):
    """Plugin endpoint: recommend a bid amount/range for the current job."""
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
        budget_line = (request.budget_display or "").strip() or (
            (request.client_budget_text or "").strip()
        )
        job_post = _compose_plugin_job_post(
            job_title=request.job_title,
            job_description=request.job_description,
            job_url=request.job_url,
            client_name=request.client_name,
            job_skills=request.job_skills or [],
            budget_display=budget_line or None,
            proposal_activity=request.proposal_activity,
            posted_time=request.posted_time,
            experience_level=request.experience_level,
            project_type_label=request.project_type_label,
        )

        if request.fit_score is not None:
            try:
                fit_score = int(request.fit_score)
            except (TypeError, ValueError):
                fit_score = 65
            fit_score = max(0, min(100, fit_score))
        else:
            analysis_client = get_analysis_client()
            analysis_result = analysis_client.analyze_job_post(
                job_post=job_post,
                user_skills=user_skills,
                user_case_studies=case_studies,
                temperature=PLUGIN_ANALYSIS_TEMPERATURE,
            )
            fit_result = calculate_fit_score(
                relevant_skills=analysis_result.get("relevant_skills", []) or [],
                missing_skills=analysis_result.get("missing_skills", []) or [],
                key_requirements=analysis_result.get("key_requirements", []) or [],
                user_data=user_data,
                job_post=job_post,
                proposal_text="",
            )
            fit_score = fit_result["fit_score"]

        bid = get_openai_client().recommend_bid(
            job_post=job_post,
            user_skills=user_skills,
            fit_score=fit_score,
            tone=request.tone or "professional",
            client_budget_text=request.client_budget_text or "",
            payment_type_hint=request.payment_type_hint or "",
            risk_level=request.risk_level or "balanced",
        )

        return {
            "payment_type": bid.get("payment_type", "hourly"),
            "recommended_hourly_rate": bid.get("recommended_hourly_rate"),
            "recommended_fixed_bid": bid.get("recommended_fixed_bid"),
            "bid_range_low": bid.get("bid_range_low"),
            "bid_range_high": bid.get("bid_range_high"),
            "confidence": bid.get("confidence", 65),
            "positioning": bid.get("positioning", ""),
            "risk_flags": bid.get("risk_flags", []),
            "why_this_bid": bid.get("why_this_bid", []),
            "negotiation_script": bid.get("negotiation_script", ""),
            "fit_score": fit_score,
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
            detail=f"Failed to recommend bid: {str(e)}",
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
        return jsonable_encoder(analytics)
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
        
        # 2. Call configured analysis provider (default OpenAI)
        analysis_client = get_analysis_client()
        analysis_result = analysis_client.analyze_job_post(
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
        
        # 2. Call configured scoring provider (default OpenAI)
        scoring_client = get_scoring_client()
        scoring_result = scoring_client.score_proposal_quality(
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


@router.post("/v1/feedback", status_code=status.HTTP_201_CREATED)
async def create_feedback(request: FeedbackCreateRequest):
    """Store user feedback for generated proposals."""
    try:
        if request.rating not in {1, -1}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="rating must be 1 (good) or -1 (bad).",
            )

        firestore_client = _get_firestore()
        feedback_id = firestore_client.save_feedback(
            user_id=request.user_id,
            proposal_id=request.proposal_id,
            job_id=request.job_id,
            rating=request.rating,
        )
        return {"success": True, "feedback_id": feedback_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save feedback: {str(e)}",
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

