'use client';

import { useState, FormEvent, useEffect } from 'react';
import { generateProposal, type ProposalResponse } from '@/lib/api';
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
        { user_id: currentUser.uid, job_post: jobPost },
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
            onChange={(e) => setJobPost(e.target.value)}
            required
            placeholder="Paste the job description from Upwork here..."
            disabled={!currentUser}
          />
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

