import React, { useState, useEffect } from 'react';
import { aiFeatures } from '../services/api';

function CostAnalytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logForm, setLogForm] = useState({ feature: 'compliance_check', department: 'regulatory', model: 'anthropic/claude-haiku-4.5', input_tokens: 500, output_tokens: 800 });

  const load = async () => {
    setLoading(true);
    try {
      const r = await aiFeatures.costAnalytics(days);
      setData(r.data);
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const logUsage = async () => {
    try {
      await aiFeatures.logUsage(logForm);
      load();
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="main-content">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1>AI Cost Analytics</h1>
        <p>Per-feature token usage, cost attribution, and budget forecasting</p>
      </div>

      <div className="detail-card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <label>Period:
            <select value={days} onChange={(e) => setDays(parseInt(e.target.value))} style={{ marginLeft: 8 }}>
              <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
            </select>
          </label>
          <button className="btn btn-primary btn-sm" onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
        </div>

        {data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              <div className="stat-card"><div className="stat-label">Total Cost</div><div className="stat-value" style={{ color: '#10b981' }}>${data.summary.total_cost_usd.toFixed(4)}</div></div>
              <div className="stat-card"><div className="stat-label">Total Calls</div><div className="stat-value">{data.summary.total_calls}</div></div>
              <div className="stat-card"><div className="stat-label">Total Tokens</div><div className="stat-value">{data.summary.total_tokens.toLocaleString()}</div></div>
              <div className="stat-card"><div className="stat-label">Avg Cost/Call</div><div className="stat-value">${data.summary.avg_cost_per_call.toFixed(4)}</div></div>
            </div>

            <h3>By Feature & Model</h3>
            <table style={{ width: '100%', marginBottom: 24 }}>
              <thead><tr><th>Feature</th><th>Model</th><th>Calls</th><th>In tokens</th><th>Out tokens</th><th>Cost</th></tr></thead>
              <tbody>{(data.by_feature_model || []).map((r, i) => (
                <tr key={i}><td>{r.feature}</td><td>{r.model}</td><td>{r.call_count}</td>
                  <td>{r.input_tokens || 0}</td><td>{r.output_tokens || 0}</td>
                  <td>${parseFloat(r.total_cost || 0).toFixed(4)}</td>
                </tr>
              ))}</tbody>
            </table>

            <h3>By User</h3>
            <table style={{ width: '100%', marginBottom: 24 }}>
              <thead><tr><th>User</th><th>Calls</th><th>Tokens</th><th>Cost</th></tr></thead>
              <tbody>{(data.by_user || []).map((r, i) => (
                <tr key={i}><td>{r.user_email}</td><td>{r.call_count}</td><td>{r.total_tokens}</td><td>${parseFloat(r.total_cost || 0).toFixed(4)}</td></tr>
              ))}</tbody>
            </table>

            <h3>Daily Trend</h3>
            <table style={{ width: '100%' }}>
              <thead><tr><th>Day</th><th>Calls</th><th>Tokens</th><th>Cost</th></tr></thead>
              <tbody>{(data.by_day || []).map((r, i) => (
                <tr key={i}><td>{new Date(r.day).toLocaleDateString()}</td><td>{r.call_count}</td><td>{r.total_tokens}</td><td>${parseFloat(r.total_cost || 0).toFixed(4)}</td></tr>
              ))}</tbody>
            </table>
          </>
        )}
      </div>

      <div className="detail-card">
        <h3>Log Usage Event (testing)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr) auto', gap: 8, alignItems: 'flex-end' }}>
          <div className="form-group"><label>Feature</label><input value={logForm.feature} onChange={(e) => setLogForm({ ...logForm, feature: e.target.value })} /></div>
          <div className="form-group"><label>Department</label><input value={logForm.department} onChange={(e) => setLogForm({ ...logForm, department: e.target.value })} /></div>
          <div className="form-group"><label>Model</label><input value={logForm.model} onChange={(e) => setLogForm({ ...logForm, model: e.target.value })} /></div>
          <div className="form-group"><label>In tokens</label><input type="number" value={logForm.input_tokens} onChange={(e) => setLogForm({ ...logForm, input_tokens: parseInt(e.target.value) })} /></div>
          <div className="form-group"><label>Out tokens</label><input type="number" value={logForm.output_tokens} onChange={(e) => setLogForm({ ...logForm, output_tokens: parseInt(e.target.value) })} /></div>
          <button className="btn btn-success btn-sm" onClick={logUsage}>Log</button>
        </div>
      </div>
    </div>
  );
}

export default CostAnalytics;
