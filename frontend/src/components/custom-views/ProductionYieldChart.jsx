import React, { useState, useEffect } from 'react';
import api from '../../services/api';

// SVG line + bar chart for daily production yield %, planned vs actual kg.
function ProductionYieldChart() {
  const [days, setDays] = useState(30);
  const [line, setLine] = useState('A');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await api.get('/custom-views/production-yield', { params: { days, line } });
      setData(r.data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const W = 760;
  const H = 320;
  const padL = 50, padR = 20, padT = 30, padB = 50;
  const series = data?.series || [];
  const maxKg = Math.max(1, ...series.map((s) => Math.max(s.planned_kg, s.actual_kg)));
  const xStep = series.length > 0 ? (W - padL - padR) / series.length : 0;
  const yScale = (v) => H - padB - (v / maxKg) * (H - padT - padB);
  const yScalePct = (v) => H - padB - (v / 100) * (H - padT - padB);

  // Build polyline for yield_pct
  const yieldPath = series
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${padL + i * xStep + xStep / 2} ${yScalePct(s.yield_pct)}`)
    .join(' ');

  return (
    <div style={{ background: '#0f172a', borderRadius: 8, padding: 20, color: '#e2e8f0' }}>
      <h3 style={{ marginTop: 0, color: '#60a5fa' }}>Production Yield Chart</h3>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Daily planned vs actual production and rolling yield % vs 92% target.
      </p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={days} onChange={(e) => setDays(parseInt(e.target.value, 10))}
          style={{ padding: 8, borderRadius: 4, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }}
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
        </select>
        <select
          value={line} onChange={(e) => setLine(e.target.value)}
          style={{ padding: 8, borderRadius: 4, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }}
        >
          <option value="A">Line A</option>
          <option value="B">Line B</option>
          <option value="C">Line C</option>
        </select>
        <button
          onClick={load} disabled={loading}
          style={{ padding: '8px 16px', borderRadius: 4, border: 0, background: '#3b82f6', color: '#fff', cursor: 'pointer' }}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {err && <div style={{ color: '#f87171' }}>Error: {err}</div>}
      {data && (
        <>
          <div style={{ display: 'flex', gap: 24, fontSize: 13, marginBottom: 12, flexWrap: 'wrap' }}>
            <span>Avg yield: <b style={{ color: data.summary.meets_target ? '#22c55e' : '#f87171' }}>
              {data.average_yield_pct}%</b></span>
            <span>Target: <b>{data.target_yield_pct}%</b></span>
            <span>Best: {data.summary.best_day?.date} ({data.summary.best_day?.yield_pct}%)</span>
            <span>Worst: {data.summary.worst_day?.date} ({data.summary.worst_day?.yield_pct}%)</span>
          </div>
          <div style={{ overflow: 'auto', border: '1px solid #1e293b', borderRadius: 6 }}>
            <svg width={W} height={H} style={{ background: '#0b1220' }}>
              {/* Y axes ticks */}
              {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
                <g key={i}>
                  <line x1={padL} x2={W - padR}
                    y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)}
                    stroke="#1e293b" />
                  <text x={padL - 6} y={padT + f * (H - padT - padB) + 4}
                    fill="#64748b" fontSize="10" textAnchor="end">
                    {Math.round((1 - f) * maxKg)}
                  </text>
                </g>
              ))}
              {/* Bars: planned (dim) + actual (bright) */}
              {series.map((s, i) => {
                const x = padL + i * xStep + 2;
                const barW = Math.max(2, xStep - 4);
                return (
                  <g key={i}>
                    <rect x={x} y={yScale(s.planned_kg)}
                      width={barW} height={H - padB - yScale(s.planned_kg)}
                      fill="#1e3a8a" opacity="0.55" />
                    <rect x={x + barW / 4} y={yScale(s.actual_kg)}
                      width={barW / 2} height={H - padB - yScale(s.actual_kg)}
                      fill="#22c55e" />
                  </g>
                );
              })}
              {/* Target line */}
              <line x1={padL} x2={W - padR}
                y1={yScalePct(data.target_yield_pct)} y2={yScalePct(data.target_yield_pct)}
                stroke="#facc15" strokeDasharray="4 4" />
              {/* Yield line */}
              <path d={yieldPath} fill="none" stroke="#f97316" strokeWidth="2" />
              {/* X axis dates: sample every Nth */}
              {series.filter((_, i) => i % Math.max(1, Math.floor(series.length / 8)) === 0)
                .map((s, j, arr) => {
                  const i = series.indexOf(s);
                  return (
                    <text key={j} x={padL + i * xStep + xStep / 2} y={H - padB + 14}
                      fill="#64748b" fontSize="9" textAnchor="middle"
                      transform={`rotate(-25 ${padL + i * xStep + xStep / 2} ${H - padB + 14})`}>
                      {s.date.substring(5)}
                    </text>
                  );
                })}
              {/* Legend */}
              <g transform={`translate(${padL},${H - 12})`}>
                <rect x={0} y={-8} width={10} height={10} fill="#1e3a8a" />
                <text x={14} y={1} fill="#cbd5e1" fontSize="10">Planned</text>
                <rect x={70} y={-8} width={10} height={10} fill="#22c55e" />
                <text x={84} y={1} fill="#cbd5e1" fontSize="10">Actual</text>
                <line x1={140} x2={156} y1={-3} y2={-3} stroke="#f97316" strokeWidth="2" />
                <text x={160} y={1} fill="#cbd5e1" fontSize="10">Yield %</text>
                <line x1={210} x2={226} y1={-3} y2={-3} stroke="#facc15" strokeDasharray="3 3" />
                <text x={230} y={1} fill="#cbd5e1" fontSize="10">Target</text>
              </g>
            </svg>
          </div>
        </>
      )}
    </div>
  );
}

export default ProductionYieldChart;
