// API client for FastAPI backend
import { User as FirebaseUser } from 'firebase/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Helper function to get auth token
async function getAuthToken(user: FirebaseUser | null): Promise<string | null> {
  if (!user) return null;
  return await user.getIdToken();
}

// Helper function to get headers with auth token
async function getAuthHeaders(user: FirebaseUser | null): Promise<HeadersInit> {
  const token = await getAuthToken(user);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

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
export async function createUser(
  userData: CreateUserRequest,
  firebaseUser: FirebaseUser | null
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/v1/users`, {
    method: 'POST',
    headers: await getAuthHeaders(firebaseUser),
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create user');
  }

  return response.json();
}

export async function getUser(
  userId: string,
  firebaseUser: FirebaseUser | null
): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/v1/users/${userId}`, {
    headers: await getAuthHeaders(firebaseUser),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch user');
  }

  return response.json();
}

// Proposal API
export async function generateProposal(
  request: GenerateProposalRequest,
  firebaseUser: FirebaseUser | null
): Promise<ProposalResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/proposals/generate`, {
    method: 'POST',
    headers: await getAuthHeaders(firebaseUser),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to generate proposal');
  }

  return response.json();
}

