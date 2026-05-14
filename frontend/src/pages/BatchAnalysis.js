import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ai, documents } from '../services/api';

function BatchAnalysis() {
  const [allDocs, setAllDocs] = useState([]);
  const [selected, setSelected] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [streamSteps, setStreamSteps] = useState([]);
  const [streamingId, setStreamingId] = useState(null);
  const [docsPage, setDocsPage] = useState(1);
  const [docsPagination, setDocsPagination] = useState(null);
  const [docSearch, setDocSearch] = useState('');
  const [docsLoading, setDocsLoading] = useState(false);
  const [digestResult, setDigestResult] = useState(null);
  const [digestLoading, setDigestLoading] = useState(false);

  const loadDocs = async (page = 1, search = '') => {
    setDocsLoading(true);
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
    } catch (e) {
      console.error(e);
    } finally {
      setDocsLoading(false);
    }
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

  const toggle = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((i) => i !== id) : [...s, id].slice(0, 10)));
  };

  const runBatch = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    setResults(null);
    try {
      const { data } = await ai.batchAnalyze(selected);
      setResults(data);
    } catch (err) {
      alert('Batch failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const runDigest = async () => {
    setDigestLoading(true);
    setDigestResult(null);
    try {
      const { data } = await ai.complianceDigest();
      setDigestResult(data);
    } catch (err) {
      alert('Digest failed: ' + err.message);
    } finally {
      setDigestLoading(false);
    }
  };

  const streamOne = (id) => {
    setStreamingId(id);
    setStreamSteps([]);
    const token = localStorage.getItem('pharma_token');
    const url = `${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/ai/analyze/stream?documentId=${id}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((res) => {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const read = () => {
        reader.read().then(({ done, value }) => {
          if (done) { setStreamingId(null); return; }
          const lines = decoder.decode(value).split('\n').filter((l) => l.startsWith('data:'));
          for (const line of lines) {
            try {
              const evt = JSON.parse(line.slice(5).trim());
              setStreamSteps((s) => [...s, evt]);
            } catch {}
          }
          read();
        });
      };
      read();
    });
  };

  return (
    <div className="main-content">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1>Batch AI Analysis</h1>
        <p>Queue up to 10 documents for parallel compliance analysis</p>
      </div>

      <div className="detail-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>Select Documents (max 10): {selected.length} selected</h3>
          <input
            type="text"
            placeholder="Search documents..."
            value={docSearch}
            onChange={handleSearch}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(148,163,184,0.2)', background: '#0f172a', color: '#e2e8f0', width: 220 }}
          />
        </div>

        {docsLoading ? (
          <p style={{ color: '#64748b' }}>Loading...</p>
        ) : allDocs.length === 0 ? (
          <p style={{ color: '#64748b' }}>No documents found.</p>
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {allDocs.map((d) => (
              <label key={d.id} style={{ display: 'block', padding: 8, borderRadius: 4, cursor: 'pointer', opacity: selected.length >= 10 && !selected.includes(d.id) ? 0.5 : 1 }}>
                <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggle(d.id)} disabled={selected.length >= 10 && !selected.includes(d.id)} />
                <span style={{ marginLeft: 8 }}>{d.title} <span style={{ color: '#64748b', fontSize: 12 }}>({d.category} · {d.status})</span></span>
              </label>
            ))}
          </div>
        )}

        {docsPagination && docsPagination.totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => changePage(docsPage - 1)} disabled={docsPage === 1}>&#x2190;</button>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Page {docsPage}/{docsPagination.totalPages} ({docsPagination.total} total)</span>
            <button className="btn btn-secondary btn-sm" onClick={() => changePage(docsPage + 1)} disabled={docsPage === docsPagination.totalPages}>&#x2192;</button>
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-ai" onClick={runBatch} disabled={loading || selected.length === 0}>
            {loading ? 'Processing batch...' : `Run Batch on ${selected.length} docs`}
          </button>
          {selected.length === 1 && (
            <button className="btn btn-secondary" onClick={() => streamOne(selected[0])} disabled={!!streamingId}>
              Stream One (SSE)
            </button>
          )}
          <button className="btn btn-primary" onClick={runDigest} disabled={digestLoading} style={{ marginLeft: 'auto' }}>
            {digestLoading ? 'Generating digest...' : '📋 Weekly Compliance Digest'}
          </button>
        </div>
      </div>

      {streamSteps.length > 0 && (
        <div className="detail-card">
          <h3>Stream Progress</h3>
          {streamSteps.map((s, i) => (
            <div key={i} style={{ padding: 4, fontSize: 13, color: s.type === 'error' ? '#ef4444' : s.type === 'complete' ? '#10b981' : '#94a3b8' }}>
              <strong>[{s.type}]</strong> {s.message || (s.type === 'complete' ? 'Analysis complete' : '')}
            </div>
          ))}
          {streamSteps.find(s => s.type === 'complete') && (() => {
            const c = streamSteps.find(s => s.type === 'complete');
            return (
              <div style={{ marginTop: 12 }}>
                {c.compliance_structured?.risk_level && (
                  <p style={{ fontSize: 12 }}>Risk level: <strong style={{ color: c.compliance_structured.risk_level === 'critical' ? '#ef4444' : '#f59e0b' }}>{c.compliance_structured.risk_level}</strong> | Score: {c.compliance_structured.risk_score}</p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {results && (
        <div className="detail-card">
          <h3>Batch Results: {results.successful}/{results.total} succeeded</h3>
          {results.results.map((r) => (
            <div key={r.document_id} style={{ marginBottom: 24, padding: 16, background: '#0f172a', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <h4>{r.title || `Doc #${r.document_id}`}</h4>
                {r.structured && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: r.structured.risk_level === 'critical' ? '#7f1d1d' : r.structured.risk_level === 'high' ? '#78350f' : '#14532d', color: '#e2e8f0' }}>
                      {r.structured.risk_level || 'unknown'}
                    </span>
                    {r.structured.risk_score !== undefined && (
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Score: {r.structured.risk_score}</span>
                    )}
                  </div>
                )}
              </div>
              <p style={{ fontSize: 12, color: '#64748b' }}>{r.category} · {r.model} · {r.tokens} tokens</p>
              {r.error ? (
                <p style={{ color: '#ef4444' }}>Error: {r.error}</p>
              ) : (
                <div className="ai-output"><ReactMarkdown>{r.analysis}</ReactMarkdown></div>
              )}
            </div>
          ))}
        </div>
      )}

      {digestResult && (
        <div className="detail-card">
          <h3>Weekly Compliance Digest ({digestResult.documentCount} documents)</h3>
          <p style={{ fontSize: 12, color: '#64748b' }}>Model: {digestResult.model} · {digestResult.tokens} tokens</p>
          {digestResult.structured?.key_concerns?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <strong style={{ color: '#ef4444' }}>Key Concerns:</strong>
              <ul style={{ margin: '4px 0 0 20px', fontSize: 13, color: '#94a3b8' }}>
                {digestResult.structured.key_concerns.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
          <div className="ai-output"><ReactMarkdown>{digestResult.digest}</ReactMarkdown></div>
        </div>
      )}
    </div>
  );
}

export default BatchAnalysis;
