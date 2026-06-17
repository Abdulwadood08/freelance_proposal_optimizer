'use client';

import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/shared/Sidebar/Sidebar';
import styles from './AuthenticatedLayout.module.css';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <>{children}</>;
  }

  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.mainContent}>{children}</main>
    </div>
  );
}

