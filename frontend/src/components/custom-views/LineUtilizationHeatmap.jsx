import React, { useState, useEffect } from 'react';
import api from '../../services/api';

// VIZ: SVG heatmap of facility line utilization (lines x days of week).
function LineUtilizationHeatmap() {
  const [facility, setFacility] = useState('Plant-A');
  const [weeks, setWeeks] = useState(4);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await api.get('/custom-views/line-utilization-heatmap', { params: { facility, weeks } });
      setData(r.data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Color scale: low (cool) -> high (warm)
  const colorFor = (v) => {
    const t = Math.max(0, Math.min(1, v / 100));
    // interp blue -> green -> yellow -> red
    if (t < 0.5) {
      // blue (#1e3a8a) -> green (#22c55e)
      const k = t / 0.5;
      const r = Math.round(30 + (34 - 30) * k);
      const g = Math.round(58 + (197 - 58) * k);
      const b = Math.round(138 + (94 - 138) * k);
      return `rgb(${r},${g},${b})`;
    }
    // green (#22c55e) -> red (#ef4444)
    const k = (t - 0.5) / 0.5;
    const r = Math.round(34 + (239 - 34) * k);
    const g = Math.round(197 + (68 - 197) * k);
    const b = Math.round(94 + (68 - 94) * k);
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div style={{ background: '#0f172a', borderRadius: 8, padding: 20, color: '#e2e8f0' }}>
      <h3 style={{ marginTop: 0, color: '#60a5fa' }}>Facility Line Utilization Heatmap</h3>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Daily % utilization for each production line. Hover cells for detail; warmer = busier.
      </p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={facility} onChange={(e) => setFacility(e.target.value)}
          style={{ padding: 8, borderRadius: 4, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }}>
          <option value="Plant-A">Plant-A (Solid Dosage)</option>
          <option value="Plant-B">Plant-B (Sterile Fill)</option>
          <option value="Plant-C">Plant-C (Biologics)</option>
        </select>
        <select value={weeks} onChange={(e) => setWeeks(parseInt(e.target.value, 10))}
          style={{ padding: 8, borderRadius: 4, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }}>
          <option value={1}>1 week</option>
          <option value={2}>2 weeks</option>
          <option value={4}>4 weeks</option>
          <option value={8}>8 weeks</option>
        </select>
        <button onClick={load} disabled={loading}
          style={{ padding: '8px 16px', borderRadius: 4, border: 0, background: '#3b82f6', color: '#fff', cursor: 'pointer' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      {err && <div style={{ color: '#f87171' }}>Error: {err}</div>}
      {data && (
        <>
          <div style={{ display: 'flex', gap: 18, fontSize: 13, marginBottom: 12, flexWrap: 'wrap' }}>
            <span>Avg utilization: <b>{data.summary.avg_utilization_pct}%</b></span>
            <span>Bottleneck: <b style={{ color: '#fbbf24' }}>{data.summary.bottleneck_line?.name}</b></span>
            <span>Idle cells: <b>{data.summary.idle_cells}</b></span>
          </div>
          <div style={{ overflow: 'auto', border: '1px solid #1e293b', borderRadius: 6, padding: 12, background: '#0b1220' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 4 }}>
              <thead>
                <tr>
                  <th style={{ color: '#94a3b8', fontSize: 11, padding: 6, textAlign: 'left' }}>Line</th>
                  {data.days.map((d) => (
                    <th key={d} style={{ color: '#94a3b8', fontSize: 11, padding: 6, textAlign: 'center', minWidth: 56 }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.lines.map((ln, li) => (
                  <tr key={ln.id}>
                    <td style={{ color: '#e2e8f0', fontSize: 12, padding: 6, whiteSpace: 'nowrap' }}>{ln.name}</td>
                    {data.matrix[li].map((v, di) => (
                      <td key={di} title={`${ln.name} / ${data.days[di]}: ${v}%`}
                        style={{
                          width: 56, height: 36, textAlign: 'center',
                          background: colorFor(v), color: v > 60 ? '#0b1220' : '#fff',
                          fontSize: 11, fontWeight: 600, borderRadius: 4,
                        }}>
                        {v.toFixed(0)}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#94a3b8' }}>
              <span>0%</span>
              <div style={{
                width: 220, height: 12, borderRadius: 6,
                background: 'linear-gradient(to right, rgb(30,58,138), rgb(34,197,94), rgb(239,68,68))'
              }} />
              <span>100%</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LineUtilizationHeatmap;
