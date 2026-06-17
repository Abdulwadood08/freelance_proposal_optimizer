"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUser,
  getProposalCount,
  getProposalAnalytics,
  getUserProposals,
  type User,
  type ProposalAnalytics,
} from "@/lib/api";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import styles from "./Dashboard.module.css";

const DocIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={styles.kpiIcon}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

const ChartIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={styles.kpiIcon}
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const TargetIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={styles.kpiIcon}
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const StarIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={styles.kpiIcon}
  >
    <polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9 12 2" />
  </svg>
);

function formatShortDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

function formatMomPercent(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}%`;
}

function formatWonDelta(delta: number | null | undefined): string {
  if (delta === null || delta === undefined) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} wins`;
}

type DashboardRecentRow = NonNullable<
  ProposalAnalytics["recent_activity"]
>[number];

export default function Dashboard() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [proposalCount, setProposalCount] = useState(0);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [analytics, setAnalytics] = useState<ProposalAnalytics | null>(null);
  const [recentFallback, setRecentFallback] = useState<DashboardRecentRow[]>(
    [],
  );

  const loadDashboardData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      await Promise.all([
        getUser(currentUser.uid, currentUser)
          .then((userData) => {
            setUser(userData);
            let completed = 0;
            const total = 5;
            if (userData.name) completed++;
            if (userData.skills?.length) completed++;
            if (userData.resume_url) completed++;
            if (userData.case_studies?.length) completed++;
            if (userData.upwork_profile) completed++;
            setProfileCompletion(Math.round((completed / total) * 100));
          })
          .catch(() => {
            setUser(null);
          }),
        getProposalAnalytics(currentUser.uid, currentUser)
          .then((data) => {
            setAnalytics(data);
            setProposalCount(data.total_proposals ?? 0);
            setRecentFallback([]);
          })
          .catch(async () => {
            setAnalytics(null);
            try {
              const { count } = await getProposalCount(
                currentUser.uid,
                currentUser,
              );
              setProposalCount(count);
            } catch {
              setProposalCount(0);
            }
            try {
              const res = await getUserProposals(
                currentUser.uid,
                currentUser,
                8,
              );
              setRecentFallback(
                res.proposals.map((p) => ({
                  proposal_id: p.id,
                  status: p.status ?? "draft",
                  created_at: p.created_at,
                  source: "web",
                  fit_score: undefined,
                })),
              );
            } catch {
              setRecentFallback([]);
            }
          }),
      ]);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) loadDashboardData();
  }, [currentUser, loadDashboardData]);

  const activityChartData = useMemo(
    () => analytics?.monthly_activity ?? [],
    [analytics?.monthly_activity],
  );

  const statusChartData = useMemo(() => {
    const sc = analytics?.status_counts;
    if (!sc) return [];
    const order = ["draft", "sent", "won", "lost"] as const;
    return order.map((key) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      count: sc[key] ?? 0,
    }));
  }, [analytics?.status_counts]);

  const activityMax = useMemo(() => {
    let m = 4;
    for (const row of activityChartData) {
      m = Math.max(m, row.generated ?? 0, row.won ?? 0);
    }
    return Math.ceil(m * 1.15);
  }, [activityChartData]);

  const statusMax = useMemo(() => {
    const counts = statusChartData.map((d) => d.count);
    const high = counts.length ? Math.max(...counts) : 0;
    return Math.max(4, Math.ceil(high * 1.15));
  }, [statusChartData]);

  const winRateRounded =
    analytics && analytics.total_proposals > 0
      ? Math.round(analytics.win_rate)
      : null;

  const genMom = analytics?.mom_generated_pct;
  const genMomClass =
    genMom === null || genMom === undefined
      ? styles.kpiChangeMuted
      : genMom >= 0
        ? styles.kpiChange
        : styles.kpiChangeNegative;

  const wonMom = analytics?.mom_won_delta;
  const wonMomClass =
    wonMom === null || wonMom === undefined
      ? styles.kpiChangeMuted
      : wonMom >= 0
        ? styles.kpiChange
        : styles.kpiChangeNegative;

  const scoreSample = analytics?.score_sample_size ?? 0;
  const avgScoreRounded =
    scoreSample > 0 ? Math.round(analytics?.avg_score ?? 0) : null;

  const profileChip =
    profileCompletion >= 100 ? "Complete" : `${100 - profileCompletion} to go`;

  const recentPreview = useMemo(() => {
    const fromAnalytics = analytics?.recent_activity;
    if (fromAnalytics?.length) return fromAnalytics.slice(0, 4);
    return recentFallback.slice(0, 4);
  }, [analytics?.recent_activity, recentFallback]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>
          Welcome back! Here&apos;s your proposal performance overview.
        </p>
      </header>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={`${styles.kpiIconWrap} ${styles.kpiPurple}`}>
              <DocIcon />
            </span>
            <span className={genMomClass}>{formatMomPercent(genMom)}</span>
          </div>
          <p className={styles.kpiHint}>vs prior month</p>
          <p className={styles.kpiLabel}>Proposals Generated</p>
          <p className={styles.kpiValue}>{proposalCount}</p>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={`${styles.kpiIconWrap} ${styles.kpiBlue}`}>
              <ChartIcon />
            </span>
            <span className={wonMomClass}>{formatWonDelta(wonMom)}</span>
          </div>
          <p className={styles.kpiHint}>month over month</p>
          <p className={styles.kpiLabel}>Win rate</p>
          <p className={styles.kpiValue}>
            {winRateRounded !== null ? `${winRateRounded}%` : "—"}
          </p>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={`${styles.kpiIconWrap} ${styles.kpiGreen}`}>
              <TargetIcon />
            </span>
            <span className={styles.kpiChangeMuted}>{profileChip}</span>
          </div>
          <p className={styles.kpiHint}>profile checklist</p>
          <p className={styles.kpiLabel}>Profile Completion</p>
          <p className={styles.kpiValue}>{profileCompletion}/100</p>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={`${styles.kpiIconWrap} ${styles.kpiOrange}`}>
              <StarIcon />
            </span>
            <span className={styles.kpiChangeMuted}>
              {scoreSample > 0 ? `${scoreSample} scored` : "No scores yet"}
            </span>
          </div>
          <p className={styles.kpiHint}>from saved proposals</p>
          <p className={styles.kpiLabel}>Avg. proposal score</p>
          <p className={styles.kpiValue}>
            {avgScoreRounded !== null ? avgScoreRounded : "—"}
          </p>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Proposal activity</h2>
          <p className={styles.chartSubtitle}>
            Created vs won — last 12 months (UTC)
          </p>
          <div className={styles.chartWrap}>
            {activityChartData.length === 0 ? (
              <p className={styles.chartEmpty}>
                No monthly activity breakdown available yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart
                  data={activityChartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="areaPurple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8a2be2" stopOpacity={0.9} />
                      <stop
                        offset="100%"
                        stopColor="#8a2be2"
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                    <linearGradient id="areaBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4169e1" stopOpacity={0.8} />
                      <stop
                        offset="100%"
                        stopColor="#4169e1"
                        stopOpacity={0.1}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--chart-grid)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    stroke="var(--dashboard-subtitle)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={52}
                  />
                  <YAxis
                    stroke="var(--dashboard-subtitle)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, activityMax]}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card-bg)",
                      border: "1px solid var(--card-border)",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "var(--dashboard-title)" }}
                    formatter={(value, name) => [
                      value ?? 0,
                      name === "generated" ? "Created" : "Won",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="won"
                    name="won"
                    stroke="#4169e1"
                    fill="url(#areaBlue)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="generated"
                    name="generated"
                    stroke="#8a2be2"
                    fill="url(#areaPurple)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Proposals by status</h2>
          <p className={styles.chartSubtitle}>
            All-time counts in your workspace
          </p>
          <div className={styles.chartWrap}>
            {statusChartData.length === 0 ? (
              <p className={styles.chartEmpty}>No analytics loaded yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={statusChartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="barGradient"
                      x1="0"
                      y1="1"
                      x2="0"
                      y2="0"
                    >
                      <stop offset="0%" stopColor="#4169e1" />
                      <stop offset="100%" stopColor="#8a2be2" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--chart-grid)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="var(--dashboard-subtitle)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="number"
                    domain={[0, statusMax]}
                    stroke="var(--dashboard-subtitle)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card-bg)",
                      border: "1px solid var(--card-border)",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "var(--dashboard-title)" }}
                    formatter={(value) => [`${value ?? 0}`, "Proposals"]}
                  />
                  <Bar
                    dataKey="count"
                    fill="url(#barGradient)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className={styles.quickSection}>
        <div className={styles.quickCard}>
          <h3 className={styles.quickTitle}>Recent activity</h3>
          {recentPreview.length > 0 ? (
            <ul className={styles.recentList}>
              {recentPreview.map((item) => (
                <li
                  key={item.proposal_id ?? `${item.status}-${item.created_at}`}
                >
                  <span className={styles.recentStatus}>
                    {(item.status || "draft").toUpperCase()}
                  </span>
                  <span className={styles.recentMeta}>
                    {item.source ?? "web"}
                    {item.created_at
                      ? ` • ${formatShortDate(item.created_at)}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.quickText}>
              {proposalCount > 0
                ? "Recent proposals couldn't be loaded from analytics — charts may also be unavailable. Refresh or check the API logs."
                : "No proposals yet. Generate one to see activity here."}
            </p>
          )}
          <div className={styles.quickLinks}>
            <Link href="/generate" className={styles.quickLink}>
              Generate Proposal →
            </Link>
            <Link href="/history" className={styles.quickLink}>
              Proposal History →
            </Link>
          </div>
        </div>
        {!user && (
          <div className={styles.quickCard}>
            <h3 className={styles.quickTitle}>Complete your profile</h3>
            <p className={styles.quickText}>
              Add skills and case studies to improve proposal quality.
            </p>
            <Link href="/profile" className={styles.quickLink}>
              My Profile →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
