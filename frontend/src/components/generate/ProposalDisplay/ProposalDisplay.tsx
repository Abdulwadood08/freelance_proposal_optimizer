'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { type ProposalResponse, updateProposal, createTemplate, scoreProposal, type ProposalScore } from '@/lib/api';
import { exportToPDF, exportToDOCX, exportToTXT } from '@/lib/export';
import styles from './ProposalDisplay.module.css';
import Card from '@/components/shared/Card/Card';
import Button from '@/components/shared/Button/Button';

interface ProposalDisplayProps {
  proposal: ProposalResponse;
  onProposalUpdated?: (updatedProposal: ProposalResponse) => void;
}

export default function ProposalDisplay({ proposal, onProposalUpdated }: ProposalDisplayProps) {
  const { currentUser } = useAuth();
  const [activeTone, setActiveTone] = useState<'proposal' | 'cover_letter' | 'professional' | 'friendly' | 'confident'>('proposal');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [proposalState, setProposalState] = useState<ProposalResponse>(proposal);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<ProposalScore | null>(null);
  const [showScore, setShowScore] = useState(false);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showExportMenu]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const getActiveContent = () => {
    switch (activeTone) {
      case 'proposal':
        return proposalState.proposal;
      case 'cover_letter':
        return proposalState.cover_letter;
      case 'professional':
        return proposalState.tone_variations.professional;
      case 'friendly':
        return proposalState.tone_variations.friendly;
      case 'confident':
        return proposalState.tone_variations.confident;
      default:
        return proposalState.proposal;
    }
  };

  const handleEdit = () => {
    setEditedContent(getActiveContent());
    setIsEditing(true);
    setMessage(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContent('');
    setMessage(null);
  };

  const handleSave = async () => {
    if (!currentUser || !proposalState.id) {
      setMessage({ type: 'error', text: 'Cannot save: Missing user or proposal ID' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const updates: any = {};
      
      switch (activeTone) {
        case 'proposal':
          updates.proposal = editedContent;
          break;
        case 'cover_letter':
          updates.cover_letter = editedContent;
          break;
        case 'professional':
          updates.tone_variations = {
            ...proposalState.tone_variations,
            professional: editedContent
          };
          break;
        case 'friendly':
          updates.tone_variations = {
            ...proposalState.tone_variations,
            friendly: editedContent
          };
          break;
        case 'confident':
          updates.tone_variations = {
            ...proposalState.tone_variations,
            confident: editedContent
          };
          break;
      }

      await updateProposal(proposalState.id, currentUser.uid, updates, currentUser);
      
      // Update local state
      const updatedProposal = { ...proposalState };
      if (updates.proposal) updatedProposal.proposal = updates.proposal;
      if (updates.cover_letter) updatedProposal.cover_letter = updates.cover_letter;
      if (updates.tone_variations) updatedProposal.tone_variations = updates.tone_variations;
      
      setProposalState(updatedProposal);
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Proposal updated successfully!' });
      
      if (onProposalUpdated) {
        onProposalUpdated(updatedProposal);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update proposal' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!currentUser || !templateName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a template name' });
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
          tone_variations: proposalState.tone_variations
        },
        currentUser
      );
      
      setShowSaveTemplate(false);
      setTemplateName('');
      setTemplateDescription('');
      setMessage({ type: 'success', text: 'Template saved successfully!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save template' });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleScoreProposal = async () => {
    if (!currentUser || !proposalState.job_post) {
      setMessage({ type: 'error', text: 'Cannot score: Missing user or job post' });
      return;
    }

    setScoring(true);
    setMessage(null);

    try {
      const result = await scoreProposal(
        currentUser.uid,
        getActiveContent(),
        proposalState.job_post,
        currentUser
      );
      setScoreResult(result);
      setShowScore(true);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to score proposal' });
    } finally {
      setScoring(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'var(--success-color)';
    if (score >= 6) return 'var(--primary-color)';
    if (score >= 4) return '#f59e0b';
    return 'var(--error-color)';
  };

  const handleExport = async (format: 'pdf' | 'docx' | 'txt') => {
    try {
      const exportContent = {
        proposal: proposalState.proposal,
        coverLetter: proposalState.cover_letter,
        title: `Proposal - ${new Date().toLocaleDateString()}`,
      };

      switch (format) {
        case 'pdf':
          await exportToPDF(exportContent);
          break;
        case 'docx':
          await exportToDOCX(exportContent);
          break;
        case 'txt':
          exportToTXT(exportContent);
          break;
      }
      
      setShowExportMenu(false);
      setMessage({ type: 'success', text: `Exported as ${format.toUpperCase()}!` });
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to export: ${error.message}` });
    }
  };

  return (
    <Card>
      <div className={styles.header}>
        <h2 className="card-title">Generated Proposal</h2>
        {proposalState.id && !isEditing && (
          <div className={styles.headerActions}>
            <Button
              variant="secondary"
              onClick={handleScoreProposal}
              className={styles.scoreBtn}
              disabled={scoring}
            >
              {scoring ? '⏳ Scoring...' : '⭐ Score Quality'}
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
                    onClick={() => handleExport('pdf')}
                  >
                    📄 Export as PDF
                  </button>
                  <button
                    className={styles.exportMenuItem}
                    onClick={() => handleExport('docx')}
                  >
                    📝 Export as DOCX
                  </button>
                  <button
                    className={styles.exportMenuItem}
                    onClick={() => handleExport('txt')}
                  >
                    📋 Export as TXT
                  </button>
                </div>
              )}
            </div>
            <Button
              variant="secondary"
              onClick={() => setShowSaveTemplate(true)}
              className={styles.templateBtn}
            >
              💾 Save as Template
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
      </div>

      {message && (
        <div className={`${styles.message} ${styles[`message${message.type.charAt(0).toUpperCase() + message.type.slice(1)}`]}`}>
          {message.text}
        </div>
      )}

      <div className={styles.proposalTabs}>
        <button
          className={`${styles.tab} ${activeTone === 'proposal' ? styles.active : ''}`}
          onClick={() => {
            if (!isEditing) setActiveTone('proposal');
          }}
          disabled={isEditing}
        >
          Full Proposal
        </button>
        <button
          className={`${styles.tab} ${activeTone === 'cover_letter' ? styles.active : ''}`}
          onClick={() => {
            if (!isEditing) setActiveTone('cover_letter');
          }}
          disabled={isEditing}
        >
          Cover Letter
        </button>
        <button
          className={`${styles.tab} ${activeTone === 'professional' ? styles.active : ''}`}
          onClick={() => {
            if (!isEditing) setActiveTone('professional');
          }}
          disabled={isEditing}
        >
          Professional
        </button>
        <button
          className={`${styles.tab} ${activeTone === 'friendly' ? styles.active : ''}`}
          onClick={() => {
            if (!isEditing) setActiveTone('friendly');
          }}
          disabled={isEditing}
        >
          Friendly
        </button>
        <button
          className={`${styles.tab} ${activeTone === 'confident' ? styles.active : ''}`}
          onClick={() => {
            if (!isEditing) setActiveTone('confident');
          }}
          disabled={isEditing}
        >
          Confident
        </button>
      </div>

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
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.proposalContent}>
              {getActiveContent()}
            </div>
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
            <h3>⭐ Quality Score: <span style={{ color: getScoreColor(scoreResult.score) }}>{scoreResult.score}/10</span></h3>
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
                  <span style={{ color: getScoreColor(scoreResult.section_scores.relevance * 5) }}>
                    {scoreResult.section_scores.relevance}/2
                  </span>
                </div>
                <div className={styles.sectionScoreItem}>
                  <span>Clarity</span>
                  <span style={{ color: getScoreColor(scoreResult.section_scores.clarity * 5) }}>
                    {scoreResult.section_scores.clarity}/2
                  </span>
                </div>
                <div className={styles.sectionScoreItem}>
                  <span>Demonstration</span>
                  <span style={{ color: getScoreColor(scoreResult.section_scores.demonstration * 5) }}>
                    {scoreResult.section_scores.demonstration}/2
                  </span>
                </div>
                <div className={styles.sectionScoreItem}>
                  <span>Value Prop</span>
                  <span style={{ color: getScoreColor(scoreResult.section_scores.value_proposition * 5) }}>
                    {scoreResult.section_scores.value_proposition}/2
                  </span>
                </div>
                <div className={styles.sectionScoreItem}>
                  <span>Call to Action</span>
                  <span style={{ color: getScoreColor(scoreResult.section_scores.call_to_action * 5) }}>
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
          </div>
        </div>
      )}

      {showSaveTemplate && (
        <div className={styles.modalOverlay} onClick={() => setShowSaveTemplate(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
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
                placeholder="Brief description of when to use this template..."
                rows={3}
                disabled={savingTemplate}
              />
            </div>

            <div className={styles.modalActions}>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowSaveTemplate(false);
                  setTemplateName('');
                  setTemplateDescription('');
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
                {savingTemplate ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

