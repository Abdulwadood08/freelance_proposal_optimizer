"use client";

import { useEffect } from "react";
import styles from "./AppToast.module.css";

export type ToastMessage = {
  type: "success" | "error";
  text: string;
} | null;

const ToastCheckIcon = () => (
  <svg viewBox="0 0 24 24" className={styles.toastGlyph} aria-hidden>
    <path
      fill="currentColor"
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.29 14.29L6.7 12l1.41-1.41 2.59 2.59 6.59-6.59L18.3 8l-7.59 7.59z"
    />
  </svg>
);

const ToastAlertIcon = () => (
  <svg viewBox="0 0 24 24" className={styles.toastGlyph} aria-hidden>
    <path
      fill="currentColor"
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
    />
  </svg>
);

/** Auto-dismiss toast after delay (matches profile defaults). */
export function useToastAutoDismiss(
  message: ToastMessage,
  setMessage: (v: ToastMessage) => void,
  successMs = 4800,
  errorMs = 9000,
) {
  useEffect(() => {
    if (!message) return;
    const ms = message.type === "success" ? successMs : errorMs;
    const id = window.setTimeout(() => setMessage(null), ms);
    return () => window.clearTimeout(id);
  }, [message, setMessage, successMs, errorMs]);
}

export default function AppToast({
  message,
  onDismiss,
}: {
  message: ToastMessage;
  onDismiss: () => void;
}) {
  if (!message) return null;

  return (
    <div className={styles.toastViewport}>
      <div
        role={message.type === "error" ? "alert" : "status"}
        className={`${styles.toast} ${message.type === "success" ? styles.toastSuccess : styles.toastError}`}
      >
        <div className={styles.toastBody}>
          {message.type === "success" ? (
            <ToastCheckIcon />
          ) : (
            <ToastAlertIcon />
          )}
          <p className={styles.toastMessage}>{message.text}</p>
        </div>
        <button
          type="button"
          className={styles.toastDismiss}
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}
