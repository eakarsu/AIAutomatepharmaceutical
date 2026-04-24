import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { documents } from '../services/api';

const FEATURES = [
  { key: 'lab_results', name: 'Lab Results', icon: '\u{1F9EA}', color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', desc: 'Transcribe, analyze, and manage laboratory test results including HPLC, dissolution, stability, and microbiology data.' },
  { key: 'fda_compliance', name: 'FDA Compliance', icon: '\u{1F3DB}', color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #059669)', desc: 'Track FDA regulatory compliance documents, 483 responses, annual product reviews, and inspection readiness.' },
  { key: 'drug_trials', name: 'Drug Trials', icon: '\u{1F489}', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', desc: 'Manage clinical trial documentation from Phase I through post-market surveillance studies.' },
  { key: 'regulatory_submissions', name: 'Regulatory Submissions', icon: '\u{1F4CB}', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', desc: 'Track NDA, ANDA, BLA, IND applications and supplements through the regulatory submission lifecycle.' },
  { key: 'quality_control', name: 'Quality Control', icon: '\u{2705}', color: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)', desc: 'Manage OOS investigations, CAPAs, deviations, change controls, and method validations.' },
  { key: 'adverse_events', name: 'Adverse Events', icon: '\u{26A0}', color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)', desc: 'Report and track serious adverse events, SUSARs, safety signals, and MedWatch submissions.' },
  { key: 'manufacturing_records', name: 'Manufacturing Records', icon: '\u{1F3ED}', color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)', desc: 'Document batch manufacturing, packaging, cleaning, and process validation records.' },
  { key: 'clinical_protocols', name: 'Clinical Protocols', icon: '\u{1F4D1}', color: '#14b8a6', gradient: 'linear-gradient(135deg, #14b8a6, #0d9488)', desc: 'Manage study protocols, amendments, SAPs, ICFs, and clinical operations documentation.' },
  { key: 'drug_safety', name: 'Drug Safety', icon: '\u{1F6E1}', color: '#f43f5e', gradient: 'linear-gradient(135deg, #f43f5e, #e11d48)', desc: 'Track PBRERs, safety signals, risk management plans, and aggregate safety analyses.' },
  { key: 'pharmacovigilance', name: 'Pharmacovigilance', icon: '\u{1F50D}', color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #9333ea)', desc: 'Monitor drug safety through ICSR processing, signal management, and PV system compliance.' },
  { key: 'medical_literature', name: 'Medical Literature', icon: '\u{1F4DA}', color: '#0ea5e9', gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)', desc: 'Systematic reviews, literature searches, competitive intelligence, and publication assessments.' },
  { key: 'sops', name: 'SOPs', icon: '\u{1F4DD}', color: '#84cc16', gradient: 'linear-gradient(135deg, #84cc16, #65a30d)', desc: 'Standard Operating Procedures for quality, manufacturing, clinical, regulatory, and IT operations.' },
  { key: 'audit_trail', name: 'Audit Trail', icon: '\u{1F50E}', color: '#f97316', gradient: 'linear-gradient(135deg, #f97316, #ea580c)', desc: 'Internal audits, supplier audits, regulatory inspections, and data integrity assessments.' },
  { key: 'supply_chain', name: 'Supply Chain', icon: '\u{1F69A}', color: '#22d3ee', gradient: 'linear-gradient(135deg, #22d3ee, #06b6d4)', desc: 'API supply agreements, cold chain qualification, serialization, and logistics management.' },
  { key: 'patent_documents', name: 'Patent Documents', icon: '\u{1F4DC}', color: '#e879f9', gradient: 'linear-gradient(135deg, #e879f9, #d946ef)', desc: 'Patent portfolio management, FTO analyses, licensing, and IP litigation tracking.' },
];

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    documents.getStats().then(r => setStats(r.data)).catch(() => {});
  }, []);

  const getCategoryCount = (key) => {
    if (!stats?.byCategory) return 0;
    const found = stats.byCategory.find(c => c.category === key);
    return found ? parseInt(found.count) : 0;
  };

  const getStatusCount = (status) => {
    if (!stats?.byStatus) return 0;
    const found = stats.byStatus.find(s => s.status === status);
    return found ? parseInt(found.count) : 0;
  };

  return (
    <div className="main-content">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Pharmaceutical Document Management & AI Analysis Platform</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)' }}>&#x1F4C4;</div>
          <div className="stat-value" style={{ color: '#3b82f6' }}>{stats?.total || 0}</div>
          <div className="stat-label">Total Documents</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>&#x2705;</div>
          <div className="stat-value" style={{ color: '#10b981' }}>{getStatusCount('approved') + getStatusCount('completed')}</div>
          <div className="stat-label">Completed / Approved</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>&#x23F3;</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>{getStatusCount('review') + getStatusCount('in_progress')}</div>
          <div className="stat-label">In Progress / Review</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>&#x1F4CA;</div>
          <div className="stat-value" style={{ color: '#8b5cf6' }}>{stats?.byCategory?.length || 0}</div>
          <div className="stat-label">Active Categories</div>
        </div>
      </div>

      <div className="features-section">
        <h2>Document Categories</h2>
        <div className="features-grid">
          {FEATURES.map(f => (
            <div key={f.key} className="feature-card" onClick={() => navigate(`/feature/${f.key}`)}
                 style={{ '--accent': f.color }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: f.gradient, borderRadius: '16px 16px 0 0' }} />
              <div className="card-icon" style={{ background: `${f.color}20`, color: f.color }}>{f.icon}</div>
              <h3>{f.name}</h3>
              <p>{f.desc}</p>
              <div className="card-meta">
                <span className="card-count">{getCategoryCount(f.key)} documents</span>
                <span className="card-arrow">&#x2192;</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
