import React, { useState } from 'react';
import BatchYieldTrendChart from '../components/custom-views/BatchYieldTrendChart';
import LineUtilizationHeatmap from '../components/custom-views/LineUtilizationHeatmap';
import BatchRecordPDFView from '../components/custom-views/BatchRecordPDFView';
import RecipeEditor from '../components/custom-views/RecipeEditor';

// 4 GMP/manufacturing-automation views:
//   2 VIZ:     batch yield trend chart + facility/line utilization heatmap
//   2 NON-VIZ: GMP batch record PDF + recipe/formulation editor (CRUD)
const TABS = [
  { id: 'yield',     label: 'Batch Yield Trend',     component: BatchYieldTrendChart, group: 'VIZ' },
  { id: 'heatmap',   label: 'Line Utilization',      component: LineUtilizationHeatmap, group: 'VIZ' },
  { id: 'pdf',       label: 'GMP Batch Record PDF',  component: BatchRecordPDFView, group: 'NON-VIZ' },
  { id: 'recipes',   label: 'Recipe Editor',         component: RecipeEditor, group: 'NON-VIZ' },
];

function CustomViewsPage() {
  const [active, setActive] = useState('yield');
  const Active = TABS.find((t) => t.id === active).component;

  return (
    <div style={{ padding: 24, background: '#0b1220', minHeight: 'calc(100vh - 60px)' }}>
      <h1 style={{ color: '#e2e8f0', marginTop: 0 }} data-testid="gmp-views-title">GMP Views</h1>
      <p style={{ color: '#94a3b8', fontSize: 14 }}>
        Pharmaceutical manufacturing automation: batch yield trends, line utilization heatmaps,
        GMP batch record generation, and recipe/formulation editing.
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            data-testid={`tab-${t.id}`}
            style={{
              padding: '8px 14px', borderRadius: 6, border: 0,
              background: active === t.id ? '#3b82f6' : '#1e293b',
              color: '#fff', cursor: 'pointer', fontSize: 13,
            }}
          >
            <span style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 3, marginRight: 6,
              background: t.group === 'VIZ' ? '#16a34a' : '#9333ea', color: '#fff',
            }}>
              {t.group}
            </span>
            {t.label}
          </button>
        ))}
      </div>
      <Active />
    </div>
  );
}

export default CustomViewsPage;
