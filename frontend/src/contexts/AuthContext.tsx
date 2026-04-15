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
import { auth } from '@/lib/firebase';

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

  // Check if user should be remembered on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const remembered = localStorage.getItem(REMEMBER_ME_KEY) === 'true';
      setIsRemembered(remembered);
    }
  }, []);

  function signup(email: string, password: string) {
    return createUserWithEmailAndPassword(auth, email, password).then(() => {
      // User creation is handled automatically
    });
  }

  function login(email: string, password: string, rememberMe: boolean = false) {
    if (rememberMe && typeof window !== 'undefined') {
      localStorage.setItem(REMEMBER_ME_KEY, 'true');
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem(REMEMBER_ME_KEY);
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
    setIsRemembered(rememberMe);
    return signInWithEmailAndPassword(auth, email, password);
  }

  function loginWithGoogle(rememberMe: boolean = false) {
    const provider = new GoogleAuthProvider();
    if (rememberMe && typeof window !== 'undefined') {
      localStorage.setItem(REMEMBER_ME_KEY, 'true');
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem(REMEMBER_ME_KEY);
    }
    setIsRemembered(rememberMe);
    return signInWithPopup(auth, provider);
  }

  function logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(REMEMBER_ME_KEY);
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      localStorage.removeItem(EXTENSION_TOKEN_KEY);
      sessionStorage.removeItem(EXTENSION_TOKEN_KEY);
    }
    setIsRemembered(false);
    return signOut(auth);
  }

  function resetPassword(email: string) {
    return sendPasswordResetEmail(auth, email);
  }

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      setCurrentUser(user);

      // Keep a dedicated token key for the browser extension.
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

    return unsubscribe;
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


