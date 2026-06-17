'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Navigation.module.css';
import Button from '@/components/shared/Button/Button';

export default function Navigation() {
  const pathname = usePathname();
  const { currentUser, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  return (
    <nav className={styles.nav}>
      <div className={styles.navContent}>
        <Link href="/" className={styles.logo}>
          Proposal Optimizer
        </Link>
        <ul className={styles.navLinks}>
          <li>
            <Link href="/" className={pathname === '/' ? styles.active : ''}>
              Dashboard
            </Link>
          </li>
          {currentUser ? (
            <>
              <li>
                <Link href="/profile" className={pathname === '/profile' ? styles.active : ''}>
                  Profile
                </Link>
              </li>
              <li>
                <Link href="/generate" className={pathname === '/generate' ? styles.active : ''}>
                  Generate Proposal
                </Link>
              </li>
              <li className={styles.userInfo}>
                <span className={styles.userEmail}>{currentUser.email}</span>
                <Button variant="secondary" onClick={handleLogout} className={styles.logoutBtn}>
                  Logout
                </Button>
              </li>
            </>
          ) : (
            <>
              <li>
                <Link href="/login" className={pathname === '/login' ? styles.active : ''}>
                  Login
                </Link>
              </li>
              <li>
                <Link href="/signup" className={pathname === '/signup' ? styles.active : ''}>
                  Sign Up
                </Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
}

