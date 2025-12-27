'use client';

import { useState } from 'react';
import { type ProposalResponse } from '@/lib/api';
import styles from './GenerateProposal.module.css';
import ProposalForm from '@/components/generate/ProposalForm/ProposalForm';
import ProposalDisplay from '@/components/generate/ProposalDisplay/ProposalDisplay';

export default function GenerateProposal() {
  const [proposal, setProposal] = useState<ProposalResponse | null>(null);

  return (
    <div className={styles.container}>
      <ProposalForm onProposalGenerated={setProposal} />
      {proposal && <ProposalDisplay proposal={proposal} />}
    </div>
  );
}

