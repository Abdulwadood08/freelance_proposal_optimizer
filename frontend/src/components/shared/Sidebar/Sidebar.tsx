'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Sidebar.module.css';
import Button from '@/components/shared/Button/Button';

export default function Sidebar() {
  const pathname = usePathname();
  const { currentUser, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const navItems = [
    { href: '/', label: 'Dashboard', icon: '/dashboard.png' },
    { href: '/profile', label: 'Profile', icon: '/profile.png' },
    { href: '/generate', label: 'Generate Proposal', icon: '/generateproposal.png' },
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarContent}>
        <div className={styles.logo}>
          <h1>Proposal Optimizer</h1>
        </div>

        <nav className={styles.nav}>
          <ul className={styles.navList}>
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
                >
                  <span className={styles.icon}>
                    <img src={item.icon} alt="" className={styles.iconImage} />
                  </span>
                  <span className={styles.label}>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.footer}>
          {currentUser && (
            <div className={styles.userInfo}>
              <div className={styles.userEmail}>{currentUser.email}</div>
            </div>
          )}
          <Button variant="secondary" onClick={handleLogout} className={styles.logoutBtn}>
            <span>Logout</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}

