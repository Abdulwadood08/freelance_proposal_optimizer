"""Firestore client service for database operations."""
import json
import os
from calendar import month_abbr
from datetime import datetime
from typing import Any, Dict, List, Optional
from google.cloud import firestore
from google.cloud.firestore_v1.aggregation import AggregationQuery
from google.cloud.firestore_v1.base_query import FieldFilter
from google.oauth2 import service_account


def _coerce_to_datetime(val: Any) -> Optional[datetime]:
    """Parse Firestore/datetime/string timestamps into a naive UTC datetime when possible."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=None) if val.tzinfo else val
    if isinstance(val, str):
        try:
            return datetime.fromisoformat(val.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return None
    if hasattr(val, "isoformat") and callable(getattr(val, "isoformat")):
        try:
            raw = val.isoformat()
            if isinstance(raw, str):
                return datetime.fromisoformat(raw.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return None
    return None


def _month_key_utc(dt: datetime) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


def _last_n_calendar_month_keys(n: int = 12) -> List[str]:
    """Oldest-first keys like '2025-06', ending at current UTC month."""
    now = datetime.utcnow()
    y, m = now.year, now.month
    keys_rev: List[str] = []
    for _ in range(n):
        keys_rev.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return list(reversed(keys_rev))


def _make_json_serializable(obj: Any) -> Any:
    """Convert Firestore doc dict to JSON-serializable form (datetime/Timestamp -> ISO string)."""
    if obj is None:
        return None
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, datetime):
        return obj.isoformat()
    if hasattr(obj, "isoformat") and callable(getattr(obj, "isoformat")):
        try:
            return obj.isoformat()
        except Exception:
            return str(obj)
    if isinstance(obj, dict):
        return {k: _make_json_serializable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_make_json_serializable(v) for v in obj]
    if isinstance(obj, bytes):
        return obj.decode("utf-8", errors="replace")
    # Firestore GeoPoint, DocumentReference, or any other non-serializable
    return str(obj)


class FirestoreClient:
    """Firestore client wrapper for database operations."""
    
    def __init__(self):
        """Initialize Firestore client using service account credentials."""
        credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        
        if not credentials_path:
            raise ValueError(
                "GOOGLE_APPLICATION_CREDENTIALS environment variable is not set. "
                "Please set it to the path of your Firebase service account JSON file."
            )
        
        if not os.path.exists(credentials_path):
            raise FileNotFoundError(
                f"Service account file not found at: {credentials_path}"
            )
        
        # Load credentials and extract project ID
        credentials = service_account.Credentials.from_service_account_file(
            credentials_path
        )
        
        # Extract project ID from service account file
        with open(credentials_path, 'r') as f:
            service_account_info = json.load(f)
            project_id = service_account_info.get('project_id')
        
        if not project_id:
            raise ValueError(
                "Project ID not found in service account file. "
                "Please ensure your service account JSON file contains a 'project_id' field."
            )
        
        # Initialize Firestore client with credentials and project ID
        self.db = firestore.Client(credentials=credentials, project=project_id)
    
    def save_user(self, user_id: str, user_data: Dict[str, Any]) -> None:
        """
        Save user data to Firestore.
        
        Args:
            user_id: Document ID for the user
            user_data: Dictionary containing user information
        """
        doc_ref = self.db.collection("users").document(user_id)
        doc_ref.set(user_data)

    def update_user(self, user_id: str, updates: Dict[str, Any]) -> None:
        """
        Update user document with partial data (merge). Creates doc if not present.
        
        Args:
            user_id: Document ID for the user
            updates: Dictionary of fields to update (name, email_notifications, proposal_alerts, etc.)
        """
        doc_ref = self.db.collection("users").document(user_id)
        doc_ref.set(updates, merge=True)
    
    def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve user data from Firestore.
        
        Args:
            user_id: Document ID of the user to retrieve
            
        Returns:
            Dictionary containing user data, or None if not found
        """
        doc_ref = self.db.collection("users").document(user_id)
        doc = doc_ref.get()
        
        if doc.exists:
            return doc.to_dict()
        return None
    
    def save_proposal(
        self, 
        user_id: str, 
        proposal_data: Dict[str, Any]
    ) -> str:
        """
        Save proposal data to Firestore.
        
        Args:
            user_id: User ID associated with the proposal
            proposal_data: Dictionary containing proposal information
            
        Returns:
            Document ID of the saved proposal
        """
        from datetime import datetime
        
        # Add metadata
        proposal_data["user_id"] = user_id
        proposal_data["created_at"] = datetime.utcnow().isoformat()
        proposal_data["status"] = proposal_data.get("status", "draft")  # draft, sent, won, lost
        proposal_data["sent_at"] = proposal_data.get("sent_at")
        proposal_data["won_at"] = proposal_data.get("won_at")
        proposal_data["lost_at"] = proposal_data.get("lost_at")
        
        # Create a new document in proposals collection
        doc_ref = self.db.collection("proposals").document()
        doc_ref.set(proposal_data)
        
        return doc_ref.id

    def get_user_proposals(self, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get proposals for a specific user, ordered by creation date (newest first).
        Uses in-memory sort to avoid requiring a Firestore composite index.
        """
        proposals_ref = self.db.collection("proposals")
        fetch_limit = min(500, max(limit, 50))  # fetch enough to sort, cap at 500
        query = proposals_ref.where(
            filter=FieldFilter("user_id", "==", user_id)
        ).limit(fetch_limit)
        
        proposals = []
        for doc in query.stream():
            proposal_data = doc.to_dict() or {}
            proposal_data["id"] = doc.id
            # Ensure JSON-serializable (e.g. Firestore Timestamp -> ISO string)
            proposals.append(_make_json_serializable(proposal_data))
        
        # Sort by created_at descending (newest first), then take limit
        proposals.sort(
            key=lambda p: p.get("created_at") or "",
            reverse=True
        )
        return proposals[:limit]
    
    def get_proposal_count(self, user_id: str) -> int:
        """
        Get total count of proposals for a user.
        
        Args:
            user_id: User ID to count proposals for
            
        Returns:
            Total number of proposals
        """
        proposals_ref = self.db.collection("proposals")
        query = proposals_ref.where(
            filter=FieldFilter("user_id", "==", user_id)
        )
        try:
            agg_query = AggregationQuery(query)
            agg_query.count(alias="total")
            agg_results = agg_query.get()
            if agg_results:
                return int(agg_results[0].value)
        except Exception:
            pass
        return len(list(query.stream()))
    
    def get_proposal(self, proposal_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a single proposal by ID.
        
        Args:
            proposal_id: Document ID of the proposal
            
        Returns:
            Dictionary containing proposal data, or None if not found
        """
        doc_ref = self.db.collection("proposals").document(proposal_id)
        doc = doc_ref.get()
        
        if doc.exists:
            proposal_data = doc.to_dict()
            proposal_data["id"] = doc.id
            return proposal_data
        return None
    
    def update_proposal(
        self,
        proposal_id: str,
        user_id: str,
        proposal_data: Dict[str, Any]
    ) -> bool:
        """
        Update a proposal. Only allows updating if the proposal belongs to the user.
        
        Args:
            proposal_id: Document ID of the proposal to update
            user_id: User ID to verify ownership
            proposal_data: Dictionary containing updated proposal information
            
        Returns:
            True if update was successful, False if proposal not found or doesn't belong to user
            
        Raises:
            ValueError: If proposal doesn't belong to the user
        """
        from datetime import datetime
        
        # First verify the proposal exists and belongs to the user
        proposal = self.get_proposal(proposal_id)
        if not proposal:
            return False
        
        if proposal.get("user_id") != user_id:
            raise ValueError("Proposal does not belong to this user")
        
        # Add updated_at timestamp
        proposal_data["updated_at"] = datetime.utcnow().isoformat()
        
        # Update the document
        doc_ref = self.db.collection("proposals").document(proposal_id)
        doc_ref.update(proposal_data)
        
        return True
    
    def delete_proposal(self, proposal_id: str, user_id: str) -> bool:
        """
        Delete a proposal. Only allows deletion if the proposal belongs to the user.
        
        Args:
            proposal_id: Document ID of the proposal to delete
            user_id: User ID to verify ownership
            
        Returns:
            True if deletion was successful, False if proposal not found or doesn't belong to user
            
        Raises:
            ValueError: If proposal doesn't belong to the user
        """
        # First verify the proposal exists and belongs to the user
        proposal = self.get_proposal(proposal_id)
        if not proposal:
            return False
        
        if proposal.get("user_id") != user_id:
            raise ValueError("Proposal does not belong to this user")
        
        # Delete the document
        doc_ref = self.db.collection("proposals").document(proposal_id)
        doc_ref.delete()
        
        return True
    
    def update_proposal_status(
        self,
        proposal_id: str,
        user_id: str,
        status: str
    ) -> bool:
        """
        Update proposal status (draft, sent, won, lost).
        
        Args:
            proposal_id: Document ID of the proposal
            user_id: User ID to verify ownership
            status: New status (draft, sent, won, lost)
            
        Returns:
            True if update was successful
            
        Raises:
            ValueError: If proposal doesn't belong to user or invalid status
        """
        from datetime import datetime
        
        valid_statuses = ["draft", "sent", "won", "lost"]
        if status not in valid_statuses:
            raise ValueError(f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
        
        # Verify ownership
        proposal = self.get_proposal(proposal_id)
        if not proposal:
            return False
        
        if proposal.get("user_id") != user_id:
            raise ValueError("Proposal does not belong to this user")
        
        # Build update data
        update_data = {"status": status}
        
        # Add timestamp based on status
        now = datetime.utcnow().isoformat()
        if status == "sent":
            update_data["sent_at"] = now
        elif status == "won":
            update_data["won_at"] = now
        elif status == "lost":
            update_data["lost_at"] = now
        
        update_data["updated_at"] = now
        
        # Update the document
        doc_ref = self.db.collection("proposals").document(proposal_id)
        doc_ref.update(update_data)
        
        return True
    
    def get_proposal_analytics(self, user_id: str) -> Dict[str, Any]:
        """
        Get analytics data for user's proposals.
        
        Args:
            user_id: User ID to get analytics for
            
        Returns:
            Dictionary with analytics data
        """
        proposals_ref = self.db.collection("proposals")
        base_query = proposals_ref.where(
            filter=FieldFilter("user_id", "==", user_id)
        )

        proposals: List[Dict[str, Any]] = []
        try:
            stream_query = base_query.select(
                "status",
                "created_at",
                "won_at",
                "preferred_tone",
                "proposal_length",
                "score",
                "quality_score",
                "fit_score",
                "source",
            )
            for doc in stream_query.stream():
                proposal_data = doc.to_dict() or {}
                proposal_data["id"] = doc.id
                proposals.append(proposal_data)
        except Exception:
            # Projection can fail on some SDK/emulator setups — fall back to full reads.
            for doc in base_query.stream():
                proposal_data = doc.to_dict() or {}
                proposal_data["id"] = doc.id
                proposals.append(proposal_data)
        
        total = len(proposals)
        status_counts = {"draft": 0, "sent": 0, "won": 0, "lost": 0}
        tone_stats = {}
        length_stats = {}
        score_values: List[float] = []
        
        for prop in proposals:
            status = prop.get("status", "draft")
            status_counts[status] = status_counts.get(status, 0) + 1
            
            # Track tone preferences (if stored)
            preferred_tone = prop.get("preferred_tone")
            if preferred_tone:
                tone_stats[preferred_tone] = tone_stats.get(preferred_tone, 0) + 1
            
            # Track length preferences (if stored)
            proposal_length = prop.get("proposal_length")
            if proposal_length:
                length_stats[proposal_length] = length_stats.get(proposal_length, 0) + 1

            # Prefer explicit score fields; fallback to fit_score if present.
            score_candidate = prop.get("score")
            if score_candidate is None:
                score_candidate = prop.get("quality_score")
            if score_candidate is None:
                score_candidate = prop.get("fit_score")
            if isinstance(score_candidate, (int, float)):
                # Normalize 1-10 scale to 0-100 if needed
                normalized = score_candidate * 10 if score_candidate <= 10 else score_candidate
                score_values.append(float(max(0.0, min(100.0, normalized))))
        
        # Calculate success rates
        sent_count = status_counts.get("sent", 0)
        won_count = status_counts.get("won", 0)
        lost_count = status_counts.get("lost", 0)
        total_responded = won_count + lost_count
        
        win_rate = (won_count / total_responded * 100) if total_responded > 0 else 0
        response_rate = (total_responded / sent_count * 100) if sent_count > 0 else 0

        avg_score = round(sum(score_values) / len(score_values), 2) if score_values else 0.0
        score_sample_size = len(score_values)

        # Monthly activity (last 12 UTC calendar months)
        month_keys = _last_n_calendar_month_keys(12)
        generated_by_month: Dict[str, int] = {}
        won_by_month: Dict[str, int] = {}
        for mk in month_keys:
            generated_by_month[mk] = 0
            won_by_month[mk] = 0

        for prop in proposals:
            created = _coerce_to_datetime(prop.get("created_at"))
            if created:
                gk = _month_key_utc(created)
                if gk in generated_by_month:
                    generated_by_month[gk] += 1

            if prop.get("status") == "won":
                win_dt = _coerce_to_datetime(prop.get("won_at")) or _coerce_to_datetime(
                    prop.get("created_at")
                )
                if win_dt:
                    wk = _month_key_utc(win_dt)
                    if wk in won_by_month:
                        won_by_month[wk] += 1

        monthly_activity: List[Dict[str, Any]] = []
        for mk in month_keys:
            mo = int(mk[5:7])
            year_short = int(mk[:4]) % 100
            label = f"{month_abbr[mo]} '{year_short:02d}"
            monthly_activity.append(
                {
                    "month_key": mk,
                    "label": label,
                    "generated": generated_by_month.get(mk, 0),
                    "won": won_by_month.get(mk, 0),
                }
            )

        mom_generated_pct: Optional[float] = None
        mom_won_delta: Optional[int] = None
        if len(month_keys) >= 2:
            cur_m, prev_m = month_keys[-1], month_keys[-2]
            cur_g = generated_by_month.get(cur_m, 0)
            prev_g = generated_by_month.get(prev_m, 0)
            if prev_g > 0:
                mom_generated_pct = round((cur_g - prev_g) / prev_g * 100, 1)
            elif cur_g > 0 and prev_g == 0:
                mom_generated_pct = None
            mom_won_delta = won_by_month.get(cur_m, 0) - won_by_month.get(prev_m, 0)

        # Feedback metrics
        feedback_ref = self.db.collection("feedback")
        feedback_query = feedback_ref.where(filter=FieldFilter("user_id", "==", user_id))
        feedback_docs = [doc.to_dict() or {} for doc in feedback_query.stream()]
        total_feedback = len(feedback_docs)
        positive_feedback = sum(1 for fb in feedback_docs if fb.get("rating") == 1)
        feedback_positive_rate = (
            round((positive_feedback / total_feedback) * 100, 2) if total_feedback > 0 else 0.0
        )

        # Recent activity sorted by created_at (ISO strings)
        proposals_sorted = sorted(
            proposals,
            key=lambda p: p.get("created_at") or "",
            reverse=True,
        )

        recent_activity = [
            {
                "proposal_id": p.get("id"),
                "status": p.get("status", "draft"),
                "created_at": p.get("created_at"),
                "source": p.get("source", "web"),
                "fit_score": p.get("fit_score"),
            }
            for p in proposals_sorted[:10]
        ]

        # Top-performing proposal: won first, otherwise highest fit_score/score, then newest.
        won_proposals = [p for p in proposals_sorted if p.get("status") == "won"]
        candidate_pool = won_proposals if won_proposals else proposals_sorted
        top_performing = None
        if candidate_pool:
            top_row = max(
                candidate_pool,
                key=lambda p: (
                    float(p.get("fit_score") or (p.get("score", 0) * 10 if p.get("score") else 0)),
                    p.get("created_at") or "",
                ),
            )
            excerpt = ""
            top_id = top_row.get("id")
            if top_id:
                full_top = self.get_proposal(top_id)
                if full_top:
                    excerpt = (full_top.get("proposal") or "")[:220]
            top_performing = {
                "proposal_id": top_row.get("id"),
                "status": top_row.get("status", "draft"),
                "fit_score": top_row.get("fit_score"),
                "created_at": top_row.get("created_at"),
                "excerpt": excerpt,
            }

        payload = {
            "total_proposals": total,
            "status_counts": status_counts,
            "win_rate": round(win_rate, 2),
            "response_rate": round(response_rate, 2),
            "sent_count": sent_count,
            "won_count": won_count,
            "lost_count": lost_count,
            "tone_stats": tone_stats,
            "length_stats": length_stats,
            "avg_score": avg_score,
            "score_sample_size": score_sample_size,
            "feedback_positive_rate": feedback_positive_rate,
            "total_feedback": total_feedback,
            "recent_activity": recent_activity,
            "top_performing_proposal": top_performing,
            "monthly_activity": monthly_activity,
            "mom_generated_pct": mom_generated_pct,
            "mom_won_delta": mom_won_delta,
        }
        # FastAPI JSON encoding fails on Firestore Timestamp / similar types without this pass.
        return _make_json_serializable(payload)
    
    def get_winning_patterns(self, user_id: str) -> Dict[str, Any]:
        """
        Analyze winning proposals to extract patterns for personalization.
        
        Args:
            user_id: User ID to analyze
            
        Returns:
            Dictionary with winning patterns
        """
        proposals_ref = self.db.collection("proposals")
        query = proposals_ref.where(
            filter=FieldFilter("user_id", "==", user_id)
        ).where(
            filter=FieldFilter("status", "==", "won")
        )
        
        winning_proposals = []
        for doc in query.stream():
            winning_proposals.append(doc.to_dict())
        
        if not winning_proposals:
            return {}
        
        # Analyze patterns
        tones = [p.get("preferred_tone") for p in winning_proposals if p.get("preferred_tone")]
        lengths = [p.get("proposal_length") for p in winning_proposals if p.get("proposal_length")]
        
        # Find most common tone and length
        from collections import Counter
        tone_counter = Counter(tones)
        length_counter = Counter(lengths)
        
        best_tone = tone_counter.most_common(1)[0][0] if tone_counter else None
        best_length = length_counter.most_common(1)[0][0] if length_counter else None
        
        # Extract common phrases from winning proposals (simplified - could use NLP)
        common_phrases = []
        for prop in winning_proposals[:5]:  # Analyze top 5
            proposal_text = prop.get("proposal", "")
            # Simple extraction - look for action phrases
            if "I have" in proposal_text.lower():
                common_phrases.append("I have experience")
            if "I can" in proposal_text.lower():
                common_phrases.append("I can deliver")
            if "let's" in proposal_text.lower():
                common_phrases.append("Let's discuss")
        
        return {
            "best_tone": best_tone,
            "best_length": best_length,
            "winning_count": len(winning_proposals),
            "common_phrases": list(set(common_phrases))[:5]  # Unique phrases, max 5
        }
    
    def save_template(
        self,
        user_id: str,
        template_data: Dict[str, Any]
    ) -> str:
        """
        Save a proposal template.
        
        Args:
            user_id: User ID associated with the template
            template_data: Dictionary containing template information (name, description, proposal, etc.)
            
        Returns:
            Document ID of the saved template
        """
        from datetime import datetime
        
        # Add metadata
        template_data["user_id"] = user_id
        template_data["created_at"] = datetime.utcnow().isoformat()
        template_data["updated_at"] = datetime.utcnow().isoformat()
        
        # Create a new document in templates collection
        doc_ref = self.db.collection("templates").document()
        doc_ref.set(template_data)
        
        return doc_ref.id
    
    def get_user_templates(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Get templates for a specific user, ordered by creation date (newest first).
        Uses in-memory sort to avoid requiring a Firestore composite index.
        """
        templates_ref = self.db.collection("templates")
        fetch_limit = min(200, max(limit, 50))
        query = templates_ref.where(
            filter=FieldFilter("user_id", "==", user_id)
        ).limit(fetch_limit)
        
        templates = []
        for doc in query.stream():
            template_data = doc.to_dict()
            template_data["id"] = doc.id
            templates.append(template_data)
        
        templates.sort(key=lambda t: t.get("created_at") or "", reverse=True)
        return templates[:limit]
    
    def get_template(self, template_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a single template by ID.
        
        Args:
            template_id: Document ID of the template
            
        Returns:
            Dictionary containing template data, or None if not found
        """
        doc_ref = self.db.collection("templates").document(template_id)
        doc = doc_ref.get()
        
        if doc.exists:
            template_data = doc.to_dict()
            template_data["id"] = doc.id
            return template_data
        return None
    
    def update_template(
        self,
        template_id: str,
        user_id: str,
        template_data: Dict[str, Any]
    ) -> bool:
        """
        Update a template. Only allows updating if the template belongs to the user.
        
        Args:
            template_id: Document ID of the template to update
            user_id: User ID to verify ownership
            template_data: Dictionary containing updated template information
            
        Returns:
            True if update was successful, False if template not found or doesn't belong to user
            
        Raises:
            ValueError: If template doesn't belong to the user
        """
        from datetime import datetime
        
        # First verify the template exists and belongs to the user
        template = self.get_template(template_id)
        if not template:
            return False
        
        if template.get("user_id") != user_id:
            raise ValueError("Template does not belong to this user")
        
        # Add updated_at timestamp
        template_data["updated_at"] = datetime.utcnow().isoformat()
        
        # Update the document
        doc_ref = self.db.collection("templates").document(template_id)
        doc_ref.update(template_data)
        
        return True
    
    def delete_template(self, template_id: str, user_id: str) -> bool:
        """
        Delete a template. Only allows deletion if the template belongs to the user.
        
        Args:
            template_id: Document ID of the template to delete
            user_id: User ID to verify ownership
            
        Returns:
            True if deletion was successful, False if template not found or doesn't belong to user
            
        Raises:
            ValueError: If template doesn't belong to the user
        """
        # First verify the template exists and belongs to the user
        template = self.get_template(template_id)
        if not template:
            return False
        
        if template.get("user_id") != user_id:
            raise ValueError("Template does not belong to this user")
        
        # Delete the document
        doc_ref = self.db.collection("templates").document(template_id)
        doc_ref.delete()
        
        return True

    def save_feedback(self, user_id: str, proposal_id: str, job_id: str, rating: int) -> str:
        """
        Save explicit user feedback for generated proposals.

        Args:
            user_id: User submitting feedback
            proposal_id: Proposal document ID
            job_id: Client job identifier or URL hash
            rating: 1 for good, -1 for bad

        Returns:
            Feedback document ID
        """
        from datetime import datetime

        doc_ref = self.db.collection("feedback").document()
        payload = {
            "feedback_id": doc_ref.id,
            "user_id": user_id,
            "proposal_id": proposal_id,
            "job_id": job_id,
            "rating": rating,
            "timestamp": datetime.utcnow().isoformat(),
        }
        doc_ref.set(payload)
        return doc_ref.id


# Global instance
_firestore_client: Optional[FirestoreClient] = None


def get_firestore_client() -> FirestoreClient:
    """Get or create Firestore client instance (singleton pattern)."""
    global _firestore_client
    if _firestore_client is None:
        _firestore_client = FirestoreClient()
    return _firestore_client

