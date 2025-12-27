'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import styles from './Login.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password, rememberMe);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Failed to log in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      await loginWithGoogle(rememberMe);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Left Side - Login Form */}
      <div className={styles.leftSide}>
        <div className={styles.formContainer}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>P</div>
            <span className={styles.logoText}>Proposal Optimizer</span>
          </div>

          <h1 className={styles.title}>Sign in</h1>

          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>
                Email Address
              </label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>✉</span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  required
                  placeholder="Johndoe@gmail.com"
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password" className={styles.label}>
                Password
              </label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>🔒</span>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                  required
                  placeholder="••••••"
                />
              </div>
            </div>

            <div className={styles.rememberMe}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className={styles.checkbox}
                />
                <span>Remember me</span>
              </label>
            </div>

            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className={styles.footerLinks}>
            <p>
              Don't have an account?{' '}
              <a href="/signup" className={styles.link}>
                Sign up
              </a>
            </p>
            <a href="#" className={styles.forgotLink}>
              Forgot Password
            </a>
          </div>

          <div className={styles.divider}>
            <span>Or continue with</span>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className={styles.googleButton}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              'Signing in...'
            ) : (
              <>
                <svg className={styles.googleIcon} viewBox="0 0 24 24" width="20" height="20">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Google</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Side - Welcome Content */}
      <div className={styles.rightSide}>
        <div className={styles.welcomeContent}>
          <div className={styles.welcomeLogo}>
            <div className={styles.welcomeLogoIcon}>P</div>
          </div>
          <h2 className={styles.welcomeTitle}>Welcome to Proposal Optimizer</h2>
          <p className={styles.welcomeText}>
            Proposal Optimizer helps freelancers to build compelling and professional Upwork proposals 
            using AI. Join us and start winning more projects today.
          </p>
          <p className={styles.welcomeStats}>More than 1k freelancers joined us, it's your turn</p>

          <div className={styles.featureCard}>
            <div className={styles.featureContent}>
              <h3 className={styles.featureTitle}>Get your right job and right place apply now</h3>
              <p className={styles.featureText}>
                Be among the first freelancers to experience the easiest way to create winning proposals.
              </p>
            </div>
            <div className={styles.avatars}>
              <div className={styles.avatar}>👤</div>
              <div className={styles.avatar}>👤</div>
              <div className={styles.avatar}>👤</div>
              <div className={styles.avatarMore}>+2</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
