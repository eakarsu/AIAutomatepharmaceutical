import React, { useState, useEffect } from 'react';
import api from '../../services/api';

// VIZ: Batch yield trend chart - SVG bar chart (planned vs actual) + yield line vs target.
function BatchYieldTrendChart() {
  const [days, setDays] = useState(30);
  const [product, setProduct] = useState('Acetaminophen 500mg');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await api.get('/custom-views/batch-yield-trend', { params: { days, product } });
      setData(r.data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const W = 780;
  const H = 320;
  const padL = 50, padR = 20, padT = 30, padB = 50;
  const series = data?.series || [];
  const maxKg = Math.max(1, ...series.map((s) => Math.max(s.planned_kg, s.actual_kg)));
  const xStep = series.length > 0 ? (W - padL - padR) / series.length : 0;
  const yScale = (v) => H - padB - (v / maxKg) * (H - padT - padB);
  const yScalePct = (v) => H - padB - (v / 100) * (H - padT - padB);

  const yieldPath = series
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${padL + i * xStep + xStep / 2} ${yScalePct(s.yield_pct)}`)
    .join(' ');

  return (
    <div style={{ background: '#0f172a', borderRadius: 8, padding: 20, color: '#e2e8f0' }}>
      <h3 style={{ marginTop: 0, color: '#60a5fa' }}>Batch Yield Trend</h3>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Daily aggregated planned vs actual batch output and rolling yield % against the 92% target.
      </p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={days} onChange={(e) => setDays(parseInt(e.target.value, 10))}
          style={{ padding: 8, borderRadius: 4, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }}>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <input value={product} onChange={(e) => setProduct(e.target.value)}
          style={{ padding: 8, borderRadius: 4, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', minWidth: 240 }} />
        <button onClick={load} disabled={loading}
          style={{ padding: '8px 16px', borderRadius: 4, border: 0, background: '#3b82f6', color: '#fff', cursor: 'pointer' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      {err && <div style={{ color: '#f87171' }}>Error: {err}</div>}
      {data && (
        <>
          <div style={{ display: 'flex', gap: 18, fontSize: 13, marginBottom: 12, flexWrap: 'wrap' }}>
            <span>Avg yield: <b style={{ color: data.average_yield_pct >= data.target_yield_pct ? '#22c55e' : '#f87171' }}>
              {data.average_yield_pct}%</b></span>
            <span>Overall yield: <b>{data.overall_yield_pct}%</b></span>
            <span>Target: <b>{data.target_yield_pct}%</b></span>
            <span>Above target: <b style={{ color: '#22c55e' }}>{data.days_above_target} days</b></span>
            <span>Below target: <b style={{ color: '#f87171' }}>{data.days_below_target} days</b></span>
          </div>
          <div style={{ overflow: 'auto', border: '1px solid #1e293b', borderRadius: 6 }}>
            <svg width={W} height={H} style={{ background: '#0b1220' }}>
              {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
                <g key={i}>
                  <line x1={padL} x2={W - padR} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} stroke="#1e293b" />
                  <text x={padL - 6} y={padT + f * (H - padT - padB) + 4} fill="#64748b" fontSize="10" textAnchor="end">
                    {Math.round((1 - f) * maxKg)}
                  </text>
                </g>
              ))}
              {series.map((s, i) => {
                const x = padL + i * xStep + 2;
                const barW = Math.max(2, xStep - 4);
                return (
                  <g key={i}>
                    <rect x={x} y={yScale(s.planned_kg)} width={barW}
                      height={H - padB - yScale(s.planned_kg)} fill="#1e3a8a" opacity="0.55" />
                    <rect x={x + barW / 4} y={yScale(s.actual_kg)} width={barW / 2}
                      height={H - padB - yScale(s.actual_kg)} fill={s.meets_target ? '#22c55e' : '#ef4444'} />
                  </g>
                );
              })}
              <line x1={padL} x2={W - padR} y1={yScalePct(data.target_yield_pct)} y2={yScalePct(data.target_yield_pct)}
                stroke="#facc15" strokeDasharray="4 4" />
              <path d={yieldPath} fill="none" stroke="#f97316" strokeWidth="2" />
              {series.filter((_, i) => i % Math.max(1, Math.floor(series.length / 8)) === 0).map((s, j) => {
                const i = series.indexOf(s);
                return (
                  <text key={j} x={padL + i * xStep + xStep / 2} y={H - padB + 14}
                    fill="#64748b" fontSize="9" textAnchor="middle"
                    transform={`rotate(-25 ${padL + i * xStep + xStep / 2} ${H - padB + 14})`}>
                    {s.date.substring(5)}
                  </text>
                );
              })}
              <g transform={`translate(${padL},${H - 12})`}>
                <rect x={0} y={-8} width={10} height={10} fill="#1e3a8a" />
                <text x={14} y={1} fill="#cbd5e1" fontSize="10">Planned</text>
                <rect x={70} y={-8} width={10} height={10} fill="#22c55e" />
                <text x={84} y={1} fill="#cbd5e1" fontSize="10">Actual (on-target)</text>
                <rect x={195} y={-8} width={10} height={10} fill="#ef4444" />
                <text x={209} y={1} fill="#cbd5e1" fontSize="10">Actual (below)</text>
                <line x1={310} x2={326} y1={-3} y2={-3} stroke="#f97316" strokeWidth="2" />
                <text x={330} y={1} fill="#cbd5e1" fontSize="10">Yield %</text>
                <line x1={385} x2={401} y1={-3} y2={-3} stroke="#facc15" strokeDasharray="3 3" />
                <text x={405} y={1} fill="#cbd5e1" fontSize="10">Target</text>
              </g>
            </svg>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 14, fontSize: 12, flexWrap: 'wrap' }}>
            <span>Best day: <b style={{ color: '#22c55e' }}>{data.best_day?.date}</b> ({data.best_day?.yield_pct}%)</span>
            <span>Worst day: <b style={{ color: '#f87171' }}>{data.worst_day?.date}</b> ({data.worst_day?.yield_pct}%)</span>
          </div>
        </>
      )}
    </div>
  );
}

export default BatchYieldTrendChart;
