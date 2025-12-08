// API client for FastAPI backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface User {
  user_id: string;
  name: string;
  email: string;
  skills: string[];
  resume_url: string;
  case_studies: string[];
  fiverr_gigs: string[];
  upwork_profile: string;
}

export interface CreateUserRequest {
  user_id: string;
  name: string;
  email: string;
  skills: string[];
  resume_url: string;
  case_studies: string[];
  fiverr_gigs: string[];
  upwork_profile: string;
}

export interface ProposalResponse {
  proposal: string;
  cover_letter: string;
  tone_variations: {
    professional: string;
    friendly: string;
    confident: string;
  };
}

export interface GenerateProposalRequest {
  user_id: string;
  job_post: string;
}

// User API
export async function createUser(userData: CreateUserRequest): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/v1/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create user');
  }

  return response.json();
}

export async function getUser(userId: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/v1/users/${userId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch user');
  }

  return response.json();
}

// Proposal API
export async function generateProposal(
  request: GenerateProposalRequest
): Promise<ProposalResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/proposals/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to generate proposal');
  }

  return response.json();
}

