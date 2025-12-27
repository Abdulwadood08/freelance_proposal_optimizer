"""Firestore client service for database operations."""
import os
import json
from typing import Optional, Dict, Any
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


# Global instance
_firestore_client: Optional[FirestoreClient] = None


def get_firestore_client() -> FirestoreClient:
    """Get or create Firestore client instance (singleton pattern)."""
    global _firestore_client
    if _firestore_client is None:
        _firestore_client = FirestoreClient()
    return _firestore_client

