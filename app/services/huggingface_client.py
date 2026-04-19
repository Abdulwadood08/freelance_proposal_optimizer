"""HuggingFace client service for proposal generation."""

import json
import os
from typing import Any, Dict, Optional
from urllib import error, request

from app.services.proposal_prompt_builder import build_proposal_generation_prompt


class HuggingFaceClient:
    """HuggingFace inference wrapper for proposal generation."""

    def __init__(self):
        """Initialize HuggingFace client using environment configuration."""
        self.model_id = os.getenv("HF_MODEL_ID")
        if not self.model_id:
            raise ValueError(
                "HF_MODEL_ID environment variable is not set. "
                "Please set it to your HuggingFace model id."
            )

        self.api_token = os.getenv("HF_API_TOKEN")
        self.base_url = os.getenv("HF_INFERENCE_URL", "https://api-inference.huggingface.co/models")

    def _extract_json_object(self, raw_text: str) -> Dict[str, Any]:
        """Extract and parse JSON from model output."""
        try:
            return json.loads(raw_text)
        except json.JSONDecodeError:
            # Some models may return extra text around JSON.
            first = raw_text.find("{")
            last = raw_text.rfind("}")
            if first == -1 or last == -1 or last <= first:
                raise ValueError("Model output did not contain valid JSON.")
            return json.loads(raw_text[first:last + 1])

    def _normalize_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize response shape to backend contract."""
        proposal = str(result.get("proposal", "")).strip()
        cover_letter = str(result.get("cover_letter", "")).strip()
        tone_variations = result.get("tone_variations") or {}

        if not isinstance(tone_variations, dict):
            tone_variations = {}

        normalized_tones = {
            "professional": str(tone_variations.get("professional", "")).strip(),
            "friendly": str(tone_variations.get("friendly", "")).strip(),
            "confident": str(tone_variations.get("confident", "")).strip(),
        }

        # If model did not generate all fields, gracefully backfill from main proposal.
        if not cover_letter:
            cover_letter = proposal
        for tone_name, tone_value in normalized_tones.items():
            if not tone_value:
                normalized_tones[tone_name] = proposal

        if not proposal:
            raise ValueError("HuggingFace response did not contain a proposal.")

        return {
            "proposal": proposal,
            "cover_letter": cover_letter,
            "tone_variations": normalized_tones,
        }

    def generate_proposal(
        self,
        user_skills: list,
        case_studies: list,
        job_post: str,
        preferred_tone: str = "professional",
        proposal_length: str = "medium",
        winning_patterns: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Generate a tailored proposal from a fine-tuned HuggingFace model."""
        prompt = build_proposal_generation_prompt(
            user_skills=user_skills,
            case_studies=case_studies,
            job_post=job_post,
            preferred_tone=preferred_tone,
            proposal_length=proposal_length,
            winning_patterns=winning_patterns,
        )

        endpoint = f"{self.base_url.rstrip('/')}/{self.model_id}"
        payload = {
            "inputs": prompt,
            "parameters": {
                "temperature": 0.7,
                "max_new_tokens": 1000,
                "return_full_text": False,
            },
        }

        headers = {"Content-Type": "application/json"}
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"

        req = request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=60) as response:
                raw = response.read().decode("utf-8")
                parsed = json.loads(raw)

            generated_text = None
            if isinstance(parsed, list) and parsed:
                generated_text = parsed[0].get("generated_text")
            elif isinstance(parsed, dict):
                generated_text = parsed.get("generated_text")
                if not generated_text and parsed.get("error"):
                    raise ValueError(f"HuggingFace inference error: {parsed['error']}")

            if not generated_text:
                raise ValueError("Unexpected HuggingFace response format.")

            result = self._extract_json_object(generated_text)
            return self._normalize_result(result)

        except error.HTTPError as e:
            body = e.read().decode("utf-8", errors="ignore")
            raise ValueError(f"HuggingFace request failed with status {e.code}: {body}")
        except error.URLError as e:
            raise ValueError(f"HuggingFace request failed: {str(e)}")
        except Exception as e:
            raise ValueError(f"Failed to generate proposal via HuggingFace: {str(e)}")


_huggingface_client = None


def get_huggingface_client() -> HuggingFaceClient:
    """Get or create HuggingFace client instance (singleton pattern)."""
    global _huggingface_client
    if _huggingface_client is None:
        _huggingface_client = HuggingFaceClient()
    return _huggingface_client
