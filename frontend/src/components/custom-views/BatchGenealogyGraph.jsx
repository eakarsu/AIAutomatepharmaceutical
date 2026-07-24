import React, { useState, useEffect } from 'react';
import api from '../../services/api';

// SVG-based genealogy DAG: stages laid out left->right, nodes per stage stacked vertically.
function BatchGenealogyGraph() {
  const [root, setRoot] = useState('BATCH-2026-0001');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await api.get('/custom-views/batch-genealogy', { params: { root } });
      setData(r.data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Layout
  const stageX = {};
  const colWidth = 220;
  const margin = 60;
  const nodeH = 70;
  const nodeW = 180;
  const stages = data?.stages || [];
  stages.forEach((s, i) => { stageX[s] = margin + i * colWidth; });

  const positions = {};
  if (data) {
    const byStage = {};
    data.nodes.forEach((n) => {
      if (!byStage[n.stage]) byStage[n.stage] = [];
      byStage[n.stage].push(n);
    });
    Object.entries(byStage).forEach(([stage, list]) => {
      list.forEach((n, i) => {
        positions[n.id] = {
          x: stageX[stage],
          y: margin + i * (nodeH + 20),
        };
      });
    });
  }

  const svgH = data
    ? Math.max(
        ...Object.values(positions).map((p) => p.y),
        0
      ) + nodeH + margin
    : 400;
  const svgW = margin * 2 + stages.length * colWidth;

  return (
    <div style={{ background: '#0f172a', borderRadius: 8, padding: 20, color: '#e2e8f0' }}>
      <h3 style={{ marginTop: 0, color: '#60a5fa' }}>Batch Genealogy Graph</h3>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Trace API → Intermediate → Bulk → Finished lineage with QC status overlays.
      </p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          value={root}
          onChange={(e) => setRoot(e.target.value)}
          placeholder="Root batch number"
          style={{
            padding: 8, borderRadius: 4, border: '1px solid #334155',
            background: '#1e293b', color: '#e2e8f0', minWidth: 260,
          }}
        />
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: '8px 16px', borderRadius: 4, border: 0,
            background: '#3b82f6', color: '#fff', cursor: 'pointer',
          }}
        >
          {loading ? 'Loading…' : 'Trace lineage'}
        </button>
      </div>
      {err && <div style={{ color: '#f87171' }}>Error: {err}</div>}
      {data && (
        <>
          <div style={{ display: 'flex', gap: 20, marginBottom: 12, fontSize: 13 }}>
            <span>Nodes: <b>{data.summary.total_nodes}</b></span>
            <span>Edges: <b>{data.summary.total_edges}</b></span>
            <span style={{ color: '#22c55e' }}>Released: {data.summary.released}</span>
            <span style={{ color: '#facc15' }}>Quarantined: {data.summary.quarantined}</span>
          </div>
          <div style={{ overflow: 'auto', border: '1px solid #1e293b', borderRadius: 6 }}>
            <svg width={svgW} height={svgH} style={{ background: '#0b1220' }}>
              {/* Stage labels */}
              {stages.map((s) => (
                <text
                  key={s} x={stageX[s] + nodeW / 2} y={30}
                  fill="#60a5fa" fontSize="13" textAnchor="middle" fontWeight="bold"
                >{s}</text>
              ))}
              {/* Edges */}
              {data.edges.map((e, i) => {
                const a = positions[e.from];
                const b = positions[e.to];
                if (!a || !b) return null;
                return (
                  <line
                    key={i}
                    x1={a.x + nodeW} y1={a.y + nodeH / 2}
                    x2={b.x} y2={b.y + nodeH / 2}
                    stroke="#475569" strokeWidth="1.2"
                  />
                );
              })}
              {/* Nodes */}
              {data.nodes.map((n) => {
                const p = positions[n.id];
                if (!p) return null;
                const fill = n.status === 'Released' ? '#065f46' : '#78350f';
                const stroke = n.qc_passed ? '#22c55e' : '#f87171';
                return (
                  <g key={n.id} transform={`translate(${p.x},${p.y})`}>
                    <rect width={nodeW} height={nodeH} rx="6"
                      fill={fill} stroke={stroke} strokeWidth="1.5" />
                    <text x={10} y={20} fill="#fff" fontSize="11" fontWeight="bold">{n.id}</text>
                    <text x={10} y={38} fill="#cbd5e1" fontSize="10">{n.label}</text>
                    <text x={10} y={54} fill="#94a3b8" fontSize="9">
                      {n.quantity_kg} kg · {n.status}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </>
      )}
    </div>
  );
}

export default BatchGenealogyGraph;
