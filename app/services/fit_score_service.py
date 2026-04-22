"""Weighted fit score calculation utilities."""

from typing import Any, Dict, List


FIT_SCORE_WEIGHTS = {
    "skills": 0.40,
    "experience": 0.30,
    "requirements": 0.20,
    "proposal": 0.10,
}


def _clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


def _safe_ratio(numerator: int, denominator: int, fallback: float = 0.0) -> float:
    if denominator <= 0:
        return fallback
    return numerator / denominator


def _score_skills(relevant_skills: List[str], missing_skills: List[str]) -> float:
    total = len(relevant_skills) + len(missing_skills)
    ratio = _safe_ratio(len(relevant_skills), total, fallback=0.6)
    return _clamp(ratio * 100.0)


def _score_experience(user_data: Dict[str, Any], job_post: str) -> float:
    profile_blob = " ".join(
        str(user_data.get(key, ""))
        for key in ["upwork_profile", "resume_url", "bio", "headline", "case_studies"]
    ).lower()
    job_blob = (job_post or "").lower()

    seniority_markers = ["senior", "lead", "expert", "5+ years", "3+ years", "years of experience"]
    profile_has_experience_markers = any(
        marker in profile_blob for marker in ["years", "senior", "lead", "expert"]
    )
    job_requires_seniority = any(marker in job_blob for marker in seniority_markers)

    if job_requires_seniority and profile_has_experience_markers:
        return 85.0
    if job_requires_seniority and not profile_has_experience_markers:
        return 50.0
    if not job_requires_seniority and profile_has_experience_markers:
        return 80.0
    return 65.0


def _score_requirements(
    key_requirements: List[str], relevant_skills: List[str], missing_skills: List[str]
) -> float:
    req_count = len(key_requirements)
    if req_count == 0:
        return _score_skills(relevant_skills, missing_skills)
    coverage_ratio = _safe_ratio(len(relevant_skills), req_count, fallback=0.6)
    return _clamp(coverage_ratio * 100.0)


def _score_proposal_strength(proposal_text: str) -> float:
    text = (proposal_text or "").strip()
    if not text:
        return 55.0

    word_count = len(text.split())
    has_call_to_action = any(
        phrase in text.lower() for phrase in ["let's", "discuss", "schedule", "call", "connect", "happy to"]
    )
    has_hook = text[0].isalpha() and len(text) > 20

    score = 60.0
    if 120 <= word_count <= 260:
        score += 20.0
    elif 80 <= word_count < 120 or 260 < word_count <= 350:
        score += 10.0

    if has_call_to_action:
        score += 12.0
    if has_hook:
        score += 8.0

    return _clamp(score)


def calculate_fit_score(
    *,
    relevant_skills: List[str],
    missing_skills: List[str],
    key_requirements: List[str],
    user_data: Dict[str, Any],
    job_post: str,
    proposal_text: str,
) -> Dict[str, Any]:
    skills = _score_skills(relevant_skills, missing_skills)
    experience = _score_experience(user_data, job_post)
    requirements = _score_requirements(key_requirements, relevant_skills, missing_skills)
    proposal = _score_proposal_strength(proposal_text)

    weighted_total = (
        skills * FIT_SCORE_WEIGHTS["skills"]
        + experience * FIT_SCORE_WEIGHTS["experience"]
        + requirements * FIT_SCORE_WEIGHTS["requirements"]
        + proposal * FIT_SCORE_WEIGHTS["proposal"]
    )

    return {
        "fit_score": int(round(_clamp(weighted_total))),
        "breakdown": {
            "skills": int(round(_clamp(skills))),
            "experience": int(round(_clamp(experience))),
            "requirements": int(round(_clamp(requirements))),
            "proposal": int(round(_clamp(proposal))),
        },
    }
