import requests
import os


class HuggingFaceClient:
    def __init__(self):
        self.model_server_url = os.getenv("MODEL_SERVER_URL", "https://speckled-thirty-size.ngrok-free.dev").rstrip("/")
        self.model_name = "llama3.2"

    def generate_proposal(self, user_skills, case_studies, job_post,
                         preferred_tone="professional", proposal_length="medium",
                         winning_patterns=None):

        prompt = f"""You are an expert Upwork freelancer. Write a winning proposal for this job.

Job Post: {job_post[:500]}
Freelancer Skills: {', '.join(user_skills[:10]) if user_skills else 'Not specified'}
Tone: {preferred_tone}

Write a professional proposal in 150-200 words that:
- Opens with a strong hook
- Shows understanding of the client's problem
- Highlights relevant skills
- Ends with a clear call to action

Proposal:"""

        try:
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

            return {
                "proposal": proposal,
                "cover_letter": proposal,
                "tone_variations": {
                    "professional": proposal,
                    "friendly": proposal,
                    "confident": proposal
                }
            }
        except Exception as e:
            raise ValueError(f"Model server error: {str(e)}")


def get_huggingface_client():
    return HuggingFaceClient()
