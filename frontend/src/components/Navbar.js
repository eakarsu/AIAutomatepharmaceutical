import React from 'react';
import { Link } from 'react-router-dom';

function Navbar({ user, onLogout }) {
  const initials = user?.name?.split(' ').map(n => n[0]).join('') || 'U';

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <div className="logo-icon">&#x2695;</div>
        <h2>PharmaDocs AI</h2>
      </Link>
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
