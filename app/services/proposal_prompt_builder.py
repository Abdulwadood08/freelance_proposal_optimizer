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

    return f"""You are an expert freelance proposal writer. Generate a tailored Upwork proposal based on the following information:

User Skills: {skills_text}

Case Studies:
{case_studies_text}

Job Post:
{job_post}
{learning_insights}

IMPORTANT INSTRUCTIONS:
- Preferred Tone: {tone_description}
- Proposal Length: {length_guideline}
- The main proposal should match the preferred tone ({preferred_tone})
- Still generate all three tone variations (professional, friendly, confident) for flexibility
- Use proposal letter formatting:
  - Start with "Dear Hiring Manager," (or "Dear Client,")
  - End with a professional sign-off like "Best regards," followed by a freelancer name placeholder

Generate a comprehensive proposal that:
1. Highlights relevant skills that match the job requirements
2. References specific case studies that demonstrate expertise
3. Shows understanding of the client's needs
4. Matches the preferred tone: {tone_description}
5. Follows the length guideline: {length_guideline}
6. Includes greeting and sign-off formatting

Provide your response in the following JSON format:
{{
  "proposal": "Full proposal text matching preferred tone and length ({length_guideline})",
  "cover_letter": "Brief cover letter (1-2 paragraphs) matching preferred tone",
  "tone_variations": {{
    "professional": "Professional version of the proposal",
    "friendly": "Friendly and approachable version",
    "confident": "Confident and assertive version"
  }}
}}

Return ONLY valid JSON, no additional text or markdown formatting."""
