"use client";

import styles from "./KeywordCoverageChart.module.css";

interface KeywordData {
  keyword: string;
  coverage: number;
}

interface KeywordCoverageChartProps {
  data: KeywordData[];
}

export default function KeywordCoverageChart({ data }: KeywordCoverageChartProps) {
  return (
    <div className={styles.container}>
      <div className={styles.chart}>
        {data.map((item, index) => (
          <div key={index} className={styles.barRow}>
            <div className={styles.keywordLabel}>{item.keyword}</div>
            <div className={styles.barContainer}>
              <div
                className={styles.bar}
                style={{ width: `${item.coverage}%` }}
              />
              <span className={styles.barValue}>{item.coverage}%</span>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.xAxis}>
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
    </div>
  );
}
