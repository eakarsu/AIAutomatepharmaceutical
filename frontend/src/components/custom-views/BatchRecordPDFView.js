import React, { useState } from 'react';
import api from '../../services/api';

// NON-VIZ: Generate a GMP-style batch record PDF (base64) and offer download.
function BatchRecordPDFView() {
  const [form, setForm] = useState({
    batch_number: 'BATCH-2026-0142',
    product: 'Acetaminophen 500mg Film-Coated Tablets',
    operator: 'admin@pharma.com',
    facility: 'Plant-A',
    line: 'L2',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const generate = async () => {
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const r = await api.post('/custom-views/batch-record-pdf', form);
      setResult(r.data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!result?.pdf_base64) return;
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${result.pdf_base64}`;
    link.download = result.filename || 'batch_record.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fieldStyle = {
    padding: 8, borderRadius: 4, background: '#1e293b',
    color: '#e2e8f0', border: '1px solid #334155', width: '100%',
  };

  return (
    <div style={{ background: '#0f172a', borderRadius: 8, padding: 20, color: '#e2e8f0' }}>
      <h3 style={{ marginTop: 0, color: '#60a5fa' }}>GMP Batch Record - PDF</h3>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Generate a 21 CFR Part 211/Part 11 batch manufacturing record (BMR) as a downloadable PDF.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: '#94a3b8' }}>Batch Number
          <input value={form.batch_number} onChange={update('batch_number')} style={fieldStyle} />
        </label>
        <label style={{ fontSize: 12, color: '#94a3b8' }}>Product
          <input value={form.product} onChange={update('product')} style={fieldStyle} />
        </label>
        <label style={{ fontSize: 12, color: '#94a3b8' }}>Operator
          <input value={form.operator} onChange={update('operator')} style={fieldStyle} />
        </label>
        <label style={{ fontSize: 12, color: '#94a3b8' }}>Facility
          <input value={form.facility} onChange={update('facility')} style={fieldStyle} />
        </label>
        <label style={{ fontSize: 12, color: '#94a3b8' }}>Line
          <input value={form.line} onChange={update('line')} style={fieldStyle} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={generate} disabled={loading}
          style={{ padding: '10px 18px', borderRadius: 4, border: 0, background: '#3b82f6', color: '#fff', cursor: 'pointer' }}>
          {loading ? 'Generating...' : 'Generate PDF'}
        </button>
        {result && (
          <button onClick={download}
            style={{ padding: '10px 18px', borderRadius: 4, border: 0, background: '#22c55e', color: '#fff', cursor: 'pointer' }}>
            Download {result.filename}
          </button>
        )}
      </div>

      {err && <div style={{ color: '#f87171', marginTop: 12 }}>Error: {err}</div>}

      {result && (
        <div style={{ marginTop: 16, padding: 12, background: '#0b1220', borderRadius: 6, fontSize: 13 }}>
          <div>Generated at: <b>{result.generated_at}</b></div>
          <div>Filename: <b>{result.filename}</b></div>
          <div>Size: <b>{(result.size_bytes / 1024).toFixed(1)} KB</b></div>
          <div>Compliance: <b style={{ color: '#22c55e' }}>{result.cfr_part}</b></div>
          <div>GMP compliant: <b>{result.gmp_compliant ? 'Yes' : 'No'}</b></div>
          <div style={{ marginTop: 10 }}>
            <iframe
              title="Batch Record Preview"
              src={`data:application/pdf;base64,${result.pdf_base64}`}
              style={{ width: '100%', height: 480, border: '1px solid #334155', borderRadius: 4 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default BatchRecordPDFView;
