import React, { useEffect, useState } from 'react';
import { ai } from '../services/api';
import FormattedAIReport, { readableLabel } from './FormattedAIReport';

export default function SavedAIResults() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await ai.getResults({ page: 1, limit: 50 });
      const payload = response.data;
      setItems(Array.isArray(payload) ? payload : payload.data || []);
      setPagination(Array.isArray(payload) ? null : payload.pagination || null);
    } catch (failure) {
      setError(failure.response?.data?.error || failure.message || 'Saved AI results could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <p className="ai-muted" role="status">Loading saved AI results…</p>;
  if (error) return <div className="ai-alert" role="alert">{error}</div>;

  return <section className="ai-saved-results">
    <header className="ai-saved-results-heading">
      <div><h2>Saved AI results</h2><p className="ai-muted">Previously generated native analyses use the same readable report presentation.</p></div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Refresh</button>
    </header>
    {!items.length ? <p className="ai-muted">No saved AI results yet.</p> : <div className="ai-saved-results-list">
      {items.map((item) => <button type="button" className={`ai-history-row ${selected?.id === item.id ? 'is-selected' : ''}`} key={item.id} onClick={() => setSelected(selected?.id === item.id ? null : item)}>
        <span><strong>{readableLabel(item.analysis_type || 'AI result')}</strong><br /><small className="ai-muted">{item.created_at ? new Date(item.created_at).toLocaleString() : 'Saved result'}{item.document_id ? ` · Document ${item.document_id}` : ''}</small></span>
        <span>{selected?.id === item.id ? 'Close' : 'Open report →'}</span>
      </button>)}
    </div>}
    {pagination?.total > items.length && <p className="ai-muted">Showing the newest {items.length} of {pagination.total} saved results.</p>}
    {selected && <FormattedAIReport response={{ ...selected, parsed: selected.parsed_output }} title={readableLabel(selected.analysis_type || 'AI result')} />}
  </section>;
}
