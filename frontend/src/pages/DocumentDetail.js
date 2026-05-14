import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { documents, ai } from '../services/api';
import ReactMarkdown from 'react-markdown';

function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [aiResults, setAiResults] = useState({});
  const [aiLoading, setAiLoading] = useState({});

  useEffect(() => {
    documents.getById(id).then(r => {
      setDoc(r.data);
      setForm({ title: r.data.title, description: r.data.description, status: r.data.status, priority: r.data.priority });
    }).catch(() => navigate('/'));
  }, [id, navigate]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const { data } = await documents.update(id, form);
      setDoc(data);
      setEditing(false);
    } catch {
      alert('Error updating document');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) return;
    try {
      await documents.delete(id);
      navigate(`/feature/${doc.category}`);
    } catch {
      alert('Error deleting document');
    }
  };

  const runAi = async (type, label, fn) => {
    setAiLoading(prev => ({ ...prev, [type]: true }));
    try {
      const { data } = await fn(id);
      // Support both plain text and structured results
      const text = data.summary || data.analysis || data.extraction || data.assessment;
      const structured = data.structured || null;
      setAiResults(prev => ({ ...prev, [type]: { text, structured, model: data.model, tokens: data.tokens } }));
    } catch (err) {
      setAiResults(prev => ({ ...prev, [type]: { text: 'Error: Please check your OpenRouter API key in the .env file.', structured: null } }));
    } finally {
      setAiLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  if (!doc) return null;

  const metadata = typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : (doc.metadata || {});
  const metaEntries = Object.entries(metadata).filter(([k]) => !k.startsWith('ai_'));

  return (
    <div className="detail-page">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div className="page-header-left">
          <Link to={`/feature/${doc.category}`} className="back-btn">&#x2190;</Link>
          <div className="page-title">
            <h1 style={{ fontSize: '20px' }}>Document Details</h1>
            <p>{doc.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
          </div>
        </div>
      </div>

      <div className="detail-card">
        {editing ? (
          <form onSubmit={handleUpdate}>
            <div className="form-group">
              <label>Title</label>
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="completed">Completed</option>
                  <option value="approved">Approved</option>
                  <option value="submitted">Submitted</option>
                </select>
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div className="detail-actions" style={{ marginTop: '20px' }}>
              <button type="submit" className="btn btn-success btn-sm">Save Changes</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <div className="detail-header">
              <h1>{doc.title}</h1>
              <div className="detail-actions">
                <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>&#x270E; Edit</button>
                <button className="btn btn-danger btn-sm" onClick={handleDelete}>&#x1F5D1; Delete</button>
              </div>
            </div>

            <div className="detail-badges">
              <span className={`status-badge ${doc.status}`}>{doc.status.replace('_', ' ')}</span>
              <span className={`priority-badge ${doc.priority}`}>{doc.priority}</span>
            </div>

            <div className="detail-description">{doc.description}</div>

            {metaEntries.length > 0 && (
              <div className="detail-meta">
                {metaEntries.map(([key, value]) => (
                  <div className="meta-item" key={key}>
                    <span className="meta-label">{key.replace(/_/g, ' ')}</span>
                    <span className="meta-value">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ color: '#64748b', fontSize: '12px' }}>Created by: {doc.created_by}</span>
                <span style={{ color: '#334155' }}>|</span>
                <span style={{ color: '#64748b', fontSize: '12px' }}>Updated: {new Date(doc.updated_at).toLocaleString()}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* AI Actions */}
      <div className="detail-card">
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>&#x1F916;</span> AI Analysis Tools
        </h3>
        <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
          Use AI-powered analysis to summarize, check compliance, extract data, or assess risks for this document.
        </p>
        <div className="detail-actions">
          <button className="btn btn-ai btn-sm" onClick={() => runAi('summary', 'Summary', ai.summarize)} disabled={aiLoading.summary}>
            {aiLoading.summary ? 'Summarizing...' : '\u{1F4DD} AI Summary'}
          </button>
          <button className="btn btn-ai btn-sm" onClick={() => runAi('compliance', 'Compliance', ai.complianceCheck)} disabled={aiLoading.compliance}>
            {aiLoading.compliance ? 'Checking...' : '\u{1F3DB} Compliance Check'}
          </button>
          <button className="btn btn-ai btn-sm" onClick={() => runAi('extraction', 'Extraction', ai.extract)} disabled={aiLoading.extraction}>
            {aiLoading.extraction ? 'Extracting...' : '\u{1F4CB} Data Extraction'}
          </button>
          <button className="btn btn-ai btn-sm" onClick={() => runAi('risk', 'Risk', ai.riskAssessment)} disabled={aiLoading.risk}>
            {aiLoading.risk ? 'Assessing...' : '\u{26A0} Risk Assessment'}
          </button>
        </div>
      </div>

      {/* AI Results */}
      {Object.entries(aiResults).map(([type, result]) => (
        <div key={type} className="ai-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <h3>
              <span style={{ fontSize: '18px' }}>&#x2728;</span>
              AI {type.charAt(0).toUpperCase() + type.slice(1)} Result
            </h3>
            {result.model && (
              <span style={{ fontSize: 11, color: '#64748b' }}>{result.model} · {result.tokens} tokens</span>
            )}
          </div>

          {/* Structured data badges */}
          {result.structured && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {result.structured.compliance_status && (
                <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 99, background: result.structured.compliance_status === 'compliant' ? '#14532d' : result.structured.compliance_status === 'non_compliant' ? '#7f1d1d' : '#78350f', color: '#e2e8f0' }}>
                  {result.structured.compliance_status.replace('_', ' ')}
                </span>
              )}
              {result.structured.risk_level && (
                <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 99, background: '#1e1b4b', color: '#c7d2fe' }}>
                  Risk: {result.structured.risk_level}
                </span>
              )}
              {result.structured.risk_score !== undefined && (
                <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 99, background: '#0f172a', color: result.structured.risk_score > 70 ? '#ef4444' : result.structured.risk_score > 40 ? '#f59e0b' : '#10b981' }}>
                  Score: {result.structured.risk_score}
                </span>
              )}
            </div>
          )}

          {aiLoading[type] ? (
            <div className="ai-loading"><div className="spinner"></div>AI is analyzing...</div>
          ) : (
            <div className="ai-output">
              <ReactMarkdown>{result.text}</ReactMarkdown>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default DocumentDetail;
