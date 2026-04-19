"""LLM provider routing for task-specific model selection."""

import os
import logging
from typing import Any, Dict

from app.services.huggingface_client import get_huggingface_client
from app.services.openai_client import get_openai_client

logger = logging.getLogger(__name__)


def _normalized_provider(env_name: str, default: str) -> str:
    """Normalize provider selection from env vars."""
    return os.getenv(env_name, default).strip().lower()


def _fallback_enabled() -> bool:
    """Check if generation fallback to OpenAI is enabled."""
    value = os.getenv("PROPOSAL_GENERATION_FALLBACK_TO_OPENAI", "true").strip().lower()
    return value in {"1", "true", "yes", "on"}


def get_generation_client():
    """
    Return provider for proposal generation.

    Environment:
    - PROPOSAL_GENERATION_PROVIDER: huggingface | openai
    """
    provider = _normalized_provider("PROPOSAL_GENERATION_PROVIDER", "huggingface")
    if provider == "openai":
        return get_openai_client()
    return get_huggingface_client()


def generate_proposal_with_routing(**kwargs) -> Dict[str, Any]:
    """
    Generate proposal with configured provider and optional fallback.

    Primary provider is configured by PROPOSAL_GENERATION_PROVIDER.
    If provider is HuggingFace and call fails, fallback to OpenAI when
    PROPOSAL_GENERATION_FALLBACK_TO_OPENAI is enabled.
    """
    provider = _normalized_provider("PROPOSAL_GENERATION_PROVIDER", "huggingface")
    fallback_to_openai = _fallback_enabled()

    if provider == "openai":
        return get_openai_client().generate_proposal(**kwargs)

    try:
        return get_huggingface_client().generate_proposal(**kwargs)
    except Exception as exc:
        if not fallback_to_openai:
            raise
        logger.warning(
            "HuggingFace proposal generation failed, falling back to OpenAI: %s",
            str(exc),
        )
        return get_openai_client().generate_proposal(**kwargs)


def get_analysis_client():
    """
    Return provider for job analysis.

    Analysis currently stays on OpenAI.
    """
    return get_openai_client()


def get_scoring_client():
    """
    Return provider for proposal scoring.

    Scoring currently stays on OpenAI.
    """
    return get_openai_client()
