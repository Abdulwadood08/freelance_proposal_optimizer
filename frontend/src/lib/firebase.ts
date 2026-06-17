import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  };
}

function isFirebaseConfigured(): boolean {
  const config = getFirebaseConfig();
  return Boolean(config.apiKey && config.projectId);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function initFirebase(): FirebaseApp {
  if (app) return app;

  if (typeof window === "undefined") {
    throw new Error("Firebase can only be initialized in the browser.");
  }

  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* environment variables.",
    );
  }

  app = getApps().length === 0 ? initializeApp(getFirebaseConfig()) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  return app;
}

/** Lazy Firebase Auth — safe for static export builds (no init at import time). */
export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  initFirebase();
  return auth!;
}

/** Lazy Firestore client. */
export function getFirebaseDb(): Firestore {
  if (db) return db;
  initFirebase();
  return db!;
}

export function isFirebaseReady(): boolean {
  return isFirebaseConfigured();
}

export default function getFirebaseApp(): FirebaseApp {
  return initFirebase();
}
