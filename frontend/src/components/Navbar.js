import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navbar({ user, onLogout }) {
  const initials = user?.name?.split(' ').map(n => n[0]).join('') || 'U';
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const aiLinks = [
    { path: '/', label: 'Dashboard' },
    { path: '/ai-tools/batch', label: 'Batch Analysis' },
    { path: '/ai-tools/trends', label: 'Compliance Trends' },
    { path: '/ai-tools/prompts', label: 'Prompt Templates' },
    { path: '/ai-tools/audit', label: 'Audit Trail' },
    { path: '/ai-tools/calendar', label: 'Regulatory Calendar' },
    { path: '/ai-tools/cross-doc', label: 'Cross-Doc Analysis' },
    { path: '/ai-tools/export', label: 'API Export' },
    { path: '/ai-tools/cost', label: 'Cost Analytics' },
    { path: '/ai-tools/extra', label: 'Classify / AE / GMP' },
  ];

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <div className="logo-icon">&#x2695;</div>
        <h2>PharmaDocs AI</h2>
      </Link>
      <div style={{ position: 'relative' }}>
        <button
          className="logout-btn"
          style={{ marginRight: 12 }}
          onClick={() => setOpen(!open)}
        >
          AI Tools &#x25BE;
        </button>
        {open && (
          <div
            style={{
              position: 'absolute',
              top: 40,
              right: 12,
              background: '#1e293b',
              borderRadius: 8,
              padding: 8,
              minWidth: 220,
              zIndex: 100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
            onMouseLeave={() => setOpen(false)}
          >
            {aiLinks.map((l) => (
              <Link
                key={l.path}
                to={l.path}
                onClick={() => setOpen(false)}
                style={{
                  display: 'block',
                  padding: '8px 12px',
                  color: location.pathname === l.path ? '#3b82f6' : '#e2e8f0',
                  fontSize: 13,
                  textDecoration: 'none',
                  borderRadius: 4,
                  background: location.pathname === l.path ? 'rgba(59,130,246,0.1)' : 'transparent',
                }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className="navbar-right">
        <div className="navbar-user">
          <div className="avatar">{initials}</div>
          <div>
            <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '13px' }}>{user?.name}</div>
            <div style={{ fontSize: '11px' }}>{user?.role}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={onLogout}>Sign Out</button>
      </div>
    </nav>
  );
}

export default Navbar;
