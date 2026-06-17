'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AuthScreen from '@/components/auth/AuthScreen/AuthScreen';

export default function SignupPage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && currentUser) {
      router.push('/');
    }
  }, [currentUser, loading, router]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #1a1b2e 0%, #16213e 50%, #0f3460 100%)',
        color: '#fff',
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (currentUser) {
    return null;
  }

  return <AuthScreen initialMode="signup" />;
}


