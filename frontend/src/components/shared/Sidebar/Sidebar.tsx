'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Sidebar.module.css';

const LogoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.logoIconSvg}>
    <polygon points="12 2 15 9 22 9 17 14 18 22 12 18 6 22 7 14 2 9 9 9" />
  </svg>
);

const GridIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.navIconSvg}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const PersonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.navIconSvg}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const DocumentPenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.navIconSvg}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M12 18v-6" />
    <path d="M9 15h6" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.navIconSvg}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const BarChartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.navIconSvg}>
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.navIconSvg}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const navItems = [
  { href: '/', label: 'Dashboard', icon: GridIcon, exact: true },
  { href: '/profile', label: 'My Profile', icon: PersonIcon, exact: false },
  { href: '/generate', label: 'Generate Proposal', icon: DocumentPenIcon, exact: false },
  { href: '/generate', label: 'Proposal History', icon: ClockIcon, exact: false },
  { href: '/analytics', label: 'Analytics', icon: BarChartIcon, exact: false },
  { href: '/profile', label: 'Settings', icon: SettingsIcon, exact: false },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { currentUser, logout } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      <button
        type="button"
        className={styles.menuToggle}
        onClick={() => setMobileOpen((o) => !o)}
        aria-label="Toggle menu"
      >
        <span className={styles.menuToggleBar} />
        <span className={styles.menuToggleBar} />
        <span className={styles.menuToggleBar} />
      </button>

      {mobileOpen && (
        <div
          className={styles.overlay}
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarContent}>
          <div className={styles.logo}>
            <div className={styles.logoCircle}>
              <LogoIcon />
            </div>
            <div className={styles.logoText}>
              <span className={styles.logoTitle}>ProposalAI</span>
              <span className={styles.logoSubtitle}>Smart Proposals</span>
            </div>
          </div>

          <nav className={styles.nav}>
            <ul className={styles.navList}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href, item.exact);
                return (
                  <li key={`${item.href}-${item.label}`}>
                    <Link
                      href={item.href}
                      className={`${styles.navItem} ${active ? styles.active : ''}`}
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className={styles.icon}>
                        <Icon />
                      </span>
                      <span className={styles.label}>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className={styles.footer}>
            {currentUser && (
              <div className={styles.userEmail}>{currentUser.email}</div>
            )}
            <button type="button" onClick={handleLogout} className={styles.logoutBtn}>
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
