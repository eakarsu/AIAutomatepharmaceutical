import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ai, documents } from '../services/api';

function AIToolsExtra() {
  const [tab, setTab] = useState('classify');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // classify-document state
  const [docs, setDocs] = useState([]);
  const [classifyDocId, setClassifyDocId] = useState('');

  // adverse-event-detect state
  const [aeForm, setAeForm] = useState({ document_id: '', narrative: '', patient_summary: '' });

  // manufacturing-deviation state
  const [mfForm, setMfForm] = useState({
    batch_id: '',
    batch_record: '',
    specifications_json: '{\n  "purity": ">= 99.0%",\n  "ph": "5.0-7.0"\n}',
    environment_data_json: '{\n  "temperature_c": 22.5,\n  "rh_percent": 45\n}'
  });

  useEffect(() => {
    documents.list({ page: 1, limit: 50 }).then((r) => {
      const payload = r.data;
      setDocs(Array.isArray(payload) ? payload : payload.data || []);
    }).catch(() => {});
  }, []);

  const wrap = async (fn) => {
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await fn();
      setResult(r.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const safeParse = (s, label) => {
    try { return JSON.parse(s); } catch (e) { setError(`Invalid JSON for ${label}: ${e.message}`); return null; }
  };

  const runClassify = () => {
    if (!classifyDocId) { setError('Select a document'); return; }
    wrap(() => ai.classifyDocument(classifyDocId));
  };

  const runAE = () => {
    if (!aeForm.narrative && !aeForm.document_id) { setError('Provide a narrative or document_id'); return; }
    wrap(() => ai.adverseEventDetect({
      document_id: aeForm.document_id || null,
      narrative: aeForm.narrative,
      patient_summary: aeForm.patient_summary,
    }));
  };

  const runMfg = () => {
    if (!mfForm.batch_record) { setError('batch_record is required'); return; }
    const specs = safeParse(mfForm.specifications_json || '{}', 'specifications');
    if (specs === null) return;
    const env = safeParse(mfForm.environment_data_json || '{}', 'environment_data');
    if (env === null) return;
    wrap(() => ai.manufacturingDeviation({
      batch_id: mfForm.batch_id,
      batch_record: mfForm.batch_record,
      specifications: specs,
      environment_data: env,
    }));
  };

  const tabs = [
    { key: 'classify', label: 'Document Classification' },
    { key: 'adverse',  label: 'Adverse Event Detection' },
    { key: 'mfg',      label: 'Manufacturing Deviation' },
  ];

  return (
    <div className="main-content">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1>Extra AI Tools</h1>
        <p>Document classification, pharmacovigilance, and GMP deviation flagging</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setError(null); setResult(null); }}
            className={`btn btn-${tab === t.key ? 'primary' : 'secondary'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="detail-card">
        {tab === 'classify' && (
          <>
            <h3>Classify Document (IND / NDA / BLA / ANDA / CTA / MAA / DMF)</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Document</label>
              <select value={classifyDocId} onChange={(e) => setClassifyDocId(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: '#0f172a', color: '#e2e8f0', minWidth: 320 }}>
                <option value="">Select...</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>{d.title} ({d.category})</option>
                ))}
              </select>
            </div>
            <button className="btn btn-ai" onClick={runClassify} disabled={loading}>
              {loading ? 'Classifying...' : 'Classify Document'}
            </button>
          </>
        )}

        {tab === 'adverse' && (
          <>
            <h3>Adverse Event Detection</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Existing document (optional)</label>
              <select value={aeForm.document_id} onChange={(e) => setAeForm({ ...aeForm, document_id: e.target.value })}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: '#0f172a', color: '#e2e8f0', minWidth: 320 }}>
                <option value="">— None (use narrative below) —</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Patient summary</label>
              <input type="text" value={aeForm.patient_summary}
                onChange={(e) => setAeForm({ ...aeForm, patient_summary: e.target.value })}
                placeholder="65 y/o female, on metformin"
                style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: '#0f172a', color: '#e2e8f0' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Narrative</label>
              <textarea rows={6} value={aeForm.narrative}
                onChange={(e) => setAeForm({ ...aeForm, narrative: e.target.value })}
                placeholder="Patient experienced sudden dyspnea..."
                style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: '#0f172a', color: '#e2e8f0' }} />
            </div>
            <button className="btn btn-ai" onClick={runAE} disabled={loading}>
              {loading ? 'Analyzing...' : 'Detect Adverse Events'}
            </button>
          </>
        )}

        {tab === 'mfg' && (
          <>
            <h3>Manufacturing Deviation Flagging (GMP)</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Batch ID</label>
              <input type="text" value={mfForm.batch_id}
                onChange={(e) => setMfForm({ ...mfForm, batch_id: e.target.value })}
                placeholder="LOT-2026-0042"
                style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: '#0f172a', color: '#e2e8f0' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Batch record (text or JSON)</label>
              <textarea rows={6} value={mfForm.batch_record}
                onChange={(e) => setMfForm({ ...mfForm, batch_record: e.target.value })}
                placeholder="Granulation step at 27 C, mixing time 14 min..."
                style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: '#0f172a', color: '#e2e8f0' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Specifications (JSON)</label>
              <textarea rows={4} value={mfForm.specifications_json}
                onChange={(e) => setMfForm({ ...mfForm, specifications_json: e.target.value })}
                style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: '#0f172a', color: '#e2e8f0' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Environment data (JSON)</label>
              <textarea rows={4} value={mfForm.environment_data_json}
                onChange={(e) => setMfForm({ ...mfForm, environment_data_json: e.target.value })}
                style={{ width: '100%', padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: '#0f172a', color: '#e2e8f0' }} />
            </div>
            <button className="btn btn-ai" onClick={runMfg} disabled={loading}>
              {loading ? 'Analyzing...' : 'Flag Deviations'}
            </button>
          </>
        )}

        {error && <p style={{ color: '#ef4444', marginTop: 12 }}>Error: {error}</p>}
      </div>

      {result && (
        <div className="detail-card">
          <h3>Result</h3>
          {result.summary && (
            <div className="ai-output"><ReactMarkdown>{result.summary}</ReactMarkdown></div>
          )}
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 600, overflow: 'auto', fontSize: 12, background: '#0f172a', padding: 12, borderRadius: 8 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default AIToolsExtra;
