'use client';

import { useState, FormEvent } from 'react';
import { generateProposal, type ProposalResponse } from '@/lib/api';
import styles from './ProposalForm.module.css';
import Card from '@/components/shared/Card/Card';
import Button from '@/components/shared/Button/Button';

interface ProposalFormProps {
  onProposalGenerated: (proposal: ProposalResponse) => void;
}

export default function ProposalForm({ onProposalGenerated }: ProposalFormProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    user_id: '',
    job_post: '',
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const result = await generateProposal(formData);
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
        Enter your user ID and paste the job post to generate a tailored proposal.
      </p>

      {message && (
        <div className={`${styles.message} ${styles[`message${message.type.charAt(0).toUpperCase() + message.type.slice(1)}`]}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>User ID *</label>
          <input
            type="text"
            className={styles.formInput}
            value={formData.user_id}
            onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
            required
            placeholder="e.g., john_doe_123"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Job Post *</label>
          <textarea
            className={styles.formTextarea}
            value={formData.job_post}
            onChange={(e) => setFormData({ ...formData, job_post: e.target.value })}
            required
            placeholder="Paste the job description from Upwork here..."
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

