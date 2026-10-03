import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { FEATURES } from '../pages/Dashboard';
import './AppSidebar.css';

const LINKS = [
  ...FEATURES.map(feature => ({ to: `/feature/${feature.key}`, label: feature.name, group: 'Workspace' })),
  { to: '/insights/timeline', label: 'Timeline', group: 'Insights' },
  { to: '/codex/custom-viz', label: 'Custom Viz', group: 'Insights' },
  { to: '/codex/operations', label: 'Operations', group: 'Insights' },
  { to: '/', label: 'Dashboard', group: 'Workspace' },
  { to: '/ai-tools/batch', label: 'Batch', group: 'AI tools' },
  { to: '/ai-tools/trends', label: 'Trends', group: 'AI tools' },
  { to: '/ai-tools/prompts', label: 'Prompts', group: 'AI tools' },
  { to: '/ai-tools/audit', label: 'Audit', group: 'AI tools' },
  { to: '/ai-tools/calendar', label: 'Calendar', group: 'AI tools' },
  { to: '/ai-tools/cross-doc', label: 'Cross Doc', group: 'AI tools' },
  { to: '/ai-tools/export', label: 'Export', group: 'AI tools' },
  { to: '/ai-tools/cost', label: 'Cost', group: 'AI tools' },
  { to: '/ai-tools/extra', label: 'Extra', group: 'AI tools' },
  { to: '/ai-tools/extensions', label: 'Extensions', group: 'AI tools' },
  { to: '/custom-views', label: 'Custom Views', group: 'Workspace' },
  { to: '/capa-readiness-board', label: 'Capa Readiness Board', group: 'Workspace' },
];

export default function AppSidebar() {
  const [query, setQuery] = useState('');
  const visible = LINKS.filter(link => link.label.toLowerCase().includes(query.toLowerCase().trim()));
  return <aside className="codex-side" aria-label="Application navigation">
    <div className="codex-side-brand"><strong>AIAutomatepharmaceutical</strong><span>Workspace</span></div>
    <label className="codex-side-search-label" htmlFor="codex-side-search">Find a section</label>
    <input id="codex-side-search" className="codex-side-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search navigation" />
    <nav className="codex-side-links" aria-label="Sections">
      {['Workspace', 'AI tools', 'Insights'].map(group => {
        const items = visible.filter(link => link.group === group);
        return items.length ? <div className="codex-side-group" key={group}>
          <span className="codex-side-heading">{group}</span>
          {items.map(link => <NavLink key={link.to} to={link.to} end={link.to === '/'} className={({ isActive }) => `codex-side-link${isActive ? ' active' : ''}`}>{link.label}</NavLink>)}
        </div> : null;
      })}
      {visible.length === 0 && <p className="codex-side-empty">No matching sections</p>}
    </nav>
  </aside>;
}
