"""OpenAI client service for GPT API calls."""
import json
import os
from typing import Any, Dict, List, Optional

from openai import OpenAI

from app.services.proposal_prompt_builder import build_proposal_generation_prompt


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
        winning_patterns: Optional[Dict[str, Any]] = None,
        freelancer_display_name: Optional[str] = None,
        job_grounding_context: Optional[str] = None,
        temperature: Optional[float] = None,
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
        selected_tone = (
            preferred_tone
            if preferred_tone in {"professional", "friendly", "confident"}
            else "professional"
        )
        prompt = build_proposal_generation_prompt(
            user_skills=user_skills,
            case_studies=case_studies,
            job_post=job_post,
            preferred_tone=preferred_tone,
            proposal_length=proposal_length,
            winning_patterns=winning_patterns,
            freelancer_display_name=freelancer_display_name,
            job_grounding_context=job_grounding_context,
        )
        
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
                temperature=temperature if temperature is not None else 0.55,
            )
            
            # Parse the JSON response
            import json
            raw_result = json.loads(response.choices[0].message.content)
            proposal_text = (raw_result.get("proposal") or "").strip()
            cover_letter = (raw_result.get("cover_letter") or proposal_text).strip()
            if not proposal_text:
                raise ValueError("OpenAI response did not include a proposal.")

            tone_variations = {
                "professional": "",
                "friendly": "",
                "confident": "",
            }
            tone_variations[selected_tone] = proposal_text
            result = {
                "proposal": proposal_text,
                "cover_letter": cover_letter,
                "tone_variations": tone_variations,
            }
            
            return result
            
        except Exception as e:
            raise ValueError(f"Failed to generate proposal: {str(e)}")
    
    def analyze_job_post(
        self,
        job_post: str,
        user_skills: list,
        user_case_studies: list,
        temperature: Optional[float] = None,
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

CRITICAL: If this blob mixes the client's project scope with Upwork UI (for example: Connects required to submit a proposal, bid-rate prompts, cover-letter widgets, boost-your-proposal copy), completely IGNORE that UI. The job_summary and key_requirements must describe ONLY the client's actual work (deliverables, product, stack, timeline) — never the mechanics of submitting a proposal on Upwork.

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
                        "content": (
                            "You are an expert job post analyzer. Ignore freelancing marketplace UI boilerplate "
                            "(Connects, bid forms, proposal submission copy). Extract requirements only from the "
                            "client's real scope. Always respond with valid JSON only."
                        ),
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=temperature if temperature is not None else 0.5,
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

    def recommend_bid(
        self,
        *,
        job_post: str,
        user_skills: list,
        fit_score: int,
        tone: str = "professional",
        client_budget_text: str = "",
        payment_type_hint: str = "",
        risk_level: str = "balanced",
    ) -> Dict[str, Any]:
        """Recommend a competitive bid strategy for an Upwork job."""
        skills_text = ", ".join(user_skills) if user_skills else "None"
        prompt = f"""You are an expert Upwork pricing strategist for freelancers.

JOB POST:
{job_post}

FREELANCER SKILLS:
{skills_text}

CONTEXT:
- Fit score estimate: {fit_score}/100
- Preferred tone: {tone}
- Client budget text (if extracted): {client_budget_text or "Unknown"}
- Payment type hint: {payment_type_hint or "Unknown"}
- Risk level: {risk_level}

Return ONLY valid JSON in this format:
{{
  "payment_type": "hourly or fixed",
  "recommended_hourly_rate": 25,
  "recommended_fixed_bid": null,
  "bid_range_low": 20,
  "bid_range_high": 30,
  "confidence": 72,
  "positioning": "Short 1-2 sentence positioning for this bid.",
  "risk_flags": ["flag1", "flag2"],
  "why_this_bid": ["reason1", "reason2", "reason3"],
  "negotiation_script": "A short message the freelancer can paste when discussing budget."
}}

Rules:
- If payment type appears fixed, set recommended_hourly_rate to null.
- If payment type appears hourly, set recommended_fixed_bid to null.
- Keep values realistic for a mid-level freelancer.
- Confidence must be 0-100.
- Keep response concise and practical.
- Use a professional, consultative tone in positioning and negotiation_script (no hype or pressure tactics).
- Risk level "aggressive" means competitive (upper range) pricing only — wording stays polite and professional."""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert freelance pricing advisor. Always respond with valid JSON only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
            )

            import json

            raw_result = json.loads(response.choices[0].message.content or "{}")
            payment_type = str(raw_result.get("payment_type", "hourly")).strip().lower()
            if payment_type not in {"hourly", "fixed"}:
                payment_type = "hourly"

            def _to_number(value):
                try:
                    return float(value)
                except (TypeError, ValueError):
                    return None

            result = {
                "payment_type": payment_type,
                "recommended_hourly_rate": _to_number(raw_result.get("recommended_hourly_rate")),
                "recommended_fixed_bid": _to_number(raw_result.get("recommended_fixed_bid")),
                "bid_range_low": _to_number(raw_result.get("bid_range_low")),
                "bid_range_high": _to_number(raw_result.get("bid_range_high")),
                "confidence": max(0, min(100, int(raw_result.get("confidence", 65) or 65))),
                "positioning": str(raw_result.get("positioning", "")).strip(),
                "risk_flags": raw_result.get("risk_flags", []) if isinstance(raw_result.get("risk_flags"), list) else [],
                "why_this_bid": raw_result.get("why_this_bid", []) if isinstance(raw_result.get("why_this_bid"), list) else [],
                "negotiation_script": str(raw_result.get("negotiation_script", "")).strip(),
            }
            return result
        except Exception as e:
            raise ValueError(f"Failed to recommend bid: {str(e)}")

    def improve_proposal_once(
        self,
        proposal: str,
        job_post: str,
        user_skills: list,
        weaknesses: Optional[list] = None,
        suggestions: Optional[list] = None,
        preferred_tone: str = "professional",
        target_length: str = "medium",
        freelancer_display_name: Optional[str] = None,
    ) -> str:
        """
        Rewrite proposal once using scoring feedback.
        Returns improved plain-text proposal.
        """
        skills_text = ", ".join(user_skills) if user_skills else "None"
        weakness_lines = "\n".join(f"- {w}" for w in (weaknesses or [])[:3]) or "- Not provided"
        suggestion_lines = "\n".join(f"- {s}" for s in (suggestions or [])[:3]) or "- Not provided"
        length_hint = {
            "short": "100-150 words",
            "medium": "150-250 words",
            "long": "250-350 words",
        }.get(target_length, "150-250 words")

        prompt = f"""Improve the following Upwork proposal using the provided critique.

JOB POST:
{job_post}

FREELANCER SKILLS:
{skills_text}

CURRENT PROPOSAL:
{proposal}

KNOWN WEAKNESSES:
{weakness_lines}

SUGGESTED IMPROVEMENTS:
{suggestion_lines}

Signer line: {(freelancer_display_name or "").strip() or "use the freelancer's real name from context; never use brackets or placeholders"}

Rewrite requirements:
- Keep the tone {preferred_tone}
- Keep length around {length_hint}
- Preserve truthful claims only; remove sentences about skills/tools not mentioned in the JOB POST
- Strengthen hook, relevance, and call-to-action strictly to this job's stated deliverables
- Keep proposal letter formatting:
  - Start with "Dear Hiring Manager," (or "Dear Client,")
  - End with "Best regards," then a new line, then the sign-off name exactly as in Signer line when provided
- Return ONLY the improved proposal text
"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert freelance proposal editor. Return only plain proposal text.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.4,
            )
            improved = (response.choices[0].message.content or "").strip()
            if not improved:
                raise ValueError("Improvement model returned empty text.")
            return improved
        except Exception as e:
            raise ValueError(f"Failed to improve proposal: {str(e)}")

    def _compact_profile_for_suggestions(self, profile: Dict[str, Any]) -> Dict[str, Any]:
        """Trim profile payload for the model (avoid huge case studies / URLs)."""
        skills = profile.get("skills") or []
        if isinstance(skills, list):
            skills_out = [str(s).strip() for s in skills if str(s).strip()][:15]
        else:
            skills_out = []

        case_studies = profile.get("case_studies") or []
        previews: List[Dict[str, Any]] = []
        if isinstance(case_studies, list):
            for item in case_studies[:8]:
                if isinstance(item, str):
                    prev = item.strip()
                    if prev:
                        previews.append({"kind": "note", "preview": prev[:280]})
                elif isinstance(item, dict):
                    previews.append(
                        {
                            "title": str(item.get("title") or "")[:120],
                            "description_preview": str(item.get("description") or "")[:240],
                        }
                    )

        work_raw = profile.get("work_experience") or []
        work_out: List[Dict[str, str]] = []
        if isinstance(work_raw, list):
            for w in work_raw[:10]:
                if not isinstance(w, dict):
                    continue
                title = str(w.get("title") or "").strip()
                company = str(w.get("company") or "").strip()
                period = str(w.get("period") or "").strip()
                if title or company or period:
                    work_out.append(
                        {
                            "title": title[:100],
                            "company": company[:100],
                            "period": period[:80],
                        }
                    )

        links_raw = profile.get("portfolio_links") or []
        links: List[str] = []
        if isinstance(links_raw, list):
            links = [str(u).strip()[:400] for u in links_raw if str(u).strip()][:6]

        name = str(profile.get("name") or "").strip()
        email = str(profile.get("email") or "").strip()
        upwork = str(profile.get("upwork_profile") or "").strip()

        return {
            "name_present": bool(name),
            "name_preview": name[:80] if name else "",
            "email_present": bool(email),
            "skills_count": len(skills_out),
            "skills": skills_out,
            "case_studies_count": len(case_studies) if isinstance(case_studies, list) else 0,
            "case_studies_preview": previews,
            "resume_present": bool(profile.get("resume_present")),
            "upwork_profile_present": bool(upwork),
            "upwork_profile_preview": upwork[:200] if upwork else "",
            "portfolio_links_count": len(links),
            "portfolio_links": links,
            "work_experience_count": len(work_out),
            "work_experience": work_out,
        }

    def suggest_profile_improvements(self, profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Return 3–5 actionable profile improvement suggestions based on current form data.

        Returns:
            dict with key 'suggestions': list[str]
        """
        compact = self._compact_profile_for_suggestions(profile)
        payload = json.dumps(compact, ensure_ascii=False)
        instructions = """You help freelancers improve profiles for Upwork, Fiverr, and similar platforms.

You receive JSON describing what is currently filled in on their profile builder form.

Respond with JSON only, shape: {"suggestions": ["...", "..."]}
- Exactly 3 to 5 suggestions.
- Each suggestion: one short sentence, max 180 characters, actionable and specific.
- Focus on gaps and weaknesses visible in the JSON (missing resume, few skills, no case studies, empty portfolio links, thin work history, missing Upwork URL, incomplete name, etc.).
- If the profile is already strong, suggest upgrades (metrics, niche keywords, testimonials, certifications) — do not repeat generic praise only.
- Never invent jobs, degrees, or clients they did not provide.
- Write in clear English."""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": instructions},
                    {
                        "role": "user",
                        "content": f"Profile snapshot:\n{payload}",
                    },
                ],
                response_format={"type": "json_object"},
                temperature=0.45,
            )
            raw = response.choices[0].message.content or "{}"
            data = json.loads(raw)
            suggestions = data.get("suggestions") or []
            if not isinstance(suggestions, list):
                raise ValueError("Invalid suggestions format")
            cleaned = []
            for s in suggestions[:8]:
                text = str(s).strip()
                if text:
                    cleaned.append(text[:220])
            if not cleaned:
                raise ValueError("Model returned no suggestions.")
            return {"suggestions": cleaned[:5]}
        except Exception as e:
            raise ValueError(f"Failed to generate profile suggestions: {str(e)}")

    def extract_profile_from_resume_text(self, resume_text: str) -> Dict[str, Any]:
        """
        Parse resume plain text into structured profile fields for the profile builder.

        Returns:
            dict with keys: full_name, skills, work_experience, projects, links,
            professional_summary
        """
        trimmed = (resume_text or "").strip()
        if len(trimmed) < 40:
            raise ValueError("Resume text is too short to parse.")

        excerpt = trimmed[:14000]
        schema_hint = """{
  "full_name": string,
  "skills": string[],
  "work_experience": [{"title": string, "company": string, "period": string}],
  "projects": [{"title": string, "description": string}],
  "links": {"linkedin": string, "github": string, "portfolio": string, "upwork": string},
  "professional_summary": string
}"""

        prompt = f"""You extract structured data from a résumé/CV for an online freelancer profile.

Résumé text:
---
{excerpt}
---

Return JSON only matching this shape (use empty string \"\" or empty arrays when unknown):
{schema_hint}

Rules:
- Only facts present in the résumé.
- skills: up to 20 concise items (languages, frameworks, tools, domains).
- work_experience: jobs / roles with company and dates or period when visible.
- projects: notable projects not already covered as employment (optional).
- links: full URLs when present in the document.
- professional_summary: 2–4 sentences max if a summary/objective exists; else \"\".
"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You extract structured résumé data. Respond with valid JSON only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.15,
            )
            raw = response.choices[0].message.content or "{}"
            data = json.loads(raw)
        except Exception as e:
            raise ValueError(f"Failed to parse résumé with model: {str(e)}")

        def _wx_norm(items: Any) -> List[Dict[str, str]]:
            out: List[Dict[str, str]] = []
            if not isinstance(items, list):
                return out
            for it in items[:12]:
                if not isinstance(it, dict):
                    continue
                title = str(it.get("title") or "").strip()
                company = str(it.get("company") or "").strip()
                period = str(it.get("period") or "").strip()
                if title or company or period:
                    out.append(
                        {
                            "title": title[:120],
                            "company": company[:120],
                            "period": period[:80],
                        }
                    )
            return out

        def _proj_norm(items: Any) -> List[Dict[str, str]]:
            out = []
            if not isinstance(items, list):
                return out
            for it in items[:8]:
                if not isinstance(it, dict):
                    continue
                title = str(it.get("title") or "").strip()
                desc = str(it.get("description") or "").strip()
                if title or desc:
                    out.append({"title": title[:160], "description": desc[:1200]})
            return out

        skills_raw = data.get("skills") or []
        skills: List[str] = []
        if isinstance(skills_raw, list):
            for s in skills_raw[:25]:
                t = str(s).strip()
                if t and t not in skills:
                    skills.append(t[:80])

        links_in = data.get("links") if isinstance(data.get("links"), dict) else {}
        links = {
            "linkedin": str(links_in.get("linkedin") or "").strip()[:500],
            "github": str(links_in.get("github") or "").strip()[:500],
            "portfolio": str(links_in.get("portfolio") or "").strip()[:500],
            "upwork": str(links_in.get("upwork") or "").strip()[:500],
        }

        summary = str(data.get("professional_summary") or "").strip()[:2500]

        return {
            "full_name": str(data.get("full_name") or "").strip()[:120],
            "skills": skills[:20],
            "work_experience": _wx_norm(data.get("work_experience")),
            "projects": _proj_norm(data.get("projects")),
            "links": links,
            "professional_summary": summary,
        }


# Global instance
_openai_client = None


def get_openai_client() -> OpenAIClient:
    """Get or create OpenAI client instance (singleton pattern)."""
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAIClient()
    return _openai_client

