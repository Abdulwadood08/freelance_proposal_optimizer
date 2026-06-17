"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  type ProposalResponse,
  type ProposalTone,
  updateProposal,
  createTemplate,
  scoreProposal,
  type ProposalScore,
  submitProposalFeedback,
  generateProposalToneVariation,
} from "@/lib/api";
import { exportToPDF, exportToDOCX, exportToTXT } from "@/lib/export";
import styles from "./ProposalDisplay.module.css";
import Button from "@/components/shared/Button/Button";
import AppToast, {
  type ToastMessage,
  useToastAutoDismiss,
} from "@/components/shared/AppToast/AppToast";

interface ProposalDisplayProps {
  proposal: ProposalResponse | null;
  onProposalUpdated?: (updatedProposal: ProposalResponse) => void;
}

export default function ProposalDisplay({
  proposal,
  onProposalUpdated,
}: ProposalDisplayProps) {
  const { currentUser } = useAuth();
  const [activeTone, setActiveTone] = useState<
    "proposal" | "cover_letter" | "professional" | "friendly" | "confident"
  >("proposal");
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<ToastMessage>(null);
  const [proposalState, setProposalState] = useState<ProposalResponse | null>(
    proposal,
  );
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<ProposalScore | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackValue, setFeedbackValue] = useState<1 | -1 | null>(null);
  const [toneLoading, setToneLoading] = useState<ProposalTone | null>(null);

  useEffect(() => {
    setProposalState(proposal);
  }, [proposal]);

  useEffect(() => {
    setFeedbackValue(null);
  }, [proposal?.id, activeTone]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showExportMenu]);

  useToastAutoDismiss(message, setMessage);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ type: "success", text: "Copied to clipboard." });
    } catch {
      setMessage({
        type: "error",
        text: "Could not copy. Try selecting the text manually.",
      });
    }
  };

  const getActiveContent = () => {
    if (!proposalState) return "";
    switch (activeTone) {
      case "professional":
        return proposalState.tone_variations.professional;
      case "friendly":
        return proposalState.tone_variations.friendly;
      case "confident":
        return proposalState.tone_variations.confident;
      default:
        return proposalState.tone_variations.professional;
    }
  };

  const handleEdit = () => {
    setEditedContent(getActiveContent());
    setIsEditing(true);
    setMessage(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContent("");
    setMessage(null);
  };

  const handleSave = async () => {
    const proposalId = proposalState?.id;
    if (!currentUser || !proposalId) {
      setMessage({
        type: "error",
        text: "Cannot save: Missing user or proposal ID",
      });
      return;
    }

    const current = proposalState!;
    setSaving(true);
    setMessage(null);

    try {
      const toneKey = activeTone as keyof typeof current.tone_variations;
      const toneVariations = {
        ...current.tone_variations,
        ...(activeTone === "professional" ||
        activeTone === "friendly" ||
        activeTone === "confident"
          ? { [toneKey]: editedContent }
          : {}),
      };

      const updates = { tone_variations: toneVariations };

      await updateProposal(
        proposalId,
        currentUser.uid,
        updates,
        currentUser,
      );

      const updatedProposal: ProposalResponse = {
        ...current,
        tone_variations: toneVariations,
      };

      setProposalState(updatedProposal);
      setIsEditing(false);
      setMessage({ type: "success", text: "Proposal updated successfully!" });

      if (onProposalUpdated) {
        onProposalUpdated(updatedProposal);
      }
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.message || "Failed to update proposal",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!currentUser || !proposalState || !templateName.trim()) {
      setMessage({ type: "error", text: "Please enter a template name" });
      return;
    }

    setSavingTemplate(true);
    setMessage(null);

    try {
      await createTemplate(
        currentUser.uid,
        {
          name: templateName,
          description: templateDescription || undefined,
          proposal: proposalState.proposal,
          cover_letter: proposalState.cover_letter,
          tone_variations: proposalState.tone_variations,
        },
        currentUser,
      );

      setShowSaveTemplate(false);
      setTemplateName("");
      setTemplateDescription("");
      setMessage({ type: "success", text: "Template saved successfully!" });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.message || "Failed to save template",
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleScoreProposal = async () => {
    if (!currentUser || !proposalState?.job_post) {
      setMessage({
        type: "error",
        text: "Cannot score: Missing user or job post",
      });
      return;
    }

    const jobPost = proposalState.job_post;
    setScoring(true);
    setMessage(null);

    try {
      const result = await scoreProposal(
        currentUser.uid,
        getActiveContent(),
        jobPost,
        currentUser,
      );
      setScoreResult(result);
      setShowScore(true);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.message || "Failed to score proposal",
      });
    } finally {
      setScoring(false);
    }
  };

  const ensureToneVariation = async (tone: ProposalTone) => {
    if (!currentUser || !proposalState?.id) {
      setMessage({
        type: "error",
        text: "Please generate and save a proposal first.",
      });
      return;
    }

    const existingTone = (proposalState.tone_variations?.[tone] || "").trim();
    if (existingTone) {
      setActiveTone(tone);
      return;
    }

    try {
      setToneLoading(tone);
      setMessage({ type: "success", text: `Generating ${tone} variation...` });
      const updatedProposal = await generateProposalToneVariation(
        proposalState.id,
        currentUser.uid,
        tone,
        currentUser,
      );
      setProposalState(updatedProposal);
      setActiveTone(tone);
      setMessage({
        type: "success",
        text: `${tone.charAt(0).toUpperCase() + tone.slice(1)} variation generated.`,
      });
      if (onProposalUpdated) onProposalUpdated(updatedProposal);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.message || `Failed to generate ${tone} variation`,
      });
    } finally {
      setToneLoading(null);
    }
  };

  const buildJobId = () => {
    const raw = (proposalState?.job_post || "").trim();
    if (!raw) return proposalState?.id || "unknown-job";
    let hash = 0;
    for (let i = 0; i < raw.length; i += 1) {
      hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
    }
    return `job_${hash.toString(16)}`;
  };

  const handleFeedback = async (rating: 1 | -1) => {
    if (!currentUser || !proposalState?.id) {
      setMessage({
        type: "error",
        text: "Feedback failed: missing user or proposal context.",
      });
      return;
    }
    try {
      setFeedbackLoading(true);
      await submitProposalFeedback(
        currentUser.uid,
        proposalState.id,
        buildJobId(),
        rating,
        currentUser,
      );
      setFeedbackValue(rating);
      setMessage({
        type: "success",
        text:
          rating === 1
            ? "Thanks! Positive feedback saved."
            : "Thanks! Feedback saved. We will improve future proposals.",
      });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Failed to submit feedback.",
      });
    } finally {
      setFeedbackLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "var(--success-color)";
    if (score >= 6) return "var(--primary-color)";
    if (score >= 4) return "#f59e0b";
    return "var(--error-color)";
  };

  const handleExport = async (format: "pdf" | "docx" | "txt") => {
    if (!proposalState) return;

    try {
      const exportContent = {
        proposal: proposalState.proposal,
        coverLetter: proposalState.cover_letter,
        title: `Proposal - ${new Date().toLocaleDateString()}`,
      };

      switch (format) {
        case "pdf":
          await exportToPDF(exportContent);
          break;
        case "docx":
          await exportToDOCX(exportContent);
          break;
        case "txt":
          exportToTXT(exportContent);
          break;
      }

      setShowExportMenu(false);
      setMessage({
        type: "success",
        text: `Exported as ${format.toUpperCase()}!`,
      });
    } catch (error: any) {
      setMessage({ type: "error", text: `Failed to export: ${error.message}` });
    }
  };

  if (!proposal) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Generated Proposal</h2>
          <div className={styles.proposalTabs}>
            <button type="button" className={`${styles.tab} ${styles.active}`}>
              Professional
            </button>
            <button type="button" className={styles.tab}>
              Friendly
            </button>
            <button type="button" className={styles.tab}>
              Confident
            </button>
          </div>
        </div>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>!</div>
          <p className={styles.emptyText}>
            Paste a job description and click Generate
          </p>
        </div>
      </div>
    );
  }

  return (
    <Fragment>
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Generated Proposal</h2>
        <div className={styles.proposalTabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeTone === "professional" ? styles.active : ""}`}
            onClick={() => !isEditing && ensureToneVariation("professional")}
            disabled={isEditing || toneLoading !== null}
          >
            {toneLoading === "professional"
              ? "Professional..."
              : "Professional"}
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTone === "friendly" ? styles.active : ""}`}
            onClick={() => !isEditing && ensureToneVariation("friendly")}
            disabled={isEditing || toneLoading !== null}
          >
            {toneLoading === "friendly" ? "Friendly..." : "Friendly"}
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTone === "confident" ? styles.active : ""}`}
            onClick={() => !isEditing && ensureToneVariation("confident")}
            disabled={isEditing || toneLoading !== null}
          >
            {toneLoading === "confident" ? "Confident..." : "Confident"}
          </button>
        </div>
      </div>

      {proposalState?.id && !isEditing && (
        <div className={`${styles.headerActions} ${styles.actionsRow}`}>
          <Button
            variant="secondary"
            onClick={handleScoreProposal}
            className={styles.scoreBtn}
            disabled={scoring}
          >
            {scoring ? "⏳ Scoring..." : "⭐ Score"}
          </Button>
          <div className={styles.exportContainer} ref={exportMenuRef}>
            <Button
              variant="secondary"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className={styles.exportBtn}
            >
              📥 Export
            </Button>
            {showExportMenu && (
              <div className={styles.exportMenu}>
                <button
                  className={styles.exportMenuItem}
                  onClick={() => handleExport("pdf")}
                >
                  📄 PDF
                </button>
                <button
                  className={styles.exportMenuItem}
                  onClick={() => handleExport("docx")}
                >
                  📝 DOCX
                </button>
                <button
                  className={styles.exportMenuItem}
                  onClick={() => handleExport("txt")}
                >
                  📋 TXT
                </button>
              </div>
            )}
          </div>
          <Button
            variant="secondary"
            onClick={() => setShowSaveTemplate(true)}
            className={styles.templateBtn}
          >
            💾 Template
          </Button>
          <Button
            variant="secondary"
            onClick={handleEdit}
            className={styles.editBtn}
          >
            ✏️ Edit
          </Button>
        </div>
      )}

      <div className={styles.proposalSection}>
        {isEditing ? (
          <div className={styles.editMode}>
            <textarea
              className={styles.editTextarea}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows={15}
            />
            <div className={styles.editActions}>
              <Button
                variant="secondary"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.proposalContent}>{getActiveContent()}</div>
            <Button
              variant="secondary"
              className={styles.copyBtn}
              onClick={() => copyToClipboard(getActiveContent())}
            >
              Copy to Clipboard
            </Button>
          </>
        )}
      </div>

      {scoreResult && showScore && (
        <div className={styles.scorePanel}>
          <div className={styles.scoreHeader}>
            <h3>
              ⭐ Quality Score:{" "}
              <span style={{ color: getScoreColor(scoreResult.score) }}>
                {scoreResult.score}/10
              </span>
            </h3>
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => setShowScore(false)}
            >
              ×
            </button>
          </div>

          <div className={styles.scoreSections}>
            <div className={styles.scoreSection}>
              <h4>Section Scores</h4>
              <div className={styles.sectionScoresGrid}>
                <div className={styles.sectionScoreItem}>
                  <span>Relevance</span>
                  <span
                    style={{
                      color: getScoreColor(
                        scoreResult.section_scores.relevance * 5,
                      ),
                    }}
                  >
                    {scoreResult.section_scores.relevance}/2
                  </span>
                </div>
                <div className={styles.sectionScoreItem}>
                  <span>Clarity</span>
                  <span
                    style={{
                      color: getScoreColor(
                        scoreResult.section_scores.clarity * 5,
                      ),
                    }}
                  >
                    {scoreResult.section_scores.clarity}/2
                  </span>
                </div>
                <div className={styles.sectionScoreItem}>
                  <span>Demonstration</span>
                  <span
                    style={{
                      color: getScoreColor(
                        scoreResult.section_scores.demonstration * 5,
                      ),
                    }}
                  >
                    {scoreResult.section_scores.demonstration}/2
                  </span>
                </div>
                <div className={styles.sectionScoreItem}>
                  <span>Value Prop</span>
                  <span
                    style={{
                      color: getScoreColor(
                        scoreResult.section_scores.value_proposition * 5,
                      ),
                    }}
                  >
                    {scoreResult.section_scores.value_proposition}/2
                  </span>
                </div>
                <div className={styles.sectionScoreItem}>
                  <span>Call to Action</span>
                  <span
                    style={{
                      color: getScoreColor(
                        scoreResult.section_scores.call_to_action * 5,
                      ),
                    }}
                  >
                    {scoreResult.section_scores.call_to_action}/2
                  </span>
                </div>
              </div>
            </div>

            {scoreResult.strengths && scoreResult.strengths.length > 0 && (
              <div className={styles.scoreSection}>
                <h4>✅ Strengths</h4>
                <ul>
                  {scoreResult.strengths.map((strength, i) => (
                    <li key={i}>{strength}</li>
                  ))}
                </ul>
              </div>
            )}

            {scoreResult.weaknesses && scoreResult.weaknesses.length > 0 && (
              <div className={styles.scoreSection}>
                <h4>⚠️ Weaknesses</h4>
                <ul>
                  {scoreResult.weaknesses.map((weakness, i) => (
                    <li key={i}>{weakness}</li>
                  ))}
                </ul>
              </div>
            )}

            {scoreResult.suggestions && scoreResult.suggestions.length > 0 && (
              <div className={styles.scoreSection}>
                <h4>💡 Suggestions</h4>
                <ul>
                  {scoreResult.suggestions.map((suggestion, i) => (
                    <li key={i}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}

            {scoreResult.overall_feedback && (
              <div className={styles.scoreSection}>
                <h4>📝 Overall Feedback</h4>
                <p>{scoreResult.overall_feedback}</p>
              </div>
            )}

            <div className={styles.feedbackRow}>
              <h4 className={styles.feedbackTitle}>
                Was this proposal useful?
              </h4>
              <div className={styles.feedbackButtons}>
                <button
                  type="button"
                  className={`${styles.feedbackButton} ${feedbackValue === 1 ? styles.feedbackButtonActive : ""}`}
                  onClick={() => handleFeedback(1)}
                  disabled={feedbackLoading}
                >
                  👍 Good
                </button>
                <button
                  type="button"
                  className={`${styles.feedbackButton} ${feedbackValue === -1 ? styles.feedbackButtonActive : ""}`}
                  onClick={() => handleFeedback(-1)}
                  disabled={feedbackLoading}
                >
                  👎 Bad
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSaveTemplate && proposalState && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowSaveTemplate(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Save as Template</h3>
            <p className={styles.modalDescription}>
              Save this proposal as a template to reuse it for similar jobs.
            </p>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Template Name *</label>
              <input
                type="text"
                className={styles.formInput}
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., React Developer Proposal"
                disabled={savingTemplate}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Description (Optional)</label>
              <textarea
                className={styles.formTextarea}
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Brief description..."
                rows={3}
                disabled={savingTemplate}
              />
            </div>
            <div className={styles.modalActions}>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowSaveTemplate(false);
                  setTemplateName("");
                  setTemplateDescription("");
                }}
                disabled={savingTemplate}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveAsTemplate}
                disabled={savingTemplate || !templateName.trim()}
              >
                {savingTemplate ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    <AppToast message={message} onDismiss={() => setMessage(null)} />
    </Fragment>
  );
}
