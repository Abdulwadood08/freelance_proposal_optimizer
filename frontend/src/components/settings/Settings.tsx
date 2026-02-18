"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./Settings.module.css";

const PersonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.sectionIcon}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.sectionIcon}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export default function Settings() {
  const { currentUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [proposalAlerts, setProposalAlerts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (currentUser) {
      setEmail(currentUser.email || "");
      loadUserProfile();
    }
  }, [currentUser]);

  const loadUserProfile = async () => {
    if (!currentUser) return;
    try {
      const { getUser } = await import("@/lib/api");
      const user = await getUser(currentUser.uid, currentUser);
      setFullName(user.name || "");
      if (typeof user.email_notifications === "boolean") setEmailNotifications(user.email_notifications);
      if (typeof user.proposal_alerts === "boolean") setProposalAlerts(user.proposal_alerts);
    } catch (err) {
      // User profile might not exist yet
    }
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setLoading(true);
    setMessage(null);
    try {
      const { updateUser } = await import("@/lib/api");
      await updateUser(currentUser.uid, { name: fullName }, currentUser);
      setMessage({ type: "success", text: "Profile settings saved successfully!" });
    } catch (err: unknown) {
      setMessage({ type: "error", text: (err as Error).message || "Failed to save profile settings" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEmailNotifications = async (checked: boolean) => {
    setEmailNotifications(checked);
    if (!currentUser) return;
    try {
      const { updateUser } = await import("@/lib/api");
      await updateUser(currentUser.uid, { email_notifications: checked }, currentUser);
    } catch (err) {
      console.error("Failed to save preference", err);
    }
  };

  const handleToggleProposalAlerts = async (checked: boolean) => {
    setProposalAlerts(checked);
    if (!currentUser) return;
    try {
      const { updateUser } = await import("@/lib/api");
      await updateUser(currentUser.uid, { proposal_alerts: checked }, currentUser);
    } catch (err) {
      console.error("Failed to save preference", err);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your account preferences</p>
      </header>

      {message && (
        <div className={`${styles.message} ${message.type === "success" ? styles.messageSuccess : styles.messageError}`}>
          {message.text}
        </div>
      )}

      {/* Profile Settings Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <PersonIcon />
          <h2 className={styles.cardTitle}>Profile Settings</h2>
        </div>
        <div className={styles.cardContent}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Full Name</label>
            <input
              type="text"
              className={styles.input}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Email</label>
            <input
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              disabled
              aria-readonly
              style={{ cursor: "not-allowed" }}
            />
            <small className={styles.helpText}>Email is managed by your account</small>
          </div>
          <button
            type="button"
            className={styles.saveButton}
            onClick={handleSaveProfile}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Notifications Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <BellIcon />
          <h2 className={styles.cardTitle}>Notifications</h2>
        </div>
        <div className={styles.cardContent}>
          <div className={styles.toggleGroup}>
            <div className={styles.toggleItem}>
              <div className={styles.toggleContent}>
                <div className={styles.toggleText}>
                  <span className={styles.toggleLabel}>Email Notifications</span>
                  <span className={styles.toggleDescription}>Receive updates via email</span>
                </div>
                <label className={styles.toggleSwitch}>
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => handleToggleEmailNotifications(e.target.checked)}
                  />
                  <span className={styles.slider} />
                </label>
              </div>
            </div>

            <div className={styles.toggleItem}>
              <div className={styles.toggleContent}>
                <div className={styles.toggleText}>
                  <span className={styles.toggleLabel}>Proposal Alerts</span>
                  <span className={styles.toggleDescription}>Get notified when proposals are accepted</span>
                </div>
                <label className={styles.toggleSwitch}>
                  <input
                    type="checkbox"
                    checked={proposalAlerts}
                    onChange={(e) => handleToggleProposalAlerts(e.target.checked)}
                  />
                  <span className={styles.slider} />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
