"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "./page.css";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [message, setMessage] = useState("");
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const adminInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const handleAdminOpen = () => {
    setAdminInput("");
    setAdminError("");
    setShowAdminModal(true);
  };

  const handleAdminClose = () => {
    if (adminSubmitting) return;
    setShowAdminModal(false);
    setAdminInput("");
    setAdminError("");
  };

  useEffect(() => {
    if (!showAdminModal) return;

    const focusTimer = window.setTimeout(() => {
      adminInputRef.current?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleAdminClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showAdminModal, adminSubmitting]);

  const handleLogin = async (loginIdentifier, password) => {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: loginIdentifier,
        password,
      }),
    });
    const data = await res.json();
    const success = Boolean(data.success);
    setMessage(data.error || (success ? "Login successful" : "Login failed"));
    if (success) {
      router.push("/userSystem/user");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await handleLogin(identifier, loginPassword);
  };

  const handleAdminEnter = async () => {
    if (adminSubmitting) return;
    if (!adminInput.trim()) {
      setAdminError("Enter the admin password.");
      return;
    }

    setAdminError("");
    setAdminSubmitting(true);
    try {
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminInput }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setAdminError(data.error || "Invalid admin password.");
        return;
      }
      setAdminInput("");
      setShowAdminModal(false);
      router.push("/admin");
    } catch (error) {
      console.error(error);
      setAdminError("Failed to verify admin password.");
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    await handleAdminEnter();
  };

  return (
    <div className="login-container">
      <div className="forest-bg">
        <div className="tree" style={{ left: "10%", bottom: "20%" }}>
          {"\u{1F332}"}
        </div>
        <div className="tree" style={{ right: "15%", bottom: "10%" }}>
          {"\u{1F332}"}
        </div>
        <div className="tree" style={{ left: "40%", bottom: "5%" }}>
          {"\u{1F332}"}
        </div>
      </div>

      <div className="login-card">
        <h1>Login</h1>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="text"
            placeholder="Email, Phone, or Username"
            className="login-input"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="login-input"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            required
          />
          <button type="submit" className="main-login-btn">
            Login
          </button>
        </form>

        {message && <p className="status-message">{message}</p>}

        <div className="register-link">
          <Link href="/userSystem/register">
            Don't have an account? Register
          </Link>
        </div>

        <div className="login-card-footer">
          <p className="admin-access-copy">Need administrator access?</p>
          <button
            type="button"
            className="admin-access-trigger"
            onClick={handleAdminOpen}
          >
            <span className="admin-access-badge">ADMIN</span>
            <span>Open admin access</span>
          </button>
        </div>
      </div>

      {showAdminModal && (
        <div className="admin-modal-backdrop" onClick={handleAdminClose}>
          <form
            className="admin-modal-card"
            role="dialog"
            aria-modal="true"
            onSubmit={handleAdminSubmit}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <p className="admin-modal-kicker">Restricted Area</p>
              <h2>Admin Access</h2>
              <p className="admin-modal-description">
                Enter the administrator password to continue to the admin
                dashboard.
              </p>
            </div>

            <label className="admin-modal-field">
              <span>Admin password</span>
              <input
                ref={adminInputRef}
                type="password"
                placeholder="Enter admin password"
                value={adminInput}
                onChange={(e) => setAdminInput(e.target.value)}
                disabled={adminSubmitting}
                autoComplete="current-password"
              />
            </label>

            {adminError ? (
              <p className="admin-modal-error">{adminError}</p>
            ) : null}

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-cancel-btn"
                onClick={handleAdminClose}
                disabled={adminSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="admin-confirm-btn"
                disabled={adminSubmitting || !adminInput.trim()}
              >
                {adminSubmitting ? "Confirming..." : "Confirm"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
