'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onIdTokenChanged,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signup: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  loginWithGoogle: (rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  isRemembered: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

const REMEMBER_ME_KEY = 'rememberMe';
const REMEMBERED_EMAIL_KEY = 'rememberedEmail';
const EXTENSION_TOKEN_KEY = 'fpo_extension_token';

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRemembered, setIsRemembered] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const remembered = localStorage.getItem(REMEMBER_ME_KEY) === 'true';
      setIsRemembered(remembered);
    }
  }, []);

  async function signup(email: string, password: string): Promise<void> {
    await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  }

  async function login(
    email: string,
    password: string,
    rememberMe: boolean = false,
  ): Promise<void> {
    if (rememberMe && typeof window !== 'undefined') {
      localStorage.setItem(REMEMBER_ME_KEY, 'true');
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem(REMEMBER_ME_KEY);
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
    setIsRemembered(rememberMe);
    await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  }

  async function loginWithGoogle(rememberMe: boolean = false): Promise<void> {
    const provider = new GoogleAuthProvider();
    if (rememberMe && typeof window !== 'undefined') {
      localStorage.setItem(REMEMBER_ME_KEY, 'true');
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem(REMEMBER_ME_KEY);
    }
    setIsRemembered(rememberMe);
    await signInWithPopup(getFirebaseAuth(), provider);
  }

  function logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(REMEMBER_ME_KEY);
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      localStorage.removeItem(EXTENSION_TOKEN_KEY);
      sessionStorage.removeItem(EXTENSION_TOKEN_KEY);
    }
    setIsRemembered(false);
    return signOut(getFirebaseAuth());
  }

  function resetPassword(email: string) {
    return sendPasswordResetEmail(getFirebaseAuth(), email);
  }

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      const auth = getFirebaseAuth();
      unsubscribe = onIdTokenChanged(auth, async (user) => {
        setCurrentUser(user);

        if (typeof window !== 'undefined') {
          if (user) {
            try {
              const token = await user.getIdToken();
              localStorage.setItem(EXTENSION_TOKEN_KEY, token);
              sessionStorage.setItem(EXTENSION_TOKEN_KEY, token);
            } catch {
              localStorage.removeItem(EXTENSION_TOKEN_KEY);
              sessionStorage.removeItem(EXTENSION_TOKEN_KEY);
            }
          } else {
            localStorage.removeItem(EXTENSION_TOKEN_KEY);
            sessionStorage.removeItem(EXTENSION_TOKEN_KEY);
          }
        }

        setLoading(false);
      });
    } catch (error) {
      console.error('Firebase auth listener failed:', error);
      setLoading(false);
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  const value: AuthContextType = {
    currentUser,
    loading,
    signup,
    login,
    loginWithGoogle,
    logout,
    resetPassword,
    isRemembered,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
