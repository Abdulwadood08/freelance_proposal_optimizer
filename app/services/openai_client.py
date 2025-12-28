"""OpenAI client service for GPT API calls."""
import os
from typing import Dict, Any, Optional
from openai import OpenAI


class OpenAIClient:
    """OpenAI client wrapper for API operations."""
    
    def __init__(self):
        """Initialize OpenAI client using API key from environment."""
        api_key = os.getenv("OPENAI_API_KEY")
        
        if not api_key:
            raise ValueError(
                "OPENAI_API_KEY environment variable is not set. "
                "Please set it to your OpenAI API key."
            )
        
        self.client = OpenAI(api_key=api_key)
    
    def generate_proposal(
        self, 
        user_skills: list, 
        case_studies: list, 
        job_post: str,
        preferred_tone: str = "professional",
        proposal_length: str = "medium",
        winning_patterns: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate a tailored Upwork proposal using GPT-4.1-mini.
        
        Args:
            user_skills: List of user skills
            case_studies: List of case studies
            job_post: The job post text
            preferred_tone: Preferred tone (professional, friendly, confident, balanced)
            proposal_length: Proposal length (short, medium, long)
            winning_patterns: Optional dict with patterns learned from successful proposals
            
        Returns:
            Dictionary containing proposal, cover_letter, and tone_variations
        """
        skills_text = ", ".join(user_skills) if user_skills else "Not specified"
        
        # Format case studies (handle both string and dict formats)
        case_studies_text = "None"
        if case_studies:
            formatted_studies = []
            for cs in case_studies:
                if isinstance(cs, dict):
                    # Structured case study
                    study_text = f"Title: {cs.get('title', 'N/A')}"
                    if cs.get('description'):
                        study_text += f"\nDescription: {cs.get('description')}"
                    if cs.get('achievements'):
                        study_text += f"\nAchievements: {cs.get('achievements')}"
                    if cs.get('technologies'):
                        techs = ", ".join(cs.get('technologies', []))
                        study_text += f"\nTechnologies: {techs}"
                    if cs.get('duration'):
                        study_text += f"\nDuration: {cs.get('duration')}"
                    formatted_studies.append(study_text)
                else:
                    # Simple string case study
                    formatted_studies.append(str(cs))
            case_studies_text = "\n\n".join([f"- {cs}" for cs in formatted_studies])
        
        # Map tone to description
        tone_descriptions = {
            "professional": "professional, formal, and business-like",
            "friendly": "friendly, warm, approachable, and personable",
            "confident": "confident, assertive, and self-assured",
            "balanced": "balanced mix of professional and friendly"
        }
        tone_description = tone_descriptions.get(preferred_tone, "professional")
        
        # Map length to paragraph count
        length_guidelines = {
            "short": "2-3 paragraphs (concise and to the point)",
            "medium": "3-4 paragraphs (comprehensive but not too long)",
            "long": "4-5 paragraphs (detailed and thorough)"
        }
        length_guideline = length_guidelines.get(proposal_length, "3-4 paragraphs")
        
        # Add learning from successful proposals
        learning_insights = ""
        if winning_patterns:
            insights = []
            if winning_patterns.get("best_tone"):
                insights.append(f"User's most successful proposals used '{winning_patterns['best_tone']}' tone")
            if winning_patterns.get("best_length"):
                insights.append(f"User's most successful proposals were '{winning_patterns['best_length']}' length")
            if winning_patterns.get("common_phrases"):
                insights.append(f"Effective phrases to include: {', '.join(winning_patterns['common_phrases'][:3])}")
            if insights:
                learning_insights = "\n\nLEARNING FROM SUCCESS:\n" + "\n".join([f"- {insight}" for insight in insights])
        
        prompt = f"""You are an expert freelance proposal writer. Generate a tailored Upwork proposal based on the following information:

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

Generate a comprehensive proposal that:
1. Highlights relevant skills that match the job requirements
2. References specific case studies that demonstrate expertise
3. Shows understanding of the client's needs
4. Matches the preferred tone: {tone_description}
5. Follows the length guideline: {length_guideline}

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
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert freelance proposal writer. Always respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.7
            )
            
            # Parse the JSON response
            import json
            result = json.loads(response.choices[0].message.content)
            
            return result
            
        except Exception as e:
            raise ValueError(f"Failed to generate proposal: {str(e)}")
    
    def analyze_job_post(
        self,
        job_post: str,
        user_skills: list,
        user_case_studies: list
    ) -> Dict[str, Any]:
        """
        Analyze a job post and provide smart suggestions.
        
        Args:
            job_post: The job post text to analyze
            user_skills: List of user's skills
            user_case_studies: List of user's case studies
            
        Returns:
            Dictionary with suggestions including:
            - relevant_skills: Skills from user profile that match the job
            - missing_skills: Skills mentioned in job but not in profile
            - recommended_case_studies: Which case studies to highlight
            - profile_gaps: Missing profile information
            - suggestions: General suggestions for improvement
        """
        skills_text = ", ".join(user_skills) if user_skills else "None"
        
        # Format case studies
        case_studies_text = "None"
        if user_case_studies:
            formatted_studies = []
            for i, cs in enumerate(user_case_studies):
                if isinstance(cs, dict):
                    study_text = f"Case Study {i+1}: {cs.get('title', 'N/A')}"
                    if cs.get('description'):
                        study_text += f"\n  Description: {cs.get('description')}"
                    if cs.get('technologies'):
                        study_text += f"\n  Technologies: {', '.join(cs.get('technologies', []))}"
                    formatted_studies.append(study_text)
                else:
                    formatted_studies.append(f"Case Study {i+1}: {str(cs)}")
            case_studies_text = "\n".join(formatted_studies)
        
        prompt = f"""Analyze this job post and provide smart suggestions for a freelancer with the following profile:

USER PROFILE:
Skills: {skills_text}

Case Studies:
{case_studies_text}

JOB POST:
{job_post}

Analyze the job post and provide suggestions in the following JSON format:
{{
  "relevant_skills": ["skill1", "skill2", ...],  // Skills from user profile that match the job requirements
  "missing_skills": ["skill1", "skill2", ...],  // Skills mentioned in job but not in user profile
  "recommended_case_studies": [1, 2, ...],  // Index numbers (1-based) of case studies most relevant to highlight
  "profile_gaps": ["gap1", "gap2", ...],  // Missing profile information that would help
  "suggestions": ["suggestion1", "suggestion2", ...],  // General suggestions for improving the proposal
  "job_summary": "Brief summary of what the job requires",  // What the job is about
  "key_requirements": ["req1", "req2", ...]  // Key requirements extracted from job post
}}

Return ONLY valid JSON, no additional text or markdown formatting."""
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert job post analyzer. Analyze job posts and provide actionable suggestions. Always respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.5  # Lower temperature for more consistent analysis
            )
            
            import json
            result = json.loads(response.choices[0].message.content)
            
            return result
            
        except Exception as e:
            raise ValueError(f"Failed to analyze job post: {str(e)}")
    
    def score_proposal_quality(
        self,
        proposal: str,
        job_post: str,
        user_skills: list
    ) -> Dict[str, Any]:
        """
        Score a proposal's quality and provide feedback.
        
        Args:
            proposal: The proposal text to score
            job_post: The original job post
            user_skills: List of user's skills
            
        Returns:
            Dictionary with:
            - score: Overall score from 1-10
            - strengths: List of strengths
            - weaknesses: List of weaknesses
            - suggestions: List of improvement suggestions
            - section_scores: Scores for different sections
        """
        skills_text = ", ".join(user_skills) if user_skills else "None"
        
        prompt = f"""Analyze this proposal and provide a quality score (1-10) with detailed feedback.

JOB POST:
{job_post}

USER SKILLS:
{skills_text}

PROPOSAL TO SCORE:
{proposal}

Evaluate the proposal based on:
1. Relevance to job requirements (0-2 points)
2. Clarity and professionalism (0-2 points)
3. Demonstration of skills and experience (0-2 points)
4. Compelling value proposition (0-2 points)
5. Call to action and engagement (0-2 points)

Provide your response in the following JSON format:
{{
  "score": 8,  // Overall score from 1-10
  "section_scores": {{
    "relevance": 2,  // 0-2
    "clarity": 2,  // 0-2
    "demonstration": 1,  // 0-2
    "value_proposition": 2,  // 0-2
    "call_to_action": 1  // 0-2
  }},
  "strengths": ["strength1", "strength2", ...],  // What the proposal does well
  "weaknesses": ["weakness1", "weakness2", ...],  // Areas that need improvement
  "suggestions": ["suggestion1", "suggestion2", ...],  // Specific improvement suggestions
  "overall_feedback": "Overall assessment of the proposal quality"
}}

Return ONLY valid JSON, no additional text or markdown formatting."""
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert proposal reviewer. Analyze proposals objectively and provide constructive feedback. Always respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.3  # Lower temperature for more consistent scoring
            )
            
            import json
            result = json.loads(response.choices[0].message.content)
            
            return result
            
        except Exception as e:
            raise ValueError(f"Failed to score proposal: {str(e)}")


# Global instance
_openai_client = None


def get_openai_client() -> OpenAIClient:
    """Get or create OpenAI client instance (singleton pattern)."""
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAIClient()
    return _openai_client

