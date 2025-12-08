'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Navigation.module.css';

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav}>
      <div className={styles.navContent}>
        <Link href="/" className={styles.logo}>
          Proposal Optimizer
        </Link>
        <ul className={styles.navLinks}>
          <li>
            <Link href="/" className={pathname === '/' ? styles.active : ''}>
              Home
            </Link>
          </li>
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
        </ul>
      </div>
    </nav>
  );
}

