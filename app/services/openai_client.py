"""OpenAI client service for GPT API calls."""
import os
from typing import Dict, Any
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
        job_post: str
    ) -> Dict[str, Any]:
        """
        Generate a tailored Upwork proposal using GPT-4.1-mini.
        
        Args:
            user_skills: List of user skills
            case_studies: List of case studies
            job_post: The job post text
            
        Returns:
            Dictionary containing proposal, cover_letter, and tone_variations
        """
        skills_text = ", ".join(user_skills) if user_skills else "Not specified"
        case_studies_text = "\n".join([f"- {cs}" for cs in case_studies]) if case_studies else "None"
        
        prompt = f"""You are an expert freelance proposal writer. Generate a tailored Upwork proposal based on the following information:

User Skills: {skills_text}

Case Studies:
{case_studies_text}

Job Post:
{job_post}

Generate a comprehensive proposal that:
1. Highlights relevant skills that match the job requirements
2. References specific case studies that demonstrate expertise
3. Shows understanding of the client's needs
4. Is compelling and professional

Provide your response in the following JSON format:
{{
  "proposal": "Full proposal text (3-4 paragraphs)",
  "cover_letter": "Brief cover letter (1-2 paragraphs)",
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


# Global instance
_openai_client = None


def get_openai_client() -> OpenAIClient:
    """Get or create OpenAI client instance (singleton pattern)."""
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAIClient()
    return _openai_client

