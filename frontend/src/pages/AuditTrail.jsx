import React, { useState, useEffect } from 'react';
import { aiFeatures } from '../services/api';

function AuditTrail() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ document_id: '', user_id: '' });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 20 };
      if (filters.document_id) params.document_id = filters.document_id;
      if (filters.user_id) params.user_id = filters.user_id;
      const r = await aiFeatures.auditTrail(params);
      const payload = r.data;
      if (Array.isArray(payload)) {
        setItems(payload);
        setPagination(null);
      } else {
        setItems(payload.data || []);
        setPagination(payload.pagination || null);
      }
    } catch (err) {
      alert('Load failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); /* eslint-disable-next-line */ }, []);

  const handleFilter = () => {
    setPage(1);
    load(1);
  };

  const changePage = (newPage) => {
    setPage(newPage);
    load(newPage);
  };

  return (
    <div className="main-content">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1>Document Audit Trail</h1>
        <p>Immutable log of all AI operations and document mutations</p>
      </div>

      <div className="detail-card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Document ID</label>
            <input value={filters.document_id} onChange={(e) => setFilters({ ...filters, document_id: e.target.value })} placeholder="Optional" />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>User ID / Email</label>
            <input value={filters.user_id} onChange={(e) => setFilters({ ...filters, user_id: e.target.value })} placeholder="Optional" />
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleFilter} disabled={loading}>{loading ? 'Loading...' : 'Filter'}</button>
        </div>

        {pagination && (
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
            {pagination.total} total entries | Page {page} of {pagination.totalPages}
          </p>
        )}

        <table className="doc-table" style={{ width: '100%' }}>
          <thead><tr><th>Time</th><th>Document</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>No audit entries</td></tr>
            ) : items.map((it) => (
              <tr key={it.id}>
                <td style={{ fontSize: 12 }}>{new Date(it.created_at || it.timestamp).toLocaleString()}</td>
                <td>{it.document_id}</td>
                <td>{it.user_id}</td>
                <td><span className={`status-badge ${it.action}`}>{it.action}</span></td>
                <td><pre style={{ fontSize: 10, margin: 0 }}>{JSON.stringify(typeof it.details === 'string' ? JSON.parse(it.details) : it.details, null, 0)}</pre></td>
              </tr>
            ))}
          </tbody>
        </table>

        {pagination && pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => changePage(page - 1)} disabled={page === 1}>&#x2190; Prev</button>
            <span style={{ lineHeight: '32px', color: '#94a3b8', fontSize: 13 }}>Page {page} of {pagination.totalPages}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => changePage(page + 1)} disabled={page === pagination.totalPages}>Next &#x2192;</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuditTrail;
