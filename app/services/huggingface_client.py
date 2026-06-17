import os
from typing import Optional

import requests

from app.services.proposal_prompt_builder import _format_case_studies


class HuggingFaceClient:
    def __init__(self):
        self.model_server_url = os.getenv("MODEL_SERVER_URL", "https://speckled-thirty-size.ngrok-free.dev").rstrip("/")
        self.model_name = "llama3.2"

    def _call_model(self, prompt: str) -> str:
        """Call model server and return trimmed proposal text."""
        result = None
        last_error = None
        for endpoint in ("/api/generate", "/generate"):
            try:
                response = requests.post(
                    f"{self.model_server_url}{endpoint}",
                    json={
                        "model": self.model_name,
                        "prompt": prompt,
                        "stream": False
                    },
                    headers={
                        "Accept": "application/json",
                        "ngrok-skip-browser-warning": "true",
                    },
                    timeout=120
                )
                response.raise_for_status()
                try:
                    result = response.json()
                except ValueError as json_error:
                    body_preview = response.text[:300].replace("\n", " ").strip()
                    raise ValueError(
                        f"Non-JSON response from model server at {endpoint} "
                        f"(status {response.status_code}): {body_preview}"
                    ) from json_error
                break
            except Exception as endpoint_error:
                last_error = endpoint_error

        if result is None:
            raise ValueError(f"All model endpoints failed: {last_error}")

        proposal = result.get("response", "").strip()
        if not proposal:
            raise ValueError(f"Model server returned empty response payload: {result}")
        return proposal

    def _build_prompt(
        self,
        user_skills,
        case_studies,
        job_post,
        tone,
        proposal_length,
        freelancer_display_name: Optional[str] = None,
        job_grounding_context: Optional[str] = None,
    ):
        length_ranges = {
            "short": "100-140 words",
            "medium": "150-220 words",
            "long": "230-320 words",
        }
        length_hint = length_ranges.get(proposal_length, "150-220 words")
        job_text = (job_post or "")[:8000]
        cs_text = _format_case_studies(case_studies or [])
        signer = (freelancer_display_name or "").strip()
        sign_line = (
            f'End with "Best regards," then a new line, then exactly: {signer}'
            if signer
            else 'End with "Best regards," then your name (no placeholders like [Name]).'
        )
        grounding = ""
        if (job_grounding_context or "").strip():
            grounding = (
                "\nAlignment focus (stay on these + job text only):\n"
                f"{job_grounding_context.strip()}\n"
            )

        return f"""You are an expert Upwork freelancer. Write ONE proposal for THIS job only.

Full Job Post:
{job_text}
{grounding}
Case Studies (mention only if relevant to this job):
{cs_text}

Freelancer Skills (use ONLY items relevant to this job; ignore unrelated resume skills): {', '.join(user_skills[:20]) if user_skills else 'Not specified'}

Tone: {tone} (professional = calm and business-like; never aggressive or salesy)
Length: {length_hint}

Requirements:
- Every paragraph must relate to deliverables and tools named in the Job Post. Do NOT discuss unrelated domains.
- Open with a hook tied to the client's stated task.
- Practical execution plan aligned with the posting.
- Clear call to action.
- Start with "Dear Hiring Manager," or "Dear Client,"
- {sign_line}
- Return only proposal body text (no title, no markdown, no bullet meta-commentary)

Proposal:"""

    def generate_proposal(
        self,
        user_skills,
        case_studies,
        job_post,
        preferred_tone="professional",
        proposal_length="medium",
        winning_patterns=None,
        freelancer_display_name=None,
        job_grounding_context=None,
        **_kwargs,
    ):
        try:
            selected_tone = preferred_tone if preferred_tone in {"professional", "friendly", "confident"} else "professional"
            proposal = self._call_model(
                self._build_prompt(
                    user_skills,
                    case_studies,
                    job_post,
                    selected_tone,
                    proposal_length,
                    freelancer_display_name=freelancer_display_name,
                    job_grounding_context=job_grounding_context,
                )
            )

            tone_variations = {
                "professional": "",
                "friendly": "",
                "confident": "",
            }
            tone_variations[selected_tone] = proposal

            return {
                "proposal": proposal,
                "cover_letter": proposal,
                "tone_variations": tone_variations,
            }
        except Exception as e:
            raise ValueError(f"Model server error: {str(e)}")


def get_huggingface_client():
    return HuggingFaceClient()
