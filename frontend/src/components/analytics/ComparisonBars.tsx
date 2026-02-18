"use client";

import styles from "./ComparisonBars.module.css";

interface ComparisonData {
  personalization: { you: number; avg: number };
  clarity: { you: number; avg: number };
  valueProp: { you: number; avg: number };
  professionalism: { you: number; avg: number };
}

interface ComparisonBarsProps {
  data: ComparisonData;
}

export default function ComparisonBars({ data }: ComparisonBarsProps) {
  const comparisons = [
    { label: "Personalization", you: data.personalization.you, avg: data.personalization.avg },
    { label: "Clarity", you: data.clarity.you, avg: data.clarity.avg },
    { label: "Value Prop", you: data.valueProp.you, avg: data.valueProp.avg },
    { label: "Professionalism", you: data.professionalism.you, avg: data.professionalism.avg },
  ];

  return (
    <div className={styles.container}>
      {comparisons.map((comp, index) => (
        <div key={index} className={styles.comparisonRow}>
          <div className={styles.label}>{comp.label}</div>
          <div className={styles.barsContainer}>
            <div className={styles.barGroup}>
              <div className={styles.barLabel}>You</div>
              <div className={styles.barWrapper}>
                <div
                  className={`${styles.bar} ${styles.barYou}`}
                  style={{ width: `${comp.you}%` }}
                />
                <span className={styles.barText}>{comp.you}%</span>
              </div>
            </div>
            <div className={styles.barGroup}>
              <div className={styles.barLabel}>Avg</div>
              <div className={styles.barWrapper}>
                <div
                  className={`${styles.bar} ${styles.barAvg}`}
                  style={{ width: `${comp.avg}%` }}
                />
                <span className={styles.barText}>{comp.avg}%</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
