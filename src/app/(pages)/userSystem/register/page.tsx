'use client';

import { useState } from 'react';
import Link from 'next/link';
import './page.css';

export default function Register() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, phone, username, password }),
    });
    const data = await res.json();
    setMessage(data.error || (data.success ? 'Registration successful' : 'Registration failed'));
  };

  return (
    <div className="register-container">
      <div className="forest-bg">
        <div className="tree" style={{ left: "15%", top: "10%" }}>🌲</div>
        <div className="tree" style={{ right: "10%", bottom: "15%" }}>🌲</div>
        <div className="tree" style={{ left: "45%", bottom: "20%" }}>🌲</div>
      </div>

      <div className="register-card">
        <h1>Register</h1>
        <form className="register-form" onSubmit={handleSubmit}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit">Register</button>
      </form>
        <div className="link">
          <Link href="/userSystem/login">
            Already have an account? Login
          </Link>
        </div>
      </div>
    </div>
  );
}
