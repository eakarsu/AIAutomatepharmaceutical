import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { aiFeatures } from '../services/api';

const ANALYSIS_TYPES = [
  'summarize', 'compliance_check', 'extract', 'risk_assessment',
  'transcribe', 'report', 'cross_doc',
];

function PromptTemplates() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', analysis_type: 'summarize', system_prompt: '', user_prompt_template: '' });
  const [previewing, setPreviewing] = useState(null);
  const [sample, setSample] = useState('Title: Sample doc\nDescription: Test content...');
  const [previewResult, setPreviewResult] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = () => aiFeatures.listPromptTemplates({ limit: 100 }).then((r) => {
    const payload = r.data;
    setItems(Array.isArray(payload) ? payload : (payload.data || []));
  }).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.system_prompt) { alert('name + system_prompt required'); return; }
    try {
      if (editing) await aiFeatures.updatePromptTemplate(editing, form);
      else await aiFeatures.createPromptTemplate(form);
      setEditing(null);
      setForm({ name: '', analysis_type: 'summarize', system_prompt: '', user_prompt_template: '' });
      load();
    } catch (err) { alert('Save failed: ' + err.message); }
  };

  const startEdit = (it) => {
    setEditing(it.id);
    setForm({
      name: it.name,
      analysis_type: it.analysis_type,
      system_prompt: it.system_prompt,
      user_prompt_template: it.user_prompt_template || '',
    });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete template?')) return;
    await aiFeatures.deletePromptTemplate(id);
    load();
  };

  const runPreview = async (template) => {
    setPreviewing(template.id);
    setPreviewLoading(true);
    setPreviewResult('');
    try {
      const r = await aiFeatures.previewPrompt({
        system_prompt: template.system_prompt,
        sample_text: sample,
      });
      setPreviewResult(r.data.preview);
    } catch (err) {
      setPreviewResult('Error: ' + err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="main-content">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1>AI Prompt Templates</h1>
        <p>User-customizable system prompts per analysis type with live preview</p>
      </div>

      <div className="detail-card">
        <h3>{editing ? 'Edit Template' : 'New Template'}</h3>
        <div className="form-group"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="form-group"><label>Analysis Type</label>
          <select value={form.analysis_type} onChange={(e) => setForm({ ...form, analysis_type: e.target.value })}>
            {ANALYSIS_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
        </div>
        <div className="form-group"><label>System Prompt</label><textarea rows="5" value={form.system_prompt} onChange={(e) => setForm({ ...form, system_prompt: e.target.value })} /></div>
        <div className="form-group"><label>User Prompt Template (optional)</label><textarea rows="3" value={form.user_prompt_template} onChange={(e) => setForm({ ...form, user_prompt_template: e.target.value })} placeholder="Use {{field}} placeholders" /></div>
        <button className="btn btn-success btn-sm" onClick={save}>{editing ? 'Update' : 'Create'}</button>
        {editing && <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(null); setForm({ name: '', analysis_type: 'summarize', system_prompt: '', user_prompt_template: '' }); }} style={{ marginLeft: 8 }}>Cancel</button>}
      </div>

      <div className="detail-card">
        <h3>Saved Templates ({items.length})</h3>
        <div className="form-group">
          <label>Sample text to preview against</label>
          <textarea rows="3" value={sample} onChange={(e) => setSample(e.target.value)} />
        </div>
        {items.length === 0 ? <p style={{ color: '#64748b' }}>No templates yet</p> : items.map((it) => (
          <div key={it.id} style={{ padding: 16, marginBottom: 12, background: '#0f172a', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div><strong>{it.name}</strong> <span style={{ color: '#64748b', fontSize: 12 }}>({it.analysis_type})</span></div>
              <div>
                <button className="btn btn-ai btn-sm" onClick={() => runPreview(it)} disabled={previewLoading}>Preview</button>
                <button className="btn btn-primary btn-sm" onClick={() => startEdit(it)} style={{ marginLeft: 6 }}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(it.id)} style={{ marginLeft: 6 }}>Delete</button>
              </div>
            </div>
            <pre style={{ background: '#020617', padding: 8, borderRadius: 4, fontSize: 11, overflow: 'auto' }}>{it.system_prompt}</pre>
            {previewing === it.id && (
              <div className="ai-output" style={{ marginTop: 12 }}>
                {previewLoading ? <div className="ai-loading"><div className="spinner"></div>Running preview...</div> : <ReactMarkdown>{previewResult}</ReactMarkdown>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PromptTemplates;
