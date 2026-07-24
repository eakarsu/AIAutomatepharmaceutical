import React, { useEffect, useState } from 'react';

export default function CapaReadinessBoard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/capa-readiness-board').then((res) => res.json()).then(setData).catch(() => setData(null));
  }, []);
  return (
    <div className="page">
      <h1>CAPA Readiness Board</h1>
      <p>Track corrective actions, overdue owners, and inspection-ready evidence.</p>
      <div className="stats-grid">
        {data && Object.entries(data.summary).map(([key, value]) => <div className="stat-card" key={key}><span>{key.replaceAll('_', ' ')}</span><strong>{value}</strong></div>)}
      </div>
      <div className="card">
        {(data?.items || []).map((item) => <div key={item.id} style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}><strong>{item.id}</strong><div>{item.document} - {item.deviation} - {item.status}</div></div>)}
      </div>
    </div>
  );
}
