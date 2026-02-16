'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getUser, getUserProposals, getProposalCount, getProposalAnalytics, type User, type ProposalAnalytics } from '@/lib/api';
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
} from 'recharts';
import styles from './Dashboard.module.css';

const DocIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.kpiIcon}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

const ChartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.kpiIcon}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const TargetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.kpiIcon}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const LightningIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.kpiIcon}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const activityData = [
  { month: 'Jan', value: 12, value2: 8 },
  { month: 'Feb', value: 15, value2: 10 },
  { month: 'Mar', value: 18, value2: 14 },
  { month: 'Apr', value: 22, value2: 18 },
  { month: 'May', value: 28, value2: 24 },
  { month: 'Jun', value: 36, value2: 30 },
];

const categoryData = [
  { name: 'Web Dev', value: 85 },
  { name: 'Mobile', value: 70 },
  { name: 'UI/UX', value: 90 },
  { name: 'Backend', value: 78 },
  { name: 'DevOps', value: 65 },
];

export default function Dashboard() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [proposalCount, setProposalCount] = useState(0);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [analytics, setAnalytics] = useState<ProposalAnalytics | null>(null);

  useEffect(() => {
    if (currentUser) loadDashboardData();
  }, [currentUser]);

  const loadDashboardData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      try {
        const userData = await getUser(currentUser.uid, currentUser);
        setUser(userData);
        calculateProfileCompletion(userData);
      } catch {
        setUser(null);
      }
      try {
        const { count } = await getProposalCount(currentUser.uid, currentUser);
        setProposalCount(count);
      } catch {
        setProposalCount(0);
      }
      try {
        const data = await getProposalAnalytics(currentUser.uid, currentUser);
        setAnalytics(data);
      } catch {
        setAnalytics(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateProfileCompletion = (userData: User) => {
    let completed = 0;
    const total = 5;
    if (userData.name) completed++;
    if (userData.skills?.length) completed++;
    if (userData.resume_url) completed++;
    if (userData.case_studies?.length) completed++;
    if (userData.upwork_profile) completed++;
    setProfileCompletion(Math.round((completed / total) * 100));
  };

  const winRate = analytics && analytics.sent_count > 0 ? Math.round(analytics.win_rate) : 68;
  const profileScore = Math.min(92, profileCompletion + 5);

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
        <p className={styles.subtitle}>Welcome back! Here&apos;s your proposal performance overview.</p>
      </header>

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={`${styles.kpiIconWrap} ${styles.kpiPurple}`}>
              <DocIcon />
            </span>
            <span className={styles.kpiChange}>+12%</span>
          </div>
          <p className={styles.kpiLabel}>Proposals Generated</p>
          <p className={styles.kpiValue}>{proposalCount}</p>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={`${styles.kpiIconWrap} ${styles.kpiBlue}`}>
              <ChartIcon />
            </span>
            <span className={styles.kpiChange}>+8%</span>
          </div>
          <p className={styles.kpiLabel}>Estimated Win Rate</p>
          <p className={styles.kpiValue}>{winRate}%</p>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={`${styles.kpiIconWrap} ${styles.kpiGreen}`}>
              <TargetIcon />
            </span>
            <span className={styles.kpiChange}>+5</span>
          </div>
          <p className={styles.kpiLabel}>Profile Strength</p>
          <p className={styles.kpiValue}>{profileScore}/100</p>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={`${styles.kpiIconWrap} ${styles.kpiOrange}`}>
              <LightningIcon />
            </span>
            <span className={styles.kpiBadge}>New</span>
          </div>
          <p className={styles.kpiLabel}>AI Suggestions</p>
          <p className={styles.kpiValue}>3</p>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Proposal Activity</h2>
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={activityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaPurple" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8a2be2" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#8a2be2" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="areaBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4169e1" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#4169e1" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--dashboard-subtitle)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--dashboard-subtitle)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 40]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'var(--dashboard-title)' }}
                />
                <Area type="monotone" dataKey="value2" stroke="#4169e1" fill="url(#areaBlue)" strokeWidth={2} />
                <Area type="monotone" dataKey="value" stroke="#8a2be2" fill="url(#areaPurple)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Performance by Category</h2>
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={categoryData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#4169e1" />
                    <stop offset="100%" stopColor="#8a2be2" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--dashboard-subtitle)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis type="number" domain={[0, 100]} stroke="var(--dashboard-subtitle)" fontSize={12} tickLine={false} axisLine={false} />
                <Bar dataKey="value" fill="url(#barGradient)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={styles.quickSection}>
        <div className={styles.quickCard}>
          <h3 className={styles.quickTitle}>Recent activity</h3>
          <p className={styles.quickText}>Generate your next proposal or view history.</p>
          <Link href="/generate" className={styles.quickLink}>
            Generate Proposal →
          </Link>
        </div>
        {!user && (
          <div className={styles.quickCard}>
            <h3 className={styles.quickTitle}>Complete your profile</h3>
            <p className={styles.quickText}>Add skills and case studies to improve proposal quality.</p>
            <Link href="/profile" className={styles.quickLink}>
              My Profile →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
