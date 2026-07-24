import React, { useState } from 'react';
import api from '../../services/api';

// Non-viz: generates a GMP batch manufacturing record PDF server-side.
function BatchRecordPDF() {
  const [batchNumber, setBatchNumber] = useState('BATCH-2026-0001');
  const [product, setProduct] = useState('Acetaminophen 500mg Tablets');
  const [operator, setOperator] = useState('admin@pharma.com');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const generate = async () => {
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const r = await api.post('/custom-views/batch-record-pdf', {
        batch_number: batchNumber, product, operator,
      });
      setResult(r.data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!result?.pdf_base64) return;
    const bin = atob(result.pdf_base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ background: '#0f172a', borderRadius: 8, padding: 20, color: '#e2e8f0' }}>
      <h3 style={{ marginTop: 0, color: '#60a5fa' }}>Batch Record PDF</h3>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Synthesize a 21 CFR Part 211–style batch manufacturing record (PDF, download-ready).
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 16 }}>
        <label style={{ fontSize: 12 }}>
          Batch number
          <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 4,
              background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }} />
        </label>
        <label style={{ fontSize: 12 }}>
          Product
          <input value={product} onChange={(e) => setProduct(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 4,
              background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }} />
        </label>
        <label style={{ fontSize: 12 }}>
          Operator
          <input value={operator} onChange={(e) => setOperator(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 4, borderRadius: 4,
              background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' }} />
        </label>
      </div>
      <button onClick={generate} disabled={loading}
        style={{ padding: '8px 16px', borderRadius: 4, border: 0,
          background: '#3b82f6', color: '#fff', cursor: 'pointer' }}>
        {loading ? 'Generating…' : 'Generate batch record'}
      </button>
      {err && <div style={{ color: '#f87171', marginTop: 12 }}>Error: {err}</div>}
      {result && (
        <div style={{ marginTop: 16, padding: 14, background: '#1e293b', borderRadius: 6 }}>
          <div style={{ fontSize: 13 }}>
            Generated <b>{result.filename}</b> · {result.size_bytes.toLocaleString()} bytes ·
            issued {new Date(result.generated_at).toLocaleString()}
          </div>
          <button onClick={download}
            style={{ marginTop: 10, padding: '6px 14px', borderRadius: 4, border: 0,
              background: '#22c55e', color: '#fff', cursor: 'pointer' }}>
            Download PDF
          </button>
        </div>
      )}
    </div>
  );
}

export default BatchRecordPDF;
