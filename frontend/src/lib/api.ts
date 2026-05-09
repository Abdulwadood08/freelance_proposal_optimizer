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

async function getApiErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) {
      return body.detail.map((d: unknown) => JSON.stringify(d)).join("; ");
    }
    return fallback;
  } catch {
    return fallback;
  }
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
export type ProposalTone = "professional" | "friendly" | "confident";

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

export interface ProfileSuggestionsRequest {
  user_id: string;
  name: string;
  email: string;
  skills: string[];
  case_studies: unknown[];
  resume_present: boolean;
  upwork_profile: string;
  portfolio_links: string[];
  work_experience: Array<{ title?: string; company?: string; period?: string }>;
}

export interface ResumeExtractResponse {
  full_name: string;
  skills: string[];
  work_experience: Array<{ title?: string; company?: string; period?: string }>;
  projects: Array<{ title?: string; description?: string }>;
  links: {
    linkedin?: string;
    github?: string;
    portfolio?: string;
    upwork?: string;
  };
  professional_summary?: string;
}

export async function extractResumeProfile(
  file: File,
  firebaseUser: FirebaseUser | null,
): Promise<ResumeExtractResponse> {
  const token = await getAuthToken(firebaseUser);
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const fd = new FormData();
  fd.append("file", file);
  const response = await fetch(`${API_BASE_URL}/v1/profile/extract-resume`, {
    method: "POST",
    headers,
    body: fd,
  });
  if (!response.ok) {
    const msg = await getApiErrorMessage(response, "Could not parse résumé");
    throw new Error(msg);
  }
  return response.json();
}

export async function fetchProfileSuggestions(
  payload: ProfileSuggestionsRequest,
  firebaseUser: FirebaseUser | null,
): Promise<{ suggestions: string[] }> {
  const response = await fetch(`${API_BASE_URL}/v1/profile/suggestions`, {
    method: "POST",
    headers: await getAuthHeaders(firebaseUser),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const msg = await getApiErrorMessage(
      response,
      "Failed to load profile suggestions",
    );
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

export async function generateProposalToneVariation(
  proposalId: string,
  userId: string,
  tone: ProposalTone,
  firebaseUser: FirebaseUser | null,
): Promise<ProposalResponse> {
  const response = await fetch(
    `${API_BASE_URL}/v1/proposals/${proposalId}/tone`,
    {
      method: "POST",
      headers: await getAuthHeaders(firebaseUser),
      body: JSON.stringify({ user_id: userId, tone }),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to generate tone variation");
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
  avg_score?: number;
  score_sample_size?: number;
  feedback_positive_rate?: number;
  total_feedback?: number;
  monthly_activity?: Array<{
    month_key: string;
    label: string;
    generated: number;
    won: number;
  }>;
  /** Month-over-month % change for proposals created (latest vs prior month). */
  mom_generated_pct?: number | null;
  /** Wins in latest month minus wins in prior month. */
  mom_won_delta?: number | null;
  recent_activity?: Array<{
    proposal_id?: string;
    status: string;
    created_at?: string;
    source?: string;
    fit_score?: number;
  }>;
  top_performing_proposal?: {
    proposal_id?: string;
    status: string;
    fit_score?: number;
    created_at?: string;
    excerpt?: string;
  } | null;
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

export interface PluginAnalyzeResult {
  id?: string;
  fit_score: number;
  breakdown?: {
    skills: number;
    experience: number;
    requirements: number;
    proposal: number;
  };
  keywords: string[];
  strategy: string;
  proposal: string;
  variations: Array<{ tone: string; proposal: string }>;
}

export async function submitProposalFeedback(
  userId: string,
  proposalId: string,
  jobId: string,
  rating: 1 | -1,
  firebaseUser: FirebaseUser | null,
): Promise<{ success: boolean; feedback_id: string }> {
  const response = await fetch(`${API_BASE_URL}/v1/feedback`, {
    method: "POST",
    headers: await getAuthHeaders(firebaseUser),
    body: JSON.stringify({
      user_id: userId,
      proposal_id: proposalId,
      job_id: jobId,
      rating,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to submit feedback");
  }

  return response.json();
}
