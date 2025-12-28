'use client';

import { useState, FormEvent, useEffect } from 'react';
import { generateProposal, analyzeJobPost, type ProposalResponse, type JobPostAnalysis } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import styles from './ProposalForm.module.css';
import Card from '@/components/shared/Card/Card';
import Button from '@/components/shared/Button/Button';

interface ProposalFormProps {
  onProposalGenerated: (proposal: ProposalResponse) => void;
}

export default function ProposalForm({ onProposalGenerated }: ProposalFormProps) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [jobPost, setJobPost] = useState('');
  const [preferredTone, setPreferredTone] = useState<'professional' | 'friendly' | 'confident' | 'balanced'>('professional');
  const [proposalLength, setProposalLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<JobPostAnalysis | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setMessage({ type: 'error', text: 'You must be logged in to generate proposals' });
    }
  }, [currentUser]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setLoading(true);
    setMessage(null);

    try {
      const result = await generateProposal(
        { 
          user_id: currentUser.uid, 
          job_post: jobPost,
          preferred_tone: preferredTone,
          proposal_length: proposalLength
        },
        currentUser
      );
      onProposalGenerated(result);
      setMessage({ type: 'success', text: 'Proposal generated successfully!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to generate proposal' });
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!currentUser || !jobPost.trim()) {
      setMessage({ type: 'error', text: 'Please enter a job post first' });
      return;
    }

    setAnalyzing(true);
    setMessage(null);

    try {
      const result = await analyzeJobPost(currentUser.uid, jobPost, currentUser);
      setAnalysis(result);
      setShowSuggestions(true);
      setMessage({ type: 'success', text: 'Job post analyzed! Check suggestions below.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to analyze job post' });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Card>
      <h1 className="card-title">Generate Proposal</h1>
      <p className={styles.description}>
        Paste the job post to generate a tailored proposal based on your profile.
      </p>

      {message && (
        <div className={`${styles.message} ${styles[`message${message.type.charAt(0).toUpperCase() + message.type.slice(1)}`]}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Job Post *</label>
          <textarea
            className={styles.formTextarea}
            value={jobPost}
            onChange={(e) => {
              setJobPost(e.target.value);
              setAnalysis(null);
              setShowSuggestions(false);
            }}
            required
            placeholder="Paste the job description from Upwork here..."
            disabled={!currentUser}
          />
          <div className={styles.analyzeButtonContainer}>
            <Button
              type="button"
              variant="secondary"
              onClick={handleAnalyze}
              disabled={analyzing || !jobPost.trim() || !currentUser}
            >
              {analyzing ? 'Analyzing...' : '🔍 Get Smart Suggestions'}
            </Button>
          </div>
        </div>

        {analysis && showSuggestions && (
          <div className={styles.suggestionsPanel}>
            <div className={styles.suggestionsHeader}>
              <h3>💡 Smart Suggestions</h3>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setShowSuggestions(false)}
              >
                ×
              </button>
            </div>

            {analysis.job_summary && (
              <div className={styles.suggestionSection}>
                <h4>Job Summary</h4>
                <p>{analysis.job_summary}</p>
              </div>
            )}

            {analysis.relevant_skills && analysis.relevant_skills.length > 0 && (
              <div className={styles.suggestionSection}>
                <h4>✅ Your Relevant Skills</h4>
                <div className={styles.skillTags}>
                  {analysis.relevant_skills.map((skill, i) => (
                    <span key={i} className={styles.skillTag}>{skill}</span>
                  ))}
                </div>
              </div>
            )}

            {analysis.missing_skills && analysis.missing_skills.length > 0 && (
              <div className={styles.suggestionSection}>
                <h4>⚠️ Missing Skills (Consider Adding)</h4>
                <div className={styles.skillTags}>
                  {analysis.missing_skills.map((skill, i) => (
                    <span key={i} className={styles.missingSkillTag}>{skill}</span>
                  ))}
                </div>
              </div>
            )}

            {analysis.recommended_case_studies && analysis.recommended_case_studies.length > 0 && (
              <div className={styles.suggestionSection}>
                <h4>📚 Recommended Case Studies to Highlight</h4>
                <p>Focus on case studies #{analysis.recommended_case_studies.join(', ')} in your proposal</p>
              </div>
            )}

            {analysis.profile_gaps && analysis.profile_gaps.length > 0 && (
              <div className={styles.suggestionSection}>
                <h4>📝 Profile Gaps</h4>
                <ul>
                  {analysis.profile_gaps.map((gap, i) => (
                    <li key={i}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.suggestions && analysis.suggestions.length > 0 && (
              <div className={styles.suggestionSection}>
                <h4>💭 Suggestions</h4>
                <ul>
                  {analysis.suggestions.map((suggestion, i) => (
                    <li key={i}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className={styles.advancedSection}>
          <button
            type="button"
            className={styles.advancedToggle}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '▼' : '▶'} Advanced Options
          </button>

          {showAdvanced && (
            <div className={styles.advancedOptions}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Preferred Tone</label>
                <select
                  className={styles.formSelect}
                  value={preferredTone}
                  onChange={(e) => setPreferredTone(e.target.value as any)}
                  disabled={!currentUser}
                >
                  <option value="professional">Professional - Formal and business-like</option>
                  <option value="friendly">Friendly - Warm and approachable</option>
                  <option value="confident">Confident - Assertive and self-assured</option>
                  <option value="balanced">Balanced - Mix of professional and friendly</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Proposal Length</label>
                <select
                  className={styles.formSelect}
                  value={proposalLength}
                  onChange={(e) => setProposalLength(e.target.value as any)}
                  disabled={!currentUser}
                >
                  <option value="short">Short - 2-3 paragraphs (concise)</option>
                  <option value="medium">Medium - 3-4 paragraphs (comprehensive)</option>
                  <option value="long">Long - 4-5 paragraphs (detailed)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? (
            <>
              <span className={styles.spinner}></span>
              Generating...
            </>
          ) : (
            'Generate Proposal'
          )}
        </Button>
      </form>
    </Card>
  );
}

