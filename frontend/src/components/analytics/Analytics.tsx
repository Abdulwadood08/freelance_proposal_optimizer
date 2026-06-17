"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getProposalAnalytics, type ProposalAnalytics } from "@/lib/api";
import styles from "./Analytics.module.css";
import ScoreCard from "./ScoreCard";
import KeywordCoverageChart from "./KeywordCoverageChart";

export default function Analytics() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<ProposalAnalytics | null>(null);

  const loadAnalytics = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const result = await getProposalAnalytics(currentUser.uid, currentUser);
      setAnalytics(result);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadAnalytics();
    }
  }, [currentUser, loadAnalytics]);

  const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value || 0)));

  const getStatusCoverageData = () => {
    if (!analytics) return [];
    const total = analytics.total_proposals || 1;
    const entries = Object.entries(analytics.status_counts || {});
    return entries.map(([status, count]) => ({
      keyword: status.charAt(0).toUpperCase() + status.slice(1),
      coverage: clampPercent((count / total) * 100),
    }));
  };

  const formatWhen = (iso?: string) => {
    if (!iso) return "Unknown date";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  };

  const getRecentActivityRows = () => {
    if (!analytics?.recent_activity?.length) return [];
    return analytics.recent_activity.slice(0, 6).map((item) => ({
      id: item.proposal_id || "unknown",
      title: `${(item.status || "draft").toUpperCase()} proposal`,
      meta: `${item.source || "web"} • ${formatWhen(item.created_at)}`,
      fit: item.fit_score ?? null,
    }));
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Proposal Analysis</h1>
        <p className={styles.subtitle}>
          Live analytics from your Firestore data
        </p>
      </header>

      <div className={styles.metricsGrid}>
        <ScoreCard
          title="Total Proposals"
          score={analytics?.total_proposals || 0}
          message="All proposals created in your workspace."
        />
        <ScoreCard
          title="Average Score"
          score={clampPercent(analytics?.avg_score || 0)}
          message="Based on available proposal score signals."
        />
        <ScoreCard
          title="Positive Feedback Rate"
          score={clampPercent(analytics?.feedback_positive_rate || 0)}
          message={`${analytics?.total_feedback || 0} feedback entries received.`}
          isPercentage
        />
      </div>

      <div className={styles.breakdownGrid}>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Proposal Status Distribution</h3>
          <KeywordCoverageChart data={getStatusCoverageData()} />
        </div>
      </div>

      <div className={styles.suggestionsCard}>
        <h3 className={styles.chartTitle}>Recent Activity</h3>
        {getRecentActivityRows().length ? (
          <div className={styles.activityList}>
            {getRecentActivityRows().map((row) => (
              <div key={row.id + row.meta} className={styles.activityItem}>
                <p className={styles.activityTitle}>{row.title}</p>
                <p className={styles.activityMeta}>
                  {row.meta}
                  {row.fit !== null ? ` • fit ${row.fit}` : ""}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.emptyText}>No recent activity yet.</p>
        )}
      </div>
    </div>
  );
}
