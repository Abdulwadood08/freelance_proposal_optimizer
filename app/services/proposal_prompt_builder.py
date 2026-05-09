"""Shared prompt building utilities for proposal generation providers."""

from typing import Any, Dict, Optional


def _format_case_studies(case_studies: list) -> str:
    """Format case studies for prompt injection."""
    if not case_studies:
        return "None"

    formatted_studies = []
    for cs in case_studies:
        if isinstance(cs, dict):
            study_text = f"Title: {cs.get('title', 'N/A')}"
            if cs.get("description"):
                study_text += f"\nDescription: {cs.get('description')}"
            if cs.get("achievements"):
                study_text += f"\nAchievements: {cs.get('achievements')}"
            if cs.get("technologies"):
                technologies = ", ".join(cs.get("technologies", []))
                study_text += f"\nTechnologies: {technologies}"
            if cs.get("duration"):
                study_text += f"\nDuration: {cs.get('duration')}"
            formatted_studies.append(study_text)
        else:
            formatted_studies.append(str(cs))

    return "\n\n".join([f"- {cs}" for cs in formatted_studies])


def _build_learning_insights(winning_patterns: Optional[Dict[str, Any]]) -> str:
    """Build winning pattern guidance block."""
    if not winning_patterns:
        return ""

    insights = []
    if winning_patterns.get("best_tone"):
        insights.append(
            f"User's most successful proposals used '{winning_patterns['best_tone']}' tone"
        )
    if winning_patterns.get("best_length"):
        insights.append(
            f"User's most successful proposals were '{winning_patterns['best_length']}' length"
        )
    if winning_patterns.get("common_phrases"):
        phrases = ", ".join(winning_patterns["common_phrases"][:3])
        insights.append(f"Effective phrases to include: {phrases}")

    if not insights:
        return ""

    return "\n\nLEARNING FROM SUCCESS:\n" + "\n".join([f"- {insight}" for insight in insights])


def build_proposal_generation_prompt(
    user_skills: list,
    case_studies: list,
    job_post: str,
    preferred_tone: str = "professional",
    proposal_length: str = "medium",
    winning_patterns: Optional[Dict[str, Any]] = None,
    freelancer_display_name: Optional[str] = None,
    job_grounding_context: Optional[str] = None,
) -> str:
    """Build provider-agnostic proposal generation prompt."""
    skills_text = ", ".join(user_skills) if user_skills else "Not specified"
    case_studies_text = _format_case_studies(case_studies)
    learning_insights = _build_learning_insights(winning_patterns)

    tone_descriptions = {
        "professional": "professional, formal, and business-like",
        "friendly": "friendly, warm, approachable, and personable",
        "confident": "confident, assertive, and self-assured",
        "balanced": "balanced mix of professional and friendly",
    }
    tone_description = tone_descriptions.get(preferred_tone, "professional")

    length_guidelines = {
        "short": "2-3 paragraphs (concise and to the point)",
        "medium": "3-4 paragraphs (comprehensive but not too long)",
        "long": "4-5 paragraphs (detailed and thorough)",
    }
    length_guideline = length_guidelines.get(proposal_length, "3-4 paragraphs")

    signer = (freelancer_display_name or "").strip()
    sign_off_rule = (
        f'- End with "Best regards," then a new line, then exactly this signature line: {signer}'
        if signer
        else '- End with "Best regards," then your first and last name on the next line (use only the name implied by the profile/case studies; never use placeholders like [Name]).'
    )

    grounding_block = ""
    if (job_grounding_context or "").strip():
        grounding_block = (
            "\n\nJOB ALIGNMENT CHECKLIST (proposal MUST stay faithful to these points "
            "and to the Job Post; do not drift into unrelated resume topics):\n"
            f"{job_grounding_context.strip()}\n"
        )

    return f"""You are an expert freelance proposal writer. Generate a tailored Upwork proposal based on the following information:

User Skills (mention ONLY skills/tools that honestly apply AND are relevant to this specific job — ignore unrelated resume skills): {skills_text}

Case Studies:
{case_studies_text}

Job Post:
{job_post}
{grounding_block}{learning_insights}

IMPORTANT INSTRUCTIONS:
- Preferred Tone: {tone_description}
- Proposal Length: {length_guideline}
- The main proposal should match the preferred tone ({preferred_tone})
- Grounding: Base every paragraph on the Job Title and Job Description. Do NOT pivot to unrelated domains (e.g. accounting or unrelated ads stacks) unless the job explicitly asks for them.
- Skills: Only highlight skills from the user list that clearly match this job. Do not name-drop tools/platforms absent from the job unless they are standard for the stated work and you tie them to requested outcomes.
- Case studies: Prefer referencing case studies when they match this job; otherwise keep claims general and truthful.
- Use proposal letter formatting:
  - Start with "Dear Hiring Manager," or "Dear Client," (do not invent a client personal name unless provided in the Job Post context block).
  {sign_off_rule}

Generate a comprehensive proposal that:
1. Opens by reflecting the client's stated problem and deliverables from the Job Post
2. Highlights only relevant matching skills and an execution plan tied to those deliverables
3. References specific case studies only when they support this type of work
4. Matches the preferred tone: {tone_description}
5. Follows the length guideline: {length_guideline}

Provide your response in the following JSON format:
{{
  "proposal": "Full proposal text matching preferred tone and length ({length_guideline})",
  "cover_letter": "Brief cover letter (1-2 paragraphs) matching preferred tone"
}}

Return ONLY valid JSON, no additional text or markdown formatting."""
