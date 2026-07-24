import React, { useState } from 'react';
import { auth } from '../services/api';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await auth.login(email, password);
      localStorage.setItem('pharma_token', data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const autoFill = () => {
    setEmail('admin@pharma.com');
    setPassword('password123');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="icon">&#x2695;</div>
          <h1>PharmaDocs AI</h1>
          <p>Pharmaceutical Document Management Platform</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <button className="auto-fill-btn" onClick={autoFill}>
          &#x26A1; Quick Login - Auto-fill Demo Credentials
        </button>
      </div>
    </div>
  );
}

export default Login;
