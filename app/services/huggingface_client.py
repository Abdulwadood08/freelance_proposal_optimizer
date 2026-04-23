import requests
import os


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

    def _build_prompt(self, user_skills, job_post, tone, proposal_length):
        length_ranges = {
            "short": "100-140 words",
            "medium": "150-220 words",
            "long": "230-320 words",
        }
        length_hint = length_ranges.get(proposal_length, "150-220 words")
        return f"""You are an expert Upwork freelancer. Write a winning proposal for this job.

Job Post: {job_post[:1200]}
Freelancer Skills: {', '.join(user_skills[:12]) if user_skills else 'Not specified'}
Tone: {tone}
Length: {length_hint}

Requirements:
- Open with a strong and relevant hook
- Show understanding of the client's problem
- Highlight matching skills and practical execution plan
- End with a clear call to action
- Start with "Dear Hiring Manager," (or "Dear Client,")
- End with "Best regards," followed by a freelancer name placeholder
- Return only proposal text (no title, no markdown)

Proposal:"""

    def generate_proposal(self, user_skills, case_studies, job_post,
                         preferred_tone="professional", proposal_length="medium",
                         winning_patterns=None):
        try:
            proposal = self._call_model(
                self._build_prompt(user_skills, job_post, preferred_tone, proposal_length)
            )

            tone_variations = {}
            for tone in ("professional", "friendly", "confident"):
                if tone == preferred_tone:
                    tone_variations[tone] = proposal
                    continue
                try:
                    tone_variations[tone] = self._call_model(
                        self._build_prompt(user_skills, job_post, tone, proposal_length)
                    )
                except Exception:
                    # Safe fallback: keep service resilient if one variation call fails.
                    tone_variations[tone] = proposal

            return {
                "proposal": proposal,
                "cover_letter": proposal,
                "tone_variations": tone_variations,
            }
        except Exception as e:
            raise ValueError(f"Model server error: {str(e)}")


def get_huggingface_client():
    return HuggingFaceClient()
