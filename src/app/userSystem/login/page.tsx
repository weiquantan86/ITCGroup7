'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ThreeScene from '../../components/ThreeScene';
import './page.css';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  const handleLogin = async (loginIdentifier, loginPassword) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: loginIdentifier, password: loginPassword }),
    });
    const data = await res.json();
    const success = Boolean(data.success);
    setIsLoggedIn(success);
    setMessage(data.error || (success ? 'Login successful' : 'Login failed'));
    if (success) {
      router.push('/userSystem/user');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await handleLogin(identifier, password);
  };

  const handleAutoLogin = async () => {
    const autoIdentifier = 'Sarcus';
    const autoPassword = '123456';
    setIdentifier(autoIdentifier);
    setPassword(autoPassword);
    await handleLogin(autoIdentifier, autoPassword);
  };

  return (
    <div className="login-container">
      <h1>Login</h1>
      <form className="login-form" onSubmit={handleSubmit}>
        <input type="text" placeholder="Email, Phone, or Username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit">Login</button>
      </form>
      <div className="auto-login">
        <button type="button" className="auto-login-button" onClick={handleAutoLogin}>
          Auto Login (Sarcus)
        </button>
      </div>
      <p className="message">{message}</p>
      {isLoggedIn && (
        <div className="three-preview" aria-live="polite">
          <ThreeScene />
        </div>
      )}
      <div className="link">
        <a href="/userSystem/register">Don't have an account? Register</a>
      </div>
    </div>
  );
}
