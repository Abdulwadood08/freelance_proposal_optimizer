"""Firestore client service for database operations."""
import os
import json
from typing import Optional, Dict, Any, List
from google.cloud import firestore
from google.oauth2 import service_account


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
        Get proposals for a specific user, ordered by creation date.
        
        Args:
            user_id: User ID to get proposals for
            limit: Maximum number of proposals to return
            
        Returns:
            List of proposal dictionaries
        """
        from google.cloud.firestore import Query
        
        proposals_ref = self.db.collection("proposals")
        query = proposals_ref.where("user_id", "==", user_id).order_by("created_at", direction=Query.DESCENDING).limit(limit)
        
        proposals = []
        for doc in query.stream():
            proposal_data = doc.to_dict()
            proposal_data["id"] = doc.id
            proposals.append(proposal_data)
        
        return proposals
    
    def get_proposal_count(self, user_id: str) -> int:
        """
        Get total count of proposals for a user.
        
        Args:
            user_id: User ID to count proposals for
            
        Returns:
            Total number of proposals
        """
        proposals_ref = self.db.collection("proposals")
        query = proposals_ref.where("user_id", "==", user_id)
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
        query = proposals_ref.where("user_id", "==", user_id)
        
        proposals = []
        for doc in query.stream():
            proposals.append(doc.to_dict())
        
        total = len(proposals)
        status_counts = {"draft": 0, "sent": 0, "won": 0, "lost": 0}
        tone_stats = {}
        length_stats = {}
        
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
        
        # Calculate success rates
        sent_count = status_counts.get("sent", 0)
        won_count = status_counts.get("won", 0)
        lost_count = status_counts.get("lost", 0)
        total_responded = won_count + lost_count
        
        win_rate = (won_count / total_responded * 100) if total_responded > 0 else 0
        response_rate = (total_responded / sent_count * 100) if sent_count > 0 else 0
        
        return {
            "total_proposals": total,
            "status_counts": status_counts,
            "win_rate": round(win_rate, 2),
            "response_rate": round(response_rate, 2),
            "sent_count": sent_count,
            "won_count": won_count,
            "lost_count": lost_count,
            "tone_stats": tone_stats,
            "length_stats": length_stats
        }
    
    def get_winning_patterns(self, user_id: str) -> Dict[str, Any]:
        """
        Analyze winning proposals to extract patterns for personalization.
        
        Args:
            user_id: User ID to analyze
            
        Returns:
            Dictionary with winning patterns
        """
        proposals_ref = self.db.collection("proposals")
        query = proposals_ref.where("user_id", "==", user_id).where("status", "==", "won")
        
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
        Get templates for a specific user, ordered by creation date.
        
        Args:
            user_id: User ID to get templates for
            limit: Maximum number of templates to return
            
        Returns:
            List of template dictionaries
        """
        from google.cloud.firestore import Query
        
        templates_ref = self.db.collection("templates")
        query = templates_ref.where("user_id", "==", user_id).order_by("created_at", direction=Query.DESCENDING).limit(limit)
        
        templates = []
        for doc in query.stream():
            template_data = doc.to_dict()
            template_data["id"] = doc.id
            templates.append(template_data)
        
        return templates
    
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


# Global instance
_firestore_client: Optional[FirestoreClient] = None


def get_firestore_client() -> FirestoreClient:
    """Get or create Firestore client instance (singleton pattern)."""
    global _firestore_client
    if _firestore_client is None:
        _firestore_client = FirestoreClient()
    return _firestore_client

