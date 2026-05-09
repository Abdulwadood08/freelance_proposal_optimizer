"use client";

import { useState, FormEvent, useEffect, Fragment } from "react";
import { generateProposal, type ProposalResponse } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import AppToast, {
  type ToastMessage,
  useToastAutoDismiss,
} from "@/components/shared/AppToast/AppToast";
import styles from "./ProposalForm.module.css";

const SparkleIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={styles.sparkle}
  >
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    <path d="M5 21l2.5-7.5L15 13l-7.5 2.5L5 21z" />
    <path d="M19 5l-1.5 4.5L13 8l4.5-1.5L19 5z" />
  </svg>
);

const EXAMPLE = `Looking for an experienced React developer to build a modern web application. Must have:
- 3+ years React experience
- TypeScript expertise
- Strong UI/UX skills
- Portfolio of previous work`;

interface ProposalFormProps {
  onProposalGenerated: (proposal: ProposalResponse) => void;
}

export default function ProposalForm({
  onProposalGenerated,
}: ProposalFormProps) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<ToastMessage>(null);
  const [jobPost, setJobPost] = useState("");
  const [preferredTone, setPreferredTone] = useState<
    "professional" | "friendly" | "confident" | "balanced"
  >("professional");
  const [proposalLength, setProposalLength] = useState<
    "short" | "medium" | "long"
  >("medium");

  useEffect(() => {
    if (!currentUser) {
      setMessage({
        type: "error",
        text: "You must be logged in to generate proposals",
      });
    }
  }, [currentUser]);

  useToastAutoDismiss(message, setMessage);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setLoading(true);
    setMessage(null);

    try {
      const requestPayload = {
        user_id: currentUser.uid,
        job_post: jobPost,
        preferred_tone: preferredTone,
        proposal_length: proposalLength,
      };
      const result = await generateProposal(requestPayload, currentUser);
      onProposalGenerated(result);
      setMessage({
        type: "success",
        text: "Proposal generated successfully!",
      });
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: (err as Error).message || "Failed to generate proposal",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Fragment>
      <div className={styles.panel}>
      <form onSubmit={handleSubmit}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Job Description</h2>
          <span className={styles.charCount}>{jobPost.length} characters</span>
        </div>

        <textarea
          className={styles.textarea}
          value={jobPost}
          onChange={(e) => setJobPost(e.target.value)}
          placeholder="Paste the job description here..."
          required
          disabled={!currentUser}
          rows={8}
        />

        <div className={styles.example}>
          <span className={styles.exampleLabel}>Example:</span>
          <pre className={styles.exampleText}>{EXAMPLE}</pre>
        </div>

        <button
          type="submit"
          className={styles.generateBtn}
          disabled={loading || !currentUser}
        >
          {loading ? (
            <>
              <span className={styles.spinner} />
              Generating...
            </>
          ) : (
            <>
              <SparkleIcon />
              Generate Proposal
            </>
          )}
        </button>
      </form>
      </div>
      <AppToast message={message} onDismiss={() => setMessage(null)} />
    </Fragment>
  );
}
