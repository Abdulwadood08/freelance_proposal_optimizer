"""HuggingFace client service for proposal generation.

Calls the fine-tuned model running on MODEL_SERVER_URL as the primary provider.
Falls back to OpenAI if the own server is unavailable or returns an error.
"""

import json
import os
import re
import ssl
from typing import Any, Dict, List, Optional
from urllib import error as url_error


from app.services.proposal_prompt_builder import build_proposal_generation_prompt


def _clean_proposal(proposal: str, freelancer_name: str = "") -> str:
    proposal = re.sub(r'Dear\s*,', "Hi,", proposal)
    proposal = re.sub(r'Hello\s*,', "Hi,", proposal)
    proposal = re.sub(r'Hello \[.*?\],', "Hi,", proposal)
    proposal = re.sub(r'Hi \[.*?\],', "Hi,", proposal)
    proposal = re.sub(r'\[X\+? years?\]', "5+ years", proposal)
    proposal = re.sub(r'\[X years?\]', "5 years", proposal)
    proposal = re.sub(r'\[Your Name\]', freelancer_name if freelancer_name else "", proposal)
    proposal = re.sub(r'\[Your Upwork Profile Link\]', "", proposal)
    proposal = re.sub(r'\[Your Contact Information\]', "", proposal)
    proposal = re.sub(r'\(https?://[^\)]+\)', "", proposal)
    proposal = re.sub(r'https?://\S+', "", proposal)
    proposal = re.sub(r'\[.*?\]', "", proposal)
    proposal = re.sub(r'\*\s*\n', "", proposal)
    proposal = re.sub(r'\n{3,}', '\n\n', proposal)
    return proposal.strip()


SYSTEM_PROMPT = """You are an expert Upwork proposal writer. Your job is 
to write highly personalised, winning proposals based on the job posting 
and freelancer profile provided.

Rules you must always follow:
- Open with a line that directly addresses the client's specific problem
- Mention the freelancer's exact tools and technologies by name
- Reference relevant past projects from the freelancer's profile
- Include the project timeline or budget naturally in the proposal
- Never use placeholder text like [Your Name] or [X years]
- Never invent portfolio links or URLs
- Keep tone professional but conversational
- Length: 150-250 words
- End with a clear call to action
- Do NOT start with I am writing to apply or generic openers"""


class HuggingFaceClient:

    def __init__(self):
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.model_id = os.getenv("HF_MODEL_ID", "Abdulwadood08/upwork-proposal-model")
        self.model_server_url = (os.getenv("MODEL_SERVER_URL", "")).rstrip("/")

        if not self.model_server_url and not self.openai_api_key:
            raise ValueError(
                "Neither MODEL_SERVER_URL nor OPENAI_API_KEY is set. "
                "At least one must be provided."
            )

    def _build_ssl_context(self):
        ca_bundle = (
            os.getenv("HF_CA_BUNDLE")
            or os.getenv("SSL_CERT_FILE")
            or os.getenv("REQUESTS_CA_BUNDLE")
        )
        if not ca_bundle:
            try:
                import certifi

                ca_bundle = certifi.where()
            except Exception:
                ca_bundle = None

        if ca_bundle:
            return ssl.create_default_context(cafile=ca_bundle)
        return ssl.create_default_context()

    def _build_user_message(self, user_skills, case_studies, job_post,
                             preferred_tone, proposal_length, winning_patterns):
        skills_str = ", ".join(user_skills) if user_skills else "Not specified"
        past_projects = ""
        if case_studies:
            lines = []
            for cs in case_studies[:3]:
                if isinstance(cs, dict):
                    title = cs.get("title", "")
                    result = cs.get("result", cs.get("description", ""))
                    if title:
                        lines.append(f"- {title}: {result}")
                elif isinstance(cs, str):
                    lines.append(f"- {cs}")
            past_projects = "\n".join(lines)

        length_map = {"short": "100-150 words", "medium": "150-250 words", "long": "250-350 words"}
        length_instruction = length_map.get(proposal_length, "150-250 words")
        winning_hint = f"\n\nWinning pattern hints: {json.dumps(winning_patterns)}" if winning_patterns else ""

        return f"""Write a {preferred_tone} Upwork proposal ({length_instruction}).

### Job Posting:
{job_post}

### Freelancer Profile:
Skills: {skills_str}
Past Projects:
{past_projects if past_projects else 'Not provided'}{winning_hint}

### Proposal:"""

    def _post_json(self, url, headers, payload, timeout=60):
        import urllib.request as url_request
        req = url_request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        ssl_context = self._build_ssl_context()
        try:
            with url_request.urlopen(req, timeout=timeout, context=ssl_context) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except url_error.HTTPError as http_err:
            body = http_err.read().decode("utf-8", errors="ignore")
            raise ValueError(f"HTTP {http_err.code} response from {url}: {body}") from http_err

    def _generate_via_own_server(
        self,
        job_title: str = "",
        job_description: str = "",
        budget: str = "",
        country: str = "",
        freelancer_name: str = "",
        skills: List[str] = None,
        experience: str = "",
        past_projects: str = "",
    ) -> str:
        if not self.model_server_url:
            raise ValueError("MODEL_SERVER_URL is not configured.")

        url = f"{self.model_server_url}/generate"
        headers = {"Content-Type": "application/json"}
        payload = {
            "job_title": job_title,
            "job_description": job_description,
            "budget": budget,
            "country": country,
            "freelancer_name": freelancer_name,
            "skills": ", ".join(skills) if skills else "",
            "experience": experience,
            "past_projects": past_projects,
        }
        data = self._post_json(url, headers, payload)
        proposal = data.get("proposal") or data.get("generated_text") or data.get("text")
        if not proposal:
            raise ValueError(f"Own server returned no proposal text. Response: {data}")
        return proposal

    def _generate_via_openai(self, user_message):
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.openai_api_key}",
        }
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            "temperature": 0.7,
            "max_tokens": 1000,
        }
        data = self._post_json(
            "https://api.openai.com/v1/chat/completions", headers, payload
        )
        return data["choices"][0]["message"]["content"]

    def _normalize_result(self, raw_proposal, user_skills):
        cleaned = _clean_proposal(raw_proposal)
        if not cleaned:
            raise ValueError("Model returned an empty proposal after cleaning.")
        return {
            "proposal": cleaned,
            "cover_letter": cleaned,
            "tone_variations": {
                "professional": cleaned,
                "friendly": cleaned,
                "confident": cleaned,
            },
        }

    def _build_past_projects_str(self, case_studies) -> str:
        if not case_studies:
            return ""
        lines = []
        for cs in case_studies[:3]:
            if isinstance(cs, dict):
                title = cs.get("title", "")
                result = cs.get("result", cs.get("description", ""))
                if title:
                    lines.append(f"{title}: {result}")
            elif isinstance(cs, str):
                lines.append(cs)
        return "\n".join(lines)

    def generate_proposal(
        self,
        user_skills,
        case_studies,
        job_post,
        preferred_tone="professional",
        proposal_length="medium",
        winning_patterns=None,
        job_title: str = "",
        budget: str = "",
        country: str = "",
        freelancer_name: str = "",
        experience: str = "",
    ):
        raw_proposal = None
        provider_used = None

        if self.model_server_url:
            try:
                raw_proposal = self._generate_via_own_server(
                    job_title=job_title,
                    job_description=job_post,
                    budget=budget,
                    country=country,
                    freelancer_name=freelancer_name,
                    skills=list(user_skills) if user_skills else [],
                    experience=experience,
                    past_projects=self._build_past_projects_str(case_studies),
                )
                provider_used = "own_server"
            except Exception as server_err:
                print(f"[HuggingFaceClient] Own server failed: {server_err}. Falling back to OpenAI.")

        if raw_proposal is None:
            if not self.openai_api_key:
                raise ValueError("Own server failed and OPENAI_API_KEY is not set.")
            user_message = self._build_user_message(
                user_skills=user_skills,
                case_studies=case_studies,
                job_post=job_post,
                preferred_tone=preferred_tone,
                proposal_length=proposal_length,
                winning_patterns=winning_patterns,
            )
            raw_proposal = self._generate_via_openai(user_message)
            provider_used = "openai_fallback"

        print(f"[HuggingFaceClient] Proposal generated via: {provider_used}")
        return self._normalize_result(raw_proposal, user_skills)


_huggingface_client = None


def get_huggingface_client():
    global _huggingface_client
    if _huggingface_client is None:
        _huggingface_client = HuggingFaceClient()
    return _huggingface_client
