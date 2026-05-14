import React, { useState, useEffect } from 'react';
import { aiFeatures } from '../services/api';

const empty = { title: '', description: '', category: '', regulatory_body: 'FDA', due_date: '', status: 'upcoming', priority: 'medium', assigned_to: '' };

function RegulatoryCalendar() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [predictForm, setPredictForm] = useState({ submission_type: 'NDA', target_date: '' });
  const [milestones, setMilestones] = useState(null);

  const load = () => aiFeatures.listRegEvents({ limit: 200 }).then((r) => {
    const payload = r.data;
    setItems(Array.isArray(payload) ? payload : (payload.data || []));
  }).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.title || !form.due_date) { alert('title + due_date required'); return; }
    setLoading(true);
    try {
      if (editing) await aiFeatures.updateRegEvent(editing, form);
      else await aiFeatures.createRegEvent(form);
      setEditing(null);
      setForm(empty);
      load();
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete event?')) return;
    await aiFeatures.deleteRegEvent(id);
    load();
  };

  const predict = async () => {
    setPredicting(true);
    setMilestones(null);
    try {
      const r = await aiFeatures.predictRegTimeline(predictForm);
      setMilestones(r.data);
    } catch (err) { alert(err.message); }
    finally { setPredicting(false); }
  };

  const sortedByDate = [...items].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  const today = new Date();
  const upcoming = sortedByDate.filter((e) => new Date(e.due_date) >= today);
  const past = sortedByDate.filter((e) => new Date(e.due_date) < today);

  return (
    <div className="main-content">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1>Regulatory Calendar</h1>
        <p>Submission deadlines and regulatory milestones with AI timeline prediction</p>
      </div>

      <div className="detail-card">
        <h3>{editing ? 'Edit Event' : 'New Event'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group"><label>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="form-group"><label>Due Date</label><input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
          <div className="form-group"><label>Category</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          <div className="form-group"><label>Regulatory Body</label>
            <select value={form.regulatory_body} onChange={(e) => setForm({ ...form, regulatory_body: e.target.value })}>
              <option>FDA</option><option>EMA</option><option>MHRA</option><option>PMDA</option><option>HC</option><option>Other</option>
            </select>
          </div>
          <div className="form-group"><label>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option>upcoming</option><option>in_progress</option><option>submitted</option><option>completed</option><option>overdue</option>
            </select>
          </div>
          <div className="form-group"><label>Priority</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option>low</option><option>medium</option><option>high</option><option>critical</option>
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Description</label><textarea rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Assigned To</label><input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} /></div>
        </div>
        <button className="btn btn-success btn-sm" onClick={save} disabled={loading}>{editing ? 'Update' : 'Create'}</button>
        {editing && <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={() => { setEditing(null); setForm(empty); }}>Cancel</button>}
      </div>

      <div className="detail-card">
        <h3>AI Milestone Timeline Prediction</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Submission Type</label>
            <select value={predictForm.submission_type} onChange={(e) => setPredictForm({ ...predictForm, submission_type: e.target.value })}>
              <option>NDA</option><option>ANDA</option><option>BLA</option><option>IND</option><option>510(k)</option><option>PMA</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Target Date (optional)</label><input type="date" value={predictForm.target_date} onChange={(e) => setPredictForm({ ...predictForm, target_date: e.target.value })} />
          </div>
          <button className="btn btn-ai btn-sm" onClick={predict} disabled={predicting}>{predicting ? 'Predicting...' : 'Predict Milestones'}</button>
        </div>
        {milestones && milestones.milestones && (
          <div style={{ marginTop: 16 }}>
            <h4>Predicted Milestones</h4>
            {milestones.milestones.map((m, i) => (
              <div key={i} style={{ padding: 8, marginBottom: 6, background: '#0f172a', borderRadius: 4 }}>
                <strong>{m.name}</strong> <span style={{ color: '#64748b', fontSize: 12 }}>(T-{m.weeks_before_target} weeks)</span>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{m.description}</div>
              </div>
            ))}
          </div>
        )}
        {milestones && milestones.raw && <pre style={{ marginTop: 12, fontSize: 11 }}>{milestones.raw}</pre>}
      </div>

      <div className="detail-card">
        <h3>Upcoming Events ({upcoming.length})</h3>
        <table className="doc-table" style={{ width: '100%' }}>
          <thead><tr><th>Due</th><th>Title</th><th>Body</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{upcoming.map((e) => (
            <tr key={e.id}>
              <td>{e.due_date}</td><td>{e.title}</td><td>{e.regulatory_body}</td>
              <td><span className={`priority-badge ${e.priority}`}>{e.priority}</span></td>
              <td><span className={`status-badge ${e.status}`}>{e.status}</span></td>
              <td>
                <button className="btn btn-primary btn-sm" onClick={() => { setEditing(e.id); setForm({ ...e, due_date: e.due_date.split('T')[0] }); }}>Edit</button>
                <button className="btn btn-danger btn-sm" style={{ marginLeft: 6 }} onClick={() => remove(e.id)}>Delete</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {past.length > 0 && (
        <div className="detail-card">
          <h3>Past Events ({past.length})</h3>
          <table className="doc-table" style={{ width: '100%' }}>
            <thead><tr><th>Due</th><th>Title</th><th>Status</th></tr></thead>
            <tbody>{past.slice(0, 20).map((e) => (
              <tr key={e.id}><td>{e.due_date}</td><td>{e.title}</td><td>{e.status}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RegulatoryCalendar;
