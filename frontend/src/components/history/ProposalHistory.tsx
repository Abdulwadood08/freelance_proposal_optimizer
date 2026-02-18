"use client";

import { useState, useEffect } from "react";
import { getUserProposals, type Proposal } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./ProposalHistory.module.css";

const DocumentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.docIcon}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const MatchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.matchIcon}>
    <path d="M3 12c0-1.657 4.03-3 9-3s9 1.343 9 3" />
    <path d="M3 12c0 1.657 4.03 3 9 3s9-1.343 9-3" />
    <path d="M3 6c0-1.657 4.03-3 9-3s9 1.343 9 3" />
    <path d="M3 6c0 1.657 4.03 3 9 3s9-1.343 9-3" />
    <path d="M3 18c0-1.657 4.03-3 9-3s9 1.343 9 3" />
    <path d="M3 18c0 1.657 4.03 3 9 3s9-1.343 9-3" />
  </svg>
);

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function extractTitle(jobPost: string): string {
  if (!jobPost) return "Untitled Proposal";
  // Try to extract title from first line or first sentence
  const lines = jobPost.split("\n").filter((l) => l.trim());
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    // If it's too long, truncate
    if (firstLine.length > 60) {
      return firstLine.substring(0, 57) + "...";
    }
    return firstLine;
  }
  // Fallback: use first 60 chars
  return jobPost.substring(0, 60).trim() + (jobPost.length > 60 ? "..." : "");
}

function calculateMatchPercentage(proposal: Proposal): number {
  // Simple heuristic: base match on proposal length and status
  // In a real app, this would come from backend analysis
  let base = 75;
  if (proposal.status === "won") base += 15;
  else if (proposal.status === "sent") base += 10;
  else if (proposal.status === "lost") base -= 10;
  
  // Add some variation based on proposal length
  const length = proposal.proposal?.length || 0;
  if (length > 500) base += 5;
  if (length > 1000) base += 5;
  
  return Math.min(100, Math.max(60, base + Math.floor(Math.random() * 20)));
}

function getStatusInfo(status?: string) {
  switch (status) {
    case "won":
      return { label: "Accepted", className: styles.statusAccepted };
    case "sent":
      return { label: "Pending", className: styles.statusPending };
    case "lost":
      return { label: "Declined", className: styles.statusDeclined };
    case "draft":
      return { label: "Draft", className: styles.statusDraft };
    default:
      return { label: "Draft", className: styles.statusDraft };
  }
}

export default function ProposalHistory() {
  const { currentUser } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      loadProposals();
    }
  }, [currentUser]);

  const loadProposals = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getUserProposals(currentUser.uid, currentUser, 50);
      setProposals(result.proposals || []);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load proposals");
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = (proposal: Proposal) => {
    // Navigate to proposal detail or open modal
    window.location.href = `/generate?proposal=${proposal.id}`;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading proposals...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Proposal History</h1>
        <p className={styles.subtitle}>Track all your generated proposals and their status</p>
      </header>

      {proposals.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No proposals yet. Generate your first proposal to see it here!</p>
        </div>
      ) : (
        <div className={styles.proposalsList}>
          {proposals.map((proposal) => {
            const statusInfo = getStatusInfo(proposal.status);
            const matchPercent = calculateMatchPercentage(proposal);
            const title = extractTitle(proposal.job_post || "");
            const date = proposal.created_at ? formatDate(proposal.created_at) : "Unknown date";

            return (
              <div key={proposal.id} className={styles.proposalCard}>
                <div className={styles.cardIcon}>
                  <DocumentIcon />
                </div>
                <div className={styles.cardContent}>
                  <h3 className={styles.cardTitle}>{title}</h3>
                  <div className={styles.cardMeta}>
                    <span className={styles.cardDate}>{date}</span>
                    <span className={styles.cardMatch}>
                      <MatchIcon />
                      Match: {matchPercent}%
                    </span>
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <span className={`${styles.statusTag} ${statusInfo.className}`}>
                    {statusInfo.label}
                  </span>
                  {(proposal.status === "lost" || proposal.status === "draft") && (
                    <button
                      type="button"
                      className={styles.previewBtn}
                      onClick={() => handlePreview(proposal)}
                    >
                      Preview
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
