'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getUser, getUserProposals, getProposalCount, updateProposalStatus, getProposalAnalytics, type User, type Proposal, type ProposalAnalytics } from '@/lib/api';
import styles from './Dashboard.module.css';
import Card from '@/components/shared/Card/Card';
import Button from '@/components/shared/Button/Button';

export default function Dashboard() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [proposalCount, setProposalCount] = useState(0);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [analytics, setAnalytics] = useState<ProposalAnalytics | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      loadDashboardData();
    }
  }, [currentUser]);

  const loadDashboardData = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      // Load user profile
      try {
        const userData = await getUser(currentUser.uid, currentUser);
        setUser(userData);
        calculateProfileCompletion(userData);
      } catch {
        // User doesn't have a profile yet
        setUser(null);
      }

      // Load proposals
      try {
        const proposalsData = await getUserProposals(currentUser.uid, currentUser, 5);
        setProposals(proposalsData.proposals);
        setProposalCount(proposalsData.count);
      } catch {
        // No proposals yet or error
        setProposals([]);
        setProposalCount(0);
      }

      // Load proposal count
      try {
        const countData = await getProposalCount(currentUser.uid, currentUser);
        setProposalCount(countData.count);
      } catch {
        // Error loading count
      }

      // Load analytics
      try {
        const analyticsData = await getProposalAnalytics(currentUser.uid, currentUser);
        setAnalytics(analyticsData);
      } catch {
        // Error loading analytics
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateProfileCompletion = (userData: User) => {
    let completed = 0;
    let total = 5;

    if (userData.name) completed++;
    if (userData.skills && userData.skills.length > 0) completed++;
    if (userData.resume_url) completed++;
    if (userData.case_studies && userData.case_studies.length > 0) completed++;
    if (userData.upwork_profile) completed++;

    setProfileCompletion(Math.round((completed / total) * 100));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getThisMonthCount = () => {
    const now = new Date();
    const thisMonth = proposals.filter(p => {
      const proposalDate = new Date(p.created_at);
      return proposalDate.getMonth() === now.getMonth() && 
             proposalDate.getFullYear() === now.getFullYear();
    });
    return thisMonth.length;
  };

  const getLastGenerated = () => {
    if (proposals.length === 0) return 'Never';
    return formatDate(proposals[0].created_at);
  };

  const handleStatusUpdate = async (proposalId: string, status: 'sent' | 'won' | 'lost') => {
    if (!currentUser) return;
    
    setUpdatingStatus(proposalId);
    try {
      await updateProposalStatus(proposalId, currentUser.uid, status, currentUser);
      
      // Update local state
      setProposals(proposals.map(p => 
        p.id === proposalId ? { ...p, status } : p
      ));
      
      // Reload analytics
      const analyticsData = await getProposalAnalytics(currentUser.uid, currentUser);
      setAnalytics(analyticsData);
    } catch (error: any) {
      alert(`Failed to update status: ${error.message}`);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status || status === 'draft') return null;
    
    const statusConfig = {
      sent: { label: 'Sent', color: 'var(--primary-color)', bg: 'rgba(37, 99, 235, 0.1)' },
      won: { label: 'Won', color: 'var(--success-color)', bg: 'rgba(16, 185, 129, 0.1)' },
      lost: { label: 'Lost', color: 'var(--error-color)', bg: 'rgba(239, 68, 68, 0.1)' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;
    
    return (
      <span 
        className={styles.statusBadge}
        style={{ color: config.color, backgroundColor: config.bg }}
      >
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div>Loading...</div>
      </div>
    );
  }

  const userName = user?.name || currentUser?.email?.split('@')[0] || 'User';

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div>
            <h1 className={styles.welcomeTitle}>Hello, {userName}!</h1>
            <p className={styles.welcomeSubtitle}>
              Welcome back! Here's an overview of your proposals and profile.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <Card className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statIcon} style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary-color)' }}>
              📄
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statLabel}>Total Proposals</p>
              <p className={styles.statValue}>{proposalCount}</p>
            </div>
          </div>
        </Card>

        <Card className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statIcon} style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)' }}>
              ✓
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statLabel}>Profile Completion</p>
              <p className={styles.statValue}>{profileCompletion}%</p>
            </div>
          </div>
        </Card>

        <Card className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statIcon} style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--error-color)' }}>
              📅
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statLabel}>This Month</p>
              <p className={styles.statValue}>{getThisMonthCount()}</p>
            </div>
          </div>
        </Card>

        <Card className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statIcon} style={{ backgroundColor: 'rgba(100, 116, 139, 0.1)', color: 'var(--secondary-color)' }}>
              ⏰
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statLabel}>Last Generated</p>
              <p className={styles.statValue}>{getLastGenerated()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className={styles.contentGrid}>
        {/* Recent Proposals */}
        <Card className={styles.proposalsCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Recent Proposals</h2>
            {proposals.length > 0 && (
              <Link href="/generate" className={styles.viewAllLink}>
                View All →
              </Link>
            )}
          </div>
          
          {proposals.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📝</div>
              <p className={styles.emptyText}>No proposals generated yet</p>
              <p className={styles.emptySubtext}>Start creating your first proposal!</p>
              <Link href="/generate">
                <Button variant="primary" className={styles.emptyButton}>
                  Generate Your First Proposal
                </Button>
              </Link>
            </div>
          ) : (
            <div className={styles.proposalsList}>
              {proposals.map((proposal) => (
                <div key={proposal.id} className={styles.proposalItem}>
                  <div className={styles.proposalContent}>
                    <div className={styles.proposalHeader}>
                      <h3 className={styles.proposalTitle}>
                        {proposal.job_post.substring(0, 60)}...
                      </h3>
                      {getStatusBadge(proposal.status)}
                    </div>
                    <p className={styles.proposalDate}>
                      Generated {formatDate(proposal.created_at)}
                    </p>
                  </div>
                  <div className={styles.proposalActions}>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(proposal.proposal);
                        alert('Proposal copied to clipboard!');
                      }}
                      className={styles.copyButton}
                    >
                      Copy
                    </Button>
                    {proposal.status !== 'sent' && proposal.status !== 'won' && proposal.status !== 'lost' && (
                      <Button
                        variant="secondary"
                        onClick={() => handleStatusUpdate(proposal.id, 'sent')}
                        className={styles.statusButton}
                        disabled={updatingStatus === proposal.id}
                      >
                        ✓ Mark as Sent
                      </Button>
                    )}
                    {proposal.status === 'sent' && (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => handleStatusUpdate(proposal.id, 'won')}
                          className={styles.statusButton}
                          disabled={updatingStatus === proposal.id}
                          style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)' }}
                        >
                          🎉 Won
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => handleStatusUpdate(proposal.id, 'lost')}
                          className={styles.statusButton}
                          disabled={updatingStatus === proposal.id}
                          style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--error-color)' }}
                        >
                          ✗ Lost
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Profile Status */}
        <Card className={styles.profileCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Profile Status</h2>
          </div>
          
          {!user ? (
            <div className={styles.profileStatus}>
              <div className={styles.profileProgress}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: '0%' }}></div>
                </div>
                <p className={styles.progressText}>0% Complete</p>
              </div>
              <p className={styles.profileMessage}>
                Create your profile to start generating personalized proposals
              </p>
              <Link href="/profile">
                <Button variant="primary" className={styles.profileButton}>
                  Create Profile
                </Button>
              </Link>
            </div>
          ) : (
            <div className={styles.profileStatus}>
              <div className={styles.profileProgress}>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${profileCompletion}%` }}
                  ></div>
                </div>
                <p className={styles.progressText}>{profileCompletion}% Complete</p>
              </div>
              
              <div className={styles.profileDetails}>
                <div className={styles.profileDetailItem}>
                  <span className={styles.detailLabel}>Name:</span>
                  <span className={styles.detailValue}>{user.name || 'Not set'}</span>
                </div>
                <div className={styles.profileDetailItem}>
                  <span className={styles.detailLabel}>Skills:</span>
                  <span className={styles.detailValue}>
                    {user.skills?.length || 0} skills added
                  </span>
                </div>
                <div className={styles.profileDetailItem}>
                  <span className={styles.detailLabel}>Case Studies:</span>
                  <span className={styles.detailValue}>
                    {user.case_studies?.length || 0} added
                  </span>
                </div>
              </div>

              {profileCompletion < 100 && (
                <Link href="/profile">
                  <Button variant="secondary" className={styles.profileButton}>
                    Complete Profile
                  </Button>
                </Link>
              )}
            </div>
          )}
        </Card>

        {/* Analytics Dashboard */}
        {analytics && analytics.total_proposals > 0 && (
          <Card className={styles.analyticsCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Proposal Analytics</h2>
            </div>
            <div className={styles.analyticsGrid}>
              <div className={styles.analyticsItem}>
                <div className={styles.analyticsLabel}>Win Rate</div>
                <div className={styles.analyticsValue} style={{ color: 'var(--success-color)' }}>
                  {analytics.win_rate}%
                </div>
                <div className={styles.analyticsSubtext}>
                  {analytics.won_count} won / {analytics.sent_count} sent
                </div>
              </div>
              <div className={styles.analyticsItem}>
                <div className={styles.analyticsLabel}>Response Rate</div>
                <div className={styles.analyticsValue} style={{ color: 'var(--primary-color)' }}>
                  {analytics.response_rate}%
                </div>
                <div className={styles.analyticsSubtext}>
                  {analytics.won_count + analytics.lost_count} responses
                </div>
              </div>
              <div className={styles.analyticsItem}>
                <div className={styles.analyticsLabel}>Total Proposals</div>
                <div className={styles.analyticsValue}>{analytics.total_proposals}</div>
                <div className={styles.analyticsSubtext}>
                  {analytics.status_counts.draft} draft, {analytics.status_counts.sent} sent
                </div>
              </div>
              <div className={styles.analyticsItem}>
                <div className={styles.analyticsLabel}>Status Breakdown</div>
                <div className={styles.statusBreakdown}>
                  <span className={styles.statusItem}>
                    <span className={styles.statusDot} style={{ backgroundColor: 'var(--primary-color)' }}></span>
                    Sent: {analytics.status_counts.sent}
                  </span>
                  <span className={styles.statusItem}>
                    <span className={styles.statusDot} style={{ backgroundColor: 'var(--success-color)' }}></span>
                    Won: {analytics.status_counts.won}
                  </span>
                  <span className={styles.statusItem}>
                    <span className={styles.statusDot} style={{ backgroundColor: 'var(--error-color)' }}></span>
                    Lost: {analytics.status_counts.lost}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className={styles.actionsCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Quick Actions</h2>
          </div>
          <div className={styles.actionsList}>
            <Link href="/generate" className={styles.actionItem}>
              <div className={styles.actionIcon}>✨</div>
              <div className={styles.actionContent}>
                <h3 className={styles.actionTitle}>Generate Proposal</h3>
                <p className={styles.actionDescription}>Create a new tailored proposal</p>
              </div>
              <div className={styles.actionArrow}>→</div>
            </Link>
            
            <Link href="/profile" className={styles.actionItem}>
              <div className={styles.actionIcon}>👤</div>
              <div className={styles.actionContent}>
                <h3 className={styles.actionTitle}>Edit Profile</h3>
                <p className={styles.actionDescription}>Update your skills and information</p>
              </div>
              <div className={styles.actionArrow}>→</div>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
