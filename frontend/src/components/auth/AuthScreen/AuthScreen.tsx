"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./AuthScreen.module.css";

const LogoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.logoIconSvg}>
    <path d="M12 2L14.5 8.5L21 9L16 13.5L17.5 20L12 17L6.5 20L8 13.5L3 9L9.5 8.5L12 2Z" />
  </svg>
);

const EmailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.inputIconSvg}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.inputIconSvg}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

type AuthMode = "login" | "signup";

interface AuthScreenProps {
  initialMode?: AuthMode;
}

export default function AuthScreen({ initialMode }: AuthScreenProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { login, signup, loginWithGoogle } = useAuth();

  const defaultMode: AuthMode = initialMode ?? (pathname?.includes("/signup") ? "signup" : "login");
  const [mode, setMode] = useState<AuthMode>(defaultMode);

  const setModeAndRoute = (newMode: AuthMode) => {
    setMode(newMode);
    if (newMode === "signup") router.replace("/signup");
    else router.replace("/login");
  };

  useEffect(() => {
    setMode(pathname?.includes("/signup") ? "signup" : "login");
  }, [pathname]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "signup") {
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password, false);
      } else {
        await signup(email, password);
      }
      router.push("/");
    } catch (err: unknown) {
      setError((err as Error).message || (mode === "login" ? "Failed to sign in" : "Failed to create account"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await loginWithGoogle(false);
      router.push("/");
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to sign in with Google");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.glowRight} aria-hidden />

      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoBox}>
            <LogoIcon />
          </div>
          <h1 className={styles.appName}>ProposalAI</h1>
          <p className={styles.tagline}>Win more freelance jobs with AI-powered proposals</p>
        </div>
      </header>

      <div className={styles.card}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${mode === "login" ? styles.tabActive : ""}`}
            onClick={() => setModeAndRoute("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={`${styles.tab} ${mode === "signup" ? styles.tabActive : ""}`}
            onClick={() => setModeAndRoute("signup")}
          >
            Sign Up
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="auth-email" className={styles.label}>
              Email
            </label>
            <div className={styles.inputWrapper}>
              <EmailIcon />
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                required
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="auth-password" className={styles.label}>
              Password
            </label>
            <div className={styles.inputWrapper}>
              <LockIcon />
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                required
                placeholder="••••••••"
                minLength={mode === "signup" ? 6 : undefined}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
          </div>

          {mode === "signup" && (
            <div className={styles.formGroup}>
              <label htmlFor="auth-confirm-password" className={styles.label}>
                Confirm Password
              </label>
              <div className={styles.inputWrapper}>
                <LockIcon />
                <input
                  id="auth-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={styles.input}
                  required
                  placeholder="••••••••"
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? (mode === "login" ? "Signing in..." : "Creating account...") : mode === "login" ? "Sign In" : "Sign Up"}
          </button>
        </form>

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
            "Signing in..."
          ) : (
            <>
              <svg className={styles.googleIcon} viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Google</span>
            </>
          )}
        </button>
      </div>

      <p className={styles.legal}>
        By continuing, you agree to our{" "}
        <a href="/terms" className={styles.legalLink}>
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy" className={styles.legalLink}>
          Privacy Policy
        </a>
      </p>
    </div>
  );
}
