"use client";

import { useState } from "react";
import { type ProposalResponse } from "@/lib/api";
import styles from "./GenerateProposal.module.css";
import ProposalForm from "@/components/generate/ProposalForm/ProposalForm";
import ProposalDisplay from "@/components/generate/ProposalDisplay/ProposalDisplay";

export default function GenerateProposal() {
  const [proposal, setProposal] = useState<ProposalResponse | null>(null);

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h1 className={styles.title}>AI Proposal Generator</h1>
        <p className={styles.subtitle}>
          Paste the job description and let AI create a winning proposal
        </p>
      </header>

      <div className={styles.panels}>
        <ProposalForm onProposalGenerated={setProposal} />
        <ProposalDisplay proposal={proposal} />
      </div>

      <button
        type="button"
        className={styles.helpIcon}
        aria-label="Help"
        title="Help"
      >
        ?
      </button>
    </div>
  );
}
