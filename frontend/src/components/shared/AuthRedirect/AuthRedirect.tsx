'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface AuthRedirectProps {
  children: React.ReactNode;
  redirectTo?: string;
  requireAuth?: boolean;
}

export default function AuthRedirect({ 
  children, 
  redirectTo = '/login',
  requireAuth = true 
}: AuthRedirectProps) {
  const { currentUser, loading, isRemembered } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (requireAuth && !currentUser) {
        router.push(redirectTo);
      }
    }
  }, [currentUser, loading, requireAuth, redirectTo, router]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh' 
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (requireAuth && !currentUser) {
    return null;
  }

  return <>{children}</>;
}

