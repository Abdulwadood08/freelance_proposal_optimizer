"use client";

import styles from "./ScoreCard.module.css";

interface ScoreCardProps {
  title: string;
  score: number;
  message: string;
  isPercentage?: boolean;
}

export default function ScoreCard({ title, score, message, isPercentage = false }: ScoreCardProps) {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.score}>{score}{isPercentage ? "%" : ""}</div>
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className={styles.message}>{message}</p>
    </div>
  );
}
