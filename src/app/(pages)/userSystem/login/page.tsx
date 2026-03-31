"use client";

import { useState } from "react";
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
  const router = useRouter();

  const handleLogin = async (loginIdentifier, loginPassword) => {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: loginIdentifier,
        password: loginPassword,
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

  const handleAutoLogin = async (
    autoIdentifier: string,
    autoPassword: string,
  ) => {
    setIdentifier(autoIdentifier);
    setLoginPassword(autoPassword);
    await handleLogin(autoIdentifier, autoPassword);
  };

  const handleAdminEnter = async () => {
    if (adminSubmitting) return;
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

  return (
    <div className="login-screen">
      <div className="forest-bg">
        <div className="tree tree-left"></div>
        <div className="tree tree-right"></div>
      </div>

      <div className="login-card">
        <form className="login-form" onSubmit={handleSubmit}>
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

        <div className="auto-login-section">
          <button
            type="button"
            className="auto-btn"
            onClick={() => handleAutoLogin("Sarcus", "123456")}
          >
            Auto Login (Sarcus)
          </button>
          <button
            type="button"
            className="auto-btn"
            onClick={() => handleAutoLogin("weiquan", "weiquan")}
          >
            Auto Login (weiquan)
          </button>
        </div>

        {message && <p className="status-message">{message}</p>}

        <div className="register-link">
          <Link href="/userSystem/register">
            Don't have an account? Register
          </Link>
        </div>
      </div>

      <button
        type="button"
        className="settings-fab"
        onClick={() => setShowAdminModal(true)}
      >
        <div className="gear-icon">⚙</div>
      </button>

      {showAdminModal && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setShowAdminModal(false)}
        >
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Admin Access</h2>
            <input
              type="password"
              placeholder="Admin password"
              value={adminInput}
              onChange={(e) => setAdminInput(e.target.value)}
            />
            <div className="admin-modal-actions">
              <button onClick={() => setShowAdminModal(false)}>Cancel</button>
              <button onClick={handleAdminEnter} className="enter-btn">
                Enter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
