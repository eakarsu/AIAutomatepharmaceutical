// Apply pass 5 — surface /api/ext routes
import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function authHeaders() {
  const token = localStorage.getItem('pharma_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const SECTIONS = [
  {
    id: 'versions',
    title: 'Document Versions (additive)',
    method: 'POST',
    path: '/ext/document-versions/1',
    sample: { version_label: 'v1.0', change_summary: 'Initial draft', author_email: 'qa@example.com', snapshot: {} },
  },
  {
    id: 'comments',
    title: 'Document Comments (collab)',
    method: 'POST',
    path: '/ext/document-comments/1',
    sample: { author_email: 'qa@example.com', body: 'Please reconcile section 4.2 with current FDA guidance.' },
  },
  {
    id: 'esign',
    title: 'E-Sign Envelopes (NEEDS-CREDS: DOCUSIGN_API_KEY)',
    method: 'POST',
    path: '/ext/esign/envelopes',
    sample: { document_id: 1, signer_email: 'sponsor@example.com', subject: 'IND Cover Letter' },
  },
  {
    id: 'ctd',
    title: 'CTD Generation (PRODUCT-DECISION: ICH-CTD modules 1-5)',
    method: 'POST',
    path: '/ext/ctd/generate',
    sample: { application_type: 'IND', module_set: '1-5' },
  },
  {
    id: 'gateway',
    title: 'Regulatory Gateway Submit (NEEDS-CREDS: FDA_ESTAR_API_KEY / EMA_GATEWAY_API_KEY)',
    method: 'POST',
    path: '/ext/regulatory-gateway/submit',
    sample: { gateway: 'fda', payload: { application_id: 'IND-12345' } },
  },
  {
    id: 'ocr',
    title: 'OCR Trial Tables (TOO-RISKY → in-memory stub)',
    method: 'POST',
    path: '/ext/ocr-jobs',
    sample: { document_id: 1, page_range: '4-7' },
  },
];

export default function ExtensionsPage() {
  const [out, setOut] = useState({});
  const [busy, setBusy] = useState({});

  async function run(s) {
    setBusy({ ...busy, [s.id]: true });
    try {
      const url = `${API_BASE}${s.path}`;
      const res = await axios({ method: s.method, url, data: s.sample, headers: authHeaders(), validateStatus: () => true });
      setOut({ ...out, [s.id]: { status: res.status, body: res.data } });
    } catch (e) {
      setOut({ ...out, [s.id]: { status: 0, body: { error: e.message } } });
    } finally {
      setBusy({ ...busy, [s.id]: false });
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Backlog Extensions (Apply pass 5)</h2>
      <p style={{ color: '#666' }}>
        Each card calls a gated `/api/ext/*` endpoint. 503 means env vars
        missing; configure in the backend `.env` to enable.
      </p>
      {SECTIONS.map(s => (
        <div key={s.id} style={{ border: '1px solid #ddd', borderRadius: 6, padding: 12, margin: '12px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>{s.title}</strong>
            <button onClick={() => run(s)} disabled={busy[s.id]}>
              {busy[s.id] ? 'Calling…' : `Run ${s.method} ${s.path}`}
            </button>
          </div>
          <details>
            <summary>Sample payload</summary>
            <pre>{JSON.stringify(s.sample, null, 2)}</pre>
          </details>
          {out[s.id] && (
            <div>
              <div>HTTP <code>{out[s.id].status}</code></div>
              <pre>{JSON.stringify(out[s.id].body, null, 2)}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
