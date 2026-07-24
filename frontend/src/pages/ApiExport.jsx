import React, { useState, useEffect } from 'react';
import { aiFeatures, documents, docExtended } from '../services/api';

function ApiExport() {
  const [allDocs, setAllDocs] = useState([]);
  const [docId, setDocId] = useState('');
  const [format, setFormat] = useState('fhir');
  const [exported, setExported] = useState(null);
  const [loading, setLoading] = useState(false);
  const [docSearch, setDocSearch] = useState('');

  const loadDocs = async (search = '') => {
    try {
      const r = await documents.list({ limit: 50, search });
      const payload = r.data;
      setAllDocs(Array.isArray(payload) ? payload : (payload.data || []));
    } catch (e) {
      // fallback to stats
      documents.getStats().then((r) => setAllDocs(r.data?.recentDocuments || [])).catch(() => {});
    }
  };

  useEffect(() => { loadDocs(); }, []);

  const run = async () => {
    if (!docId) return;
    setLoading(true);
    setExported(null);
    try {
      const r = await aiFeatures.exportDoc(docId, format);
      setExported({ format, data: r.data });
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };

  const download = () => {
    if (!exported) return;
    const ext = exported.format === 'hl7' ? 'hl7' : exported.format === 'fhir' ? 'json' : 'json';
    const mime = exported.format === 'hl7' ? 'text/plain' : 'application/json';
    const content = typeof exported.data === 'string' ? exported.data : JSON.stringify(exported.data, null, 2);
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `document-${docId}-${exported.format}.${ext}`;
    a.click();
  };

  const downloadPdf = () => {
    if (!docId) return;
    const url = docExtended.exportPdfUrl(docId);
    const token = localStorage.getItem('pharma_token');
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((b) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = `document-${docId}.pdf`;
        a.click();
      });
  };

  return (
    <div className="main-content">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1>API Export</h1>
        <p>Export documents in HL7, FHIR, JSON, or PDF formats for downstream systems</p>
      </div>

      <div className="detail-card">
        <div className="form-group"><label>Search Documents</label>
          <input value={docSearch} onChange={(e) => { setDocSearch(e.target.value); loadDocs(e.target.value); }} placeholder="Search by title..." />
        </div>
        <div className="form-group"><label>Document</label>
          <select value={docId} onChange={(e) => setDocId(e.target.value)}>
            <option value="">Select...</option>
            {allDocs.map((d) => (<option key={d.id} value={d.id}>{d.title} ({d.category})</option>))}
          </select>
        </div>
        <div className="form-group"><label>Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="fhir">FHIR (DocumentReference)</option>
            <option value="hl7">HL7 v2 (MDM T02)</option>
            <option value="json">JSON</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={run} disabled={loading || !docId}>{loading ? 'Exporting...' : 'Export'}</button>
        <button className="btn btn-secondary" style={{ marginLeft: 8 }} onClick={downloadPdf} disabled={!docId}>Download PDF</button>
      </div>

      {exported && (
        <div className="detail-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Export Preview ({exported.format.toUpperCase()})</h3>
            <button className="btn btn-success btn-sm" onClick={download}>Download</button>
          </div>
          <pre style={{ background: '#020617', padding: 16, borderRadius: 8, fontSize: 11, overflow: 'auto', maxHeight: 500 }}>
            {typeof exported.data === 'string' ? exported.data : JSON.stringify(exported.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default ApiExport;
