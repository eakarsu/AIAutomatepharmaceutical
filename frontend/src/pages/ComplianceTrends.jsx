import NativeAIControls from '../components/NativeAIControls';
import FormattedAIReport from '../components/FormattedAIReport';
import React, { useState, useEffect } from 'react';
import { aiFeatures } from '../services/api';

const CATEGORIES = [
  '', 'clinical_trials', 'regulatory', 'manufacturing', 'quality_control',
  'pharmacovigilance', 'labeling', 'submissions', 'sops', 'validation',
  'audit_reports', 'drug_substances', 'biologics', 'formulation',
  'stability', 'preclinical', 'medical_affairs', 'pharmacokinetics',
];

function ComplianceTrends() {
  const [days, setDays] = useState(30);
  const [category, setCategory] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [anomalyResult, setAnomalyResult] = useState(null);
  const [anomalyLoading, setAnomalyLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = { days };
      if (category) params.category = category;
      const r = await aiFeatures.trends(params);
      setData(r.data);
    } catch (err) {
      alert('Load failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const detectAnomalies = async () => {
    setAnomalyLoading(true);
    setAnomalyResult(null);
    try {
      const r = await aiFeatures.analyzeAnomalies(days);
      setAnomalyResult(r.data);
    } catch (err) {
      alert('Anomaly detection failed: ' + err.message);
    } finally {
      setAnomalyLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Sparkline-ish bar chart
  const Chart = ({ timeline }) => {
    if (!timeline || timeline.length === 0) return <p>No data</p>;
    const max = Math.max(...timeline.map((t) => t.risk_score), 1);
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', height: 200, gap: 2, marginTop: 16 }}>
        {timeline.map((t) => (
          <div key={t.day} style={{ flex: 1, textAlign: 'center' }} title={`${t.day}: risk ${t.risk_score}`}>
            <div
              style={{
                height: `${(t.risk_score / max) * 180}px`,
                background: t.risk_score > 70 ? '#ef4444' : t.risk_score > 40 ? '#f59e0b' : '#10b981',
                borderRadius: '4px 4px 0 0',
              }}
            />
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 4, transform: 'rotate(-45deg)', transformOrigin: 'left' }}>
              {t.day.slice(5)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <NativeAIControls busy={anomalyLoading} context="compliance anomaly detection"><div className="main-content">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1>Compliance Trend Dashboard</h1>
        <p>Historical compliance risk scoring with anomaly detection</p>
      </div>

      <div className="detail-card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <label>Period:
            <select value={days} onChange={(e) => setDays(parseInt(e.target.value))} style={{ marginLeft: 8 }}>
              <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={180}>180 days</option>
            </select>
          </label>
          <label>Category:
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ marginLeft: 8 }}>
              {CATEGORIES.map((c) => (<option key={c} value={c}>{c || 'All categories'}</option>))}
            </select>
          </label>
          <button className="btn btn-primary btn-sm" onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
          <button className="btn btn-ai btn-sm" onClick={detectAnomalies} disabled={anomalyLoading}>{anomalyLoading ? 'Detecting...' : '🔍 AI Anomaly Detection'}</button>
        </div>

        {data && data.timeline && data.timeline.length > 0 ? (
          <>
            <h3>Risk Score Over Time</h3>
            <Chart timeline={data.timeline} />
            <table style={{ marginTop: 32, width: '100%' }}>
              <thead><tr><th>Day</th><th>Docs</th><th>Critical</th><th>High</th><th>Approved</th><th>Risk Score</th></tr></thead>
              <tbody>{data.timeline.map((t) => (
                <tr key={t.day}>
                  <td>{t.day}</td><td>{t.doc_count}</td><td>{t.critical_count}</td>
                  <td>{t.high_count}</td><td>{t.approved_count}</td>
                  <td><strong style={{ color: t.risk_score > 70 ? '#ef4444' : t.risk_score > 40 ? '#f59e0b' : '#10b981' }}>{t.risk_score}</strong></td>
                </tr>
              ))}</tbody>
            </table>
          </>
        ) : (
          <p style={{ color: '#64748b' }}>No trend data available for this period.</p>
        )}
      </div>

      {anomalyResult && (
        <div className="detail-card">
          <h3>AI Anomaly Detection Results</h3>
          <FormattedAIReport response={anomalyResult} title="Compliance anomaly detection" />
        </div>
      )}
    </div></NativeAIControls>
  );
}

export default ComplianceTrends;
