import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { documents, ai } from '../services/api';
import ReactMarkdown from 'react-markdown';

const CATEGORY_INFO = {
  lab_results: { name: 'Lab Results', icon: '\u{1F9EA}' },
  fda_compliance: { name: 'FDA Compliance', icon: '\u{1F3DB}' },
  drug_trials: { name: 'Drug Trials', icon: '\u{1F489}' },
  regulatory_submissions: { name: 'Regulatory Submissions', icon: '\u{1F4CB}' },
  quality_control: { name: 'Quality Control', icon: '\u{2705}' },
  adverse_events: { name: 'Adverse Events', icon: '\u{26A0}' },
  manufacturing_records: { name: 'Manufacturing Records', icon: '\u{1F3ED}' },
  clinical_protocols: { name: 'Clinical Protocols', icon: '\u{1F4D1}' },
  drug_safety: { name: 'Drug Safety', icon: '\u{1F6E1}' },
  pharmacovigilance: { name: 'Pharmacovigilance', icon: '\u{1F50D}' },
  medical_literature: { name: 'Medical Literature', icon: '\u{1F4DA}' },
  sops: { name: 'SOPs', icon: '\u{1F4DD}' },
  audit_trail: { name: 'Audit Trail', icon: '\u{1F50E}' },
  supply_chain: { name: 'Supply Chain', icon: '\u{1F69A}' },
  patent_documents: { name: 'Patent Documents', icon: '\u{1F4DC}' },
};

function FeaturePage() {
  const { category } = useParams();
  const navigate = useNavigate();
  const [docs, setDocs] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showTranscribe, setShowTranscribe] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState('');
  const [transcribeText, setTranscribeText] = useState('');
  const [transcribeResult, setTranscribeResult] = useState('');
  const [transcribeLoading, setTranscribeLoading] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', status: 'draft', priority: 'medium' });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const LIMIT = 20;

  const info = CATEGORY_INFO[category] || { name: category, icon: '\u{1F4C4}' };

  const loadDocs = useCallback(() => {
    documents.getByCategory(category, search, page, LIMIT).then(r => {
      // Handle both paginated {data, pagination} and legacy array response
      if (Array.isArray(r.data)) {
        setDocs(r.data);
        setPagination(null);
      } else {
        setDocs(r.data.data || []);
        setPagination(r.data.pagination || null);
      }
    }).catch(() => {});
  }, [category, search, page]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await documents.create({ ...form, category });
      setShowModal(false);
      setForm({ title: '', description: '', status: 'draft', priority: 'medium' });
      loadDocs();
    } catch (err) {
      alert('Error creating document');
    }
  };

  const handleGenerateReport = async () => {
    setReportLoading(true);
    setReport('');
    try {
      const { data } = await ai.generateReport(category, 'comprehensive');
      setReport(data.report);
    } catch (err) {
      setReport('Error generating report. Please check your OpenRouter API key.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleTranscribe = async () => {
    if (!transcribeText.trim()) return;
    setTranscribeLoading(true);
    setTranscribeResult('');
    try {
      const { data } = await ai.transcribe(transcribeText, info.name);
      setTranscribeResult(data.formatted);
    } catch (err) {
      setTranscribeResult('Error transcribing. Please check your OpenRouter API key.');
    } finally {
      setTranscribeLoading(false);
    }
  };

  return (
    <div className="main-content">
      <div className="page-header">
        <div className="page-header-left">
          <Link to="/" className="back-btn">&#x2190;</Link>
          <div className="page-title">
            <h1>{info.icon} {info.name}</h1>
            <p>{pagination ? `${pagination.total} documents` : `${docs.length} documents`}</p>
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ai btn-sm" onClick={() => setShowTranscribe(!showTranscribe)}>
            &#x2728; AI Transcribe
          </button>
          <button className="btn btn-ai btn-sm" onClick={handleGenerateReport} disabled={reportLoading}>
            {reportLoading ? 'Generating...' : '\u{1F4CA} AI Report'}
          </button>
          <button className="btn btn-success btn-sm" onClick={() => setShowModal(true)}>
            + New Document
          </button>
        </div>
      </div>

      {showTranscribe && (
        <div className="transcribe-section">
          <h3>&#x2728; AI Document Transcribe & Format</h3>
          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
            Paste raw, unstructured text and our AI will professionally format it into a structured pharmaceutical document.
          </p>
          <div className="form-group">
            <textarea
              value={transcribeText}
              onChange={e => setTranscribeText(e.target.value)}
              placeholder="Paste raw text here... (e.g., handwritten notes, unformatted lab results, meeting minutes)"
              style={{ minHeight: '120px' }}
            />
          </div>
          <button className="btn btn-ai btn-sm" onClick={handleTranscribe} disabled={transcribeLoading}>
            {transcribeLoading ? 'Processing...' : 'Transcribe & Format'}
          </button>
          {transcribeLoading && (
            <div className="ai-loading"><div className="spinner"></div>AI is processing your text...</div>
          )}
          {transcribeResult && (
            <div className="ai-output" style={{ marginTop: '16px' }}>
              <ReactMarkdown>{transcribeResult}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {(report || reportLoading) && (
        <div className="ai-section" style={{ marginBottom: '24px' }}>
          <h3>&#x1F916; AI Generated Report</h3>
          {reportLoading ? (
            <div className="ai-loading"><div className="spinner"></div>Generating comprehensive report...</div>
          ) : (
            <div className="ai-output">
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      <div className="search-bar">
        <span className="search-icon">&#x1F50D;</span>
        <input
          type="text"
          placeholder={`Search ${info.name.toLowerCase()}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="doc-table">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Created By</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 ? (
              <tr>
                <td colSpan="5">
                  <div className="empty-state">
                    <div className="empty-icon">{info.icon}</div>
                    <h3>No documents found</h3>
                    <p>Create your first document or adjust your search.</p>
                  </div>
                </td>
              </tr>
            ) : (
              docs.map(doc => (
                <tr key={doc.id} onClick={() => navigate(`/document/${doc.id}`)}>
                  <td className="doc-title">{doc.title}</td>
                  <td><span className={`status-badge ${doc.status}`}>{doc.status.replace('_', ' ')}</span></td>
                  <td><span className={`priority-badge ${doc.priority}`}>{doc.priority}</span></td>
                  <td style={{ color: '#94a3b8', fontSize: '13px' }}>{doc.created_by}</td>
                  <td style={{ color: '#64748b', fontSize: '13px' }}>{new Date(doc.updated_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>&#x2190; Prev</button>
          <span style={{ lineHeight: '32px', color: '#94a3b8', fontSize: 13 }}>Page {page} of {pagination.totalPages}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}>Next &#x2192;</button>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>&#x2715;</button>
            <h2>New {info.name} Document</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Document title"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Document description"
                  required
                />
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
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-success">Create Document</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default FeaturePage;
