import React, { useState } from 'react';
import api from '../../services/api';

// Non-viz multi-step wizard: capture deviation -> classify -> CAPA + risk -> submit.
const STEPS = ['Identify', 'Classify', 'CAPA', 'Submit'];

function DeviationReportWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    batch_number: 'BATCH-2026-0001',
    step: 'Compression',
    observation: 'Tablet hardness below specification (avg 6.2 kp, target 8-12).',
    severity: 'Major',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await api.post('/custom-views/deviation-report', form);
      setResult(r.data);
      setStep(3);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: 8, marginTop: 4, borderRadius: 4,
    background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155',
  };

  return (
    <div style={{ background: '#0f172a', borderRadius: 8, padding: 20, color: '#e2e8f0' }}>
      <h3 style={{ marginTop: 0, color: '#60a5fa' }}>Deviation Report Wizard</h3>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Capture, classify, and route GMP deviations with CAPA + regulatory impact.
      </p>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{
            flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: 4,
            background: i === step ? '#3b82f6' : i < step ? '#065f46' : '#1e293b',
            color: '#fff', fontSize: 12,
          }}>{i + 1}. {s}</div>
        ))}
      </div>

      {step === 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ fontSize: 12 }}>Batch number
            <input value={form.batch_number} onChange={(e) => upd('batch_number', e.target.value)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 12 }}>Process step
            <input value={form.step} onChange={(e) => upd('step', e.target.value)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 12 }}>Observation
            <textarea value={form.observation} onChange={(e) => upd('observation', e.target.value)}
              rows={4} style={inputStyle} />
          </label>
        </div>
      )}

      {step === 1 && (
        <div>
          <label style={{ fontSize: 12 }}>Severity classification
            <select value={form.severity} onChange={(e) => upd('severity', e.target.value)} style={inputStyle}>
              <option value="Minor">Minor — documentation only</option>
              <option value="Major">Major — batch hold, QA review</option>
              <option value="Critical">Critical — quarantine, line halt, FDA field alert</option>
            </select>
          </label>
          <div style={{ marginTop: 16, padding: 12, background: '#1e293b', borderRadius: 6, fontSize: 13 }}>
            <b>Classification preview</b>
            <div style={{ marginTop: 6 }}>
              {form.severity === 'Critical' && 'Batch will be quarantined immediately. FDA & EMA notifications required.'}
              {form.severity === 'Major' && 'Batch placed on hold. QA shift lead notified. CAPA within 14 days.'}
              {form.severity === 'Minor' && 'Document under enhanced sampling. CAPA within 30 days.'}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ fontSize: 13 }}>
          <b>Confirm CAPA submission</b>
          <pre style={{
            background: '#1e293b', padding: 12, borderRadius: 6, marginTop: 8,
            color: '#cbd5e1', fontSize: 12, overflow: 'auto',
          }}>{JSON.stringify(form, null, 2)}</pre>
          <p style={{ color: '#94a3b8' }}>
            Submitting will generate a deviation ID, risk score, and CAPA plan, then route it to QA.
          </p>
        </div>
      )}

      {step === 3 && result && (
        <div style={{ fontSize: 13 }}>
          <div style={{ padding: 12, background: '#065f46', borderRadius: 6, marginBottom: 12 }}>
            <b>Deviation {result.deviation_id} created</b>
            <div>Risk score: {result.risk_score}/10 · Severity: {result.severity}</div>
          </div>
          <div style={{ padding: 12, background: '#1e293b', borderRadius: 6, marginBottom: 12 }}>
            <b>Immediate action:</b> {result.capa.immediate_action}
            <div style={{ marginTop: 8 }}><b>Root cause analysis:</b>
              <ul>{result.capa.root_cause_analysis.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
            <div><b>Preventive actions:</b>
              <ul>{result.capa.preventive_actions.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
            <div>Timeline: <b>{result.capa.timeline_days}</b> days</div>
          </div>
          <div style={{ padding: 12, background: '#1e293b', borderRadius: 6 }}>
            <b>Regulatory impact:</b>
            <ul>
              <li>FDA field alert: {result.regulatory_impact.fda_field_alert_required ? 'YES' : 'no'}</li>
              <li>EMA notification: {result.regulatory_impact.ema_notification_required ? 'YES' : 'no'}</li>
              <li>Classification: {result.regulatory_impact.gxp_classification}</li>
            </ul>
          </div>
        </div>
      )}

      {err && <div style={{ color: '#f87171', marginTop: 12 }}>Error: {err}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        {step > 0 && step < 3 && (
          <button onClick={() => setStep(step - 1)}
            style={{ padding: '8px 16px', borderRadius: 4, border: 0,
              background: '#475569', color: '#fff', cursor: 'pointer' }}>
            Back
          </button>
        )}
        {step < 2 && (
          <button onClick={() => setStep(step + 1)}
            style={{ padding: '8px 16px', borderRadius: 4, border: 0,
              background: '#3b82f6', color: '#fff', cursor: 'pointer' }}>
            Next
          </button>
        )}
        {step === 2 && (
          <button onClick={submit} disabled={loading}
            style={{ padding: '8px 16px', borderRadius: 4, border: 0,
              background: '#22c55e', color: '#fff', cursor: 'pointer' }}>
            {loading ? 'Submitting…' : 'Submit deviation'}
          </button>
        )}
        {step === 3 && (
          <button onClick={() => { setStep(0); setResult(null); }}
            style={{ padding: '8px 16px', borderRadius: 4, border: 0,
              background: '#3b82f6', color: '#fff', cursor: 'pointer' }}>
            Start new
          </button>
        )}
      </div>
    </div>
  );
}

export default DeviationReportWizard;
