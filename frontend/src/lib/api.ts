// API client for FastAPI backend
import { User as FirebaseUser } from "firebase/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Helper function to get auth token
async function getAuthToken(user: FirebaseUser | null): Promise<string | null> {
  if (!user) return null;
  return await user.getIdToken();
}

// Helper function to get headers with auth token
async function getAuthHeaders(user: FirebaseUser | null): Promise<HeadersInit> {
  const token = await getAuthToken(user);
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
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
  fiverr_gigs?: string[];
  upwork_profile: string;
  email_notifications?: boolean;
  proposal_alerts?: boolean;
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

export interface UpdateUserRequest {
  name?: string;
  email_notifications?: boolean;
  proposal_alerts?: boolean;
}

export interface ProposalResponse {
  id?: string;
  proposal: string;
  cover_letter: string;
  tone_variations: {
    professional: string;
    friendly: string;
    confident: string;
  };
  job_post?: string;
}

export interface GenerateProposalRequest {
  user_id: string;
  job_post: string;
  preferred_tone?: "professional" | "friendly" | "confident" | "balanced";
  proposal_length?: "short" | "medium" | "long";
}

// User API
export async function createUser(
  userData: CreateUserRequest,
  firebaseUser: FirebaseUser | null,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/v1/users`, {
    method: "POST",
    headers: await getAuthHeaders(firebaseUser),
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const msg = await getApiErrorMessage(response, "Failed to create user");
    throw new Error(msg);
  }

  return response.json();
}

export async function getUser(
  userId: string,
  firebaseUser: FirebaseUser | null,
): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/v1/users/${userId}`, {
    headers: await getAuthHeaders(firebaseUser),
  });

  if (!response.ok) {
    const msg = await getApiErrorMessage(response, "Failed to fetch user");
    throw new Error(msg);
  }

  return response.json();
}

export async function updateUser(
  userId: string,
  updates: UpdateUserRequest,
  firebaseUser: FirebaseUser | null,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/v1/users/${userId}`, {
    method: "PATCH",
    headers: await getAuthHeaders(firebaseUser),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const msg = await getApiErrorMessage(response, "Failed to update user");
    throw new Error(msg);
  }

  return response.json();
}

// Proposal API
export async function generateProposal(
  request: GenerateProposalRequest,
  firebaseUser: FirebaseUser | null,
): Promise<ProposalResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/proposals/generate`, {
    method: "POST",
    headers: await getAuthHeaders(firebaseUser),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to generate proposal");
  }

  return response.json();
}

export interface Proposal {
  id: string;
  user_id: string;
  proposal: string;
  cover_letter: string;
  tone_variations: {
    professional: string;
    friendly: string;
    confident: string;
  };
  job_post: string;
  created_at: string;
  status?: "draft" | "sent" | "won" | "lost";
  sent_at?: string;
  won_at?: string;
  lost_at?: string;
  preferred_tone?: string;
  proposal_length?: string;
}

export interface ProposalsResponse {
  proposals: Proposal[];
  count: number;
}

export async function getUserProposals(
  userId: string,
  firebaseUser: FirebaseUser | null,
  limit: number = 10,
): Promise<ProposalsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/v1/proposals/user/${userId}?limit=${limit}`,
    {
      headers: await getAuthHeaders(firebaseUser),
    },
  );

  if (!response.ok) {
    const msg = await getApiErrorMessage(response, "Failed to fetch proposals");
    throw new Error(msg);
  }

  return response.json();
}

export async function getProposalCount(
  userId: string,
  firebaseUser: FirebaseUser | null,
): Promise<{ count: number }> {
  const response = await fetch(
    `${API_BASE_URL}/v1/proposals/user/${userId}/count`,
    {
      headers: await getAuthHeaders(firebaseUser),
    },
  );

  if (!response.ok) {
    const msg = await getApiErrorMessage(
      response,
      "Failed to get proposal count",
    );
    throw new Error(msg);
  }

  return response.json();
}

export interface UpdateProposalRequest {
  proposal?: string;
  cover_letter?: string;
  tone_variations?: {
    professional?: string;
    friendly?: string;
    confident?: string;
  };
  job_post?: string;
}

export async function getProposal(
  proposalId: string,
  userId: string,
  firebaseUser: FirebaseUser | null,
): Promise<Proposal> {
  const response = await fetch(
    `${API_BASE_URL}/v1/proposals/${proposalId}?user_id=${userId}`,
    {
      headers: await getAuthHeaders(firebaseUser),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to fetch proposal");
  }

  return response.json();
}

export async function updateProposal(
  proposalId: string,
  userId: string,
  updates: UpdateProposalRequest,
  firebaseUser: FirebaseUser | null,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${API_BASE_URL}/v1/proposals/${proposalId}?user_id=${userId}`,
    {
      method: "PATCH",
      headers: await getAuthHeaders(firebaseUser),
      body: JSON.stringify(updates),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to update proposal");
  }

  return response.json();
}

export async function deleteProposal(
  proposalId: string,
  userId: string,
  firebaseUser: FirebaseUser | null,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${API_BASE_URL}/v1/proposals/${proposalId}?user_id=${userId}`,
    {
      method: "DELETE",
      headers: await getAuthHeaders(firebaseUser),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to delete proposal");
  }

  return response.json();
}

// Template API
export interface Template {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  proposal: string;
  cover_letter: string;
  tone_variations: {
    professional: string;
    friendly: string;
    confident: string;
  };
  created_at: string;
  updated_at?: string;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  proposal: string;
  cover_letter: string;
  tone_variations: {
    professional: string;
    friendly: string;
    confident: string;
  };
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  proposal?: string;
  cover_letter?: string;
  tone_variations?: {
    professional?: string;
    friendly?: string;
    confident?: string;
  };
}

export interface TemplatesResponse {
  templates: Template[];
  count: number;
}

export async function createTemplate(
  userId: string,
  templateData: CreateTemplateRequest,
  firebaseUser: FirebaseUser | null,
): Promise<{ id: string; success: boolean; message: string }> {
  const response = await fetch(
    `${API_BASE_URL}/v1/templates?user_id=${userId}`,
    {
      method: "POST",
      headers: await getAuthHeaders(firebaseUser),
      body: JSON.stringify(templateData),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to create template");
  }

  return response.json();
}

export async function getUserTemplates(
  userId: string,
  firebaseUser: FirebaseUser | null,
  limit: number = 50,
): Promise<TemplatesResponse> {
  const response = await fetch(
    `${API_BASE_URL}/v1/templates?user_id=${userId}&limit=${limit}`,
    {
      headers: await getAuthHeaders(firebaseUser),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to fetch templates");
  }

  return response.json();
}

export async function getTemplate(
  templateId: string,
  userId: string,
  firebaseUser: FirebaseUser | null,
): Promise<Template> {
  const response = await fetch(
    `${API_BASE_URL}/v1/templates/${templateId}?user_id=${userId}`,
    {
      headers: await getAuthHeaders(firebaseUser),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to fetch template");
  }

  return response.json();
}

export async function updateTemplate(
  templateId: string,
  userId: string,
  updates: UpdateTemplateRequest,
  firebaseUser: FirebaseUser | null,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${API_BASE_URL}/v1/templates/${templateId}?user_id=${userId}`,
    {
      method: "PATCH",
      headers: await getAuthHeaders(firebaseUser),
      body: JSON.stringify(updates),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to update template");
  }

  return response.json();
}

export async function deleteTemplate(
  templateId: string,
  userId: string,
  firebaseUser: FirebaseUser | null,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${API_BASE_URL}/v1/templates/${templateId}?user_id=${userId}`,
    {
      method: "DELETE",
      headers: await getAuthHeaders(firebaseUser),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to delete template");
  }

  return response.json();
}

// Analytics API
export interface ProposalAnalytics {
  total_proposals: number;
  status_counts: {
    draft: number;
    sent: number;
    won: number;
    lost: number;
  };
  win_rate: number;
  response_rate: number;
  sent_count: number;
  won_count: number;
  lost_count: number;
  tone_stats: Record<string, number>;
  length_stats: Record<string, number>;
}

export async function updateProposalStatus(
  proposalId: string,
  userId: string,
  status: "draft" | "sent" | "won" | "lost",
  firebaseUser: FirebaseUser | null,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${API_BASE_URL}/v1/proposals/${proposalId}/status?status=${status}&user_id=${userId}`,
    {
      method: "PATCH",
      headers: await getAuthHeaders(firebaseUser),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to update proposal status");
  }

  return response.json();
}

export async function getProposalAnalytics(
  userId: string,
  firebaseUser: FirebaseUser | null,
): Promise<ProposalAnalytics> {
  const response = await fetch(
    `${API_BASE_URL}/v1/proposals/analytics/${userId}`,
    {
      headers: await getAuthHeaders(firebaseUser),
    },
  );

  if (!response.ok) {
    const msg = await getApiErrorMessage(response, "Failed to fetch analytics");
    throw new Error(msg);
  }

  return response.json();
}

export interface JobPostAnalysis {
  relevant_skills: string[];
  missing_skills: string[];
  recommended_case_studies: number[];
  profile_gaps: string[];
  suggestions: string[];
  job_summary: string;
  key_requirements: string[];
}

export async function analyzeJobPost(
  userId: string,
  jobPost: string,
  firebaseUser: FirebaseUser | null,
): Promise<JobPostAnalysis> {
  const response = await fetch(`${API_BASE_URL}/v1/proposals/analyze-job`, {
    method: "POST",
    headers: await getAuthHeaders(firebaseUser),
    body: JSON.stringify({ user_id: userId, job_post: jobPost }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to analyze job post");
  }

  return response.json();
}

export interface ProposalScore {
  score: number;
  section_scores: {
    relevance: number;
    clarity: number;
    demonstration: number;
    value_proposition: number;
    call_to_action: number;
  };
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  overall_feedback: string;
}

export async function scoreProposal(
  userId: string,
  proposal: string,
  jobPost: string,
  firebaseUser: FirebaseUser | null,
): Promise<ProposalScore> {
  const response = await fetch(`${API_BASE_URL}/v1/proposals/score`, {
    method: "POST",
    headers: await getAuthHeaders(firebaseUser),
    body: JSON.stringify({ user_id: userId, proposal, job_post: jobPost }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to score proposal");
  }

  return response.json();
}
