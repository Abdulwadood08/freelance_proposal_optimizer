'use client';

import { useState } from 'react';
import { type ProposalResponse } from '@/lib/api';
import styles from './ProposalDisplay.module.css';
import Card from '@/components/shared/Card/Card';
import Button from '@/components/shared/Button/Button';

interface ProposalDisplayProps {
  proposal: ProposalResponse;
}

export default function ProposalDisplay({ proposal }: ProposalDisplayProps) {
  const [activeTone, setActiveTone] = useState<'proposal' | 'cover_letter' | 'professional' | 'friendly' | 'confident'>('proposal');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const getActiveContent = () => {
    switch (activeTone) {
      case 'proposal':
        return proposal.proposal;
      case 'cover_letter':
        return proposal.cover_letter;
      case 'professional':
        return proposal.tone_variations.professional;
      case 'friendly':
        return proposal.tone_variations.friendly;
      case 'confident':
        return proposal.tone_variations.confident;
      default:
        return proposal.proposal;
    }
  };

  return (
    <Card>
      <h2 className="card-title">Generated Proposal</h2>

      <div className={styles.proposalTabs}>
        <button
          className={`${styles.tab} ${activeTone === 'proposal' ? styles.active : ''}`}
          onClick={() => setActiveTone('proposal')}
        >
          Full Proposal
        </button>
        <button
          className={`${styles.tab} ${activeTone === 'cover_letter' ? styles.active : ''}`}
          onClick={() => setActiveTone('cover_letter')}
        >
          Cover Letter
        </button>
        <button
          className={`${styles.tab} ${activeTone === 'professional' ? styles.active : ''}`}
          onClick={() => setActiveTone('professional')}
        >
          Professional
        </button>
        <button
          className={`${styles.tab} ${activeTone === 'friendly' ? styles.active : ''}`}
          onClick={() => setActiveTone('friendly')}
        >
          Friendly
        </button>
        <button
          className={`${styles.tab} ${activeTone === 'confident' ? styles.active : ''}`}
          onClick={() => setActiveTone('confident')}
        >
          Confident
        </button>
      </div>

      <div className={styles.proposalSection}>
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
      </div>
    </Card>
  );
}

