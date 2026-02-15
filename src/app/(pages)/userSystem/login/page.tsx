'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import './page.css';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [message, setMessage] = useState('');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminInput, setAdminInput] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const router = useRouter();

  const handleLogin = async (loginIdentifier, loginPassword) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: loginIdentifier, password: loginPassword }),
    });
    const data = await res.json();
    const success = Boolean(data.success);
    setMessage(data.error || (success ? 'Login successful' : 'Login failed'));
    if (success) {
      router.push('/userSystem/user');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await handleLogin(identifier, loginPassword);
  };

  const handleAutoLogin = async (autoIdentifier: string, autoPassword: string) => {
    setIdentifier(autoIdentifier);
    setLoginPassword(autoPassword);
    await handleLogin(autoIdentifier, autoPassword);
  };

  const handleAdminEnter = async () => {
    if (adminSubmitting) return;
    setAdminError('');
    setAdminSubmitting(true);
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminInput }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setAdminError(data.error || 'Invalid admin password.');
        return;
      }
      setAdminInput('');
      setShowAdminModal(false);
      router.push('/admin');
    } catch (error) {
      console.error(error);
      setAdminError('Failed to verify admin password.');
    } finally {
      setAdminSubmitting(false);
    }
  };

  const closeAdminModal = () => {
    setShowAdminModal(false);
    setAdminInput('');
    setAdminError('');
  };

  return (
    <div className="login-container">
      <h1>Login</h1>
      <form className="login-form" onSubmit={handleSubmit}>
        <input type="text" placeholder="Email, Phone, or Username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        <input type="password" placeholder="Password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
        <button type="submit">Login</button>
      </form>
      <div className="auto-login">
        <button
          type="button"
          className="auto-login-button"
          onClick={() => handleAutoLogin('Sarcus', '123456')}
        >
          Auto Login (Sarcus)
        </button>
        <button
          type="button"
          className="auto-login-button"
          onClick={() => handleAutoLogin('weiquan', 'weiquan')}
        >
          Auto Login (weiquan)
        </button>
      </div>
      <p className="message">{message}</p>
      <div className="link">
        <a href="/userSystem/register">Don't have an account? Register</a>
      </div>

      <button
        type="button"
        className="settings-entry-button"
        aria-label="Open admin access"
        onClick={() => setShowAdminModal(true)}
      >
        ⚙
      </button>

      {showAdminModal && (
        <div className="admin-modal-backdrop" onClick={closeAdminModal}>
          <div
            className="admin-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Admin password dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Admin Access</h2>
            <p>Enter admin password</p>
            <input
              type="text"
              placeholder="Admin password"
              value={adminInput}
              onChange={(e) => setAdminInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAdminEnter();
                }
              }}
              autoFocus
            />
            {adminError ? <p className="admin-error">{adminError}</p> : null}
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-cancel-button"
                onClick={closeAdminModal}
                disabled={adminSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-enter-button"
                onClick={() => void handleAdminEnter()}
                disabled={adminSubmitting}
              >
                {adminSubmitting ? 'Checking...' : 'Enter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
