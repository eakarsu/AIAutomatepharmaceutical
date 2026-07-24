import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { aiFeatures, documents } from '../services/api';

function CrossDocAnalysis() {
  const [allDocs, setAllDocs] = useState([]);
  const [selected, setSelected] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [docsPage, setDocsPage] = useState(1);
  const [docsPagination, setDocsPagination] = useState(null);
  const [docSearch, setDocSearch] = useState('');

  const loadDocs = async (page = 1, search = '') => {
    try {
      const r = await documents.list({ page, limit: 20, search });
      const payload = r.data;
      if (Array.isArray(payload)) {
        setAllDocs(payload);
        setDocsPagination(null);
      } else {
        setAllDocs(payload.data || []);
        setDocsPagination(payload.pagination || null);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadDocs(1); }, []);

  const handleSearch = (e) => {
    const s = e.target.value;
    setDocSearch(s);
    setDocsPage(1);
    loadDocs(1, s);
  };

  const changePage = (newPage) => {
    setDocsPage(newPage);
    loadDocs(newPage, docSearch);
  };

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((i) => i !== id) : [...s, id]));

  const run = async () => {
    if (selected.length < 2) { alert('Select at least 2 documents'); return; }
    setLoading(true);
    setResult(null);
    try {
      const r = await aiFeatures.crossDoc(selected);
      setResult(r.data);
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="main-content">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1>Cross-Document Analysis</h1>
        <p>Consistency check across related documents — flag contradictions and missing elements</p>
      </div>

      <div className="detail-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>Select Documents (minimum 2): {selected.length} selected</h3>
          <input
            type="text"
            placeholder="Search documents..."
            value={docSearch}
            onChange={handleSearch}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: '#0f172a', color: '#e2e8f0', width: 220 }}
          />
        </div>

        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {allDocs.length === 0 ? <p style={{ color: '#64748b' }}>No documents available.</p> : allDocs.map((d) => (
            <label key={d.id} style={{ display: 'block', padding: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggle(d.id)} />
              <span style={{ marginLeft: 8 }}>{d.title} <span style={{ color: '#64748b', fontSize: 12 }}>({d.category}, {d.status})</span></span>
            </label>
          ))}
        </div>

        {docsPagination && docsPagination.totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => changePage(docsPage - 1)} disabled={docsPage === 1}>&#x2190;</button>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Page {docsPage}/{docsPagination.totalPages} ({docsPagination.total} total)</span>
            <button className="btn btn-secondary btn-sm" onClick={() => changePage(docsPage + 1)} disabled={docsPage === docsPagination.totalPages}>&#x2192;</button>
          </div>
        )}

        <button className="btn btn-ai" onClick={run} disabled={loading || selected.length < 2} style={{ marginTop: 12 }}>
          {loading ? 'Analyzing...' : 'Run Cross-Document Analysis'}
        </button>
      </div>

      {result && (
        <div className="detail-card">
          <h3>Analysis Result</h3>
          <p style={{ fontSize: 12, color: '#64748b' }}>
            {result.documents.length} documents | Model: {result.model} | {result.tokens} tokens | {result.analyzed_at}
          </p>

          {result.structured?.overall_consistency_score !== undefined && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{ padding: '8px 16px', background: '#0f172a', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: result.structured.overall_consistency_score > 70 ? '#10b981' : result.structured.overall_consistency_score > 40 ? '#f59e0b' : '#ef4444' }}>
                  {result.structured.overall_consistency_score}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Consistency Score</div>
              </div>
              {result.structured.consistency_issues?.length > 0 && (
                <div style={{ flex: 1 }}>
                  <strong style={{ color: '#f59e0b', fontSize: 12 }}>Issues Found ({result.structured.consistency_issues.length})</strong>
                  <ul style={{ margin: '4px 0 0 16px', fontSize: 12, color: '#94a3b8' }}>
                    {result.structured.consistency_issues.slice(0, 3).map((i, idx) => <li key={idx}>{i.description}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="ai-output"><ReactMarkdown>{result.analysis}</ReactMarkdown></div>
        </div>
      )}
    </div>
  );
}

export default CrossDocAnalysis;
