'use strict';
// Wave 26C feature-pack helpers: search/filter, export, tasks, deterministic AI fallback.
function filterRecords(rows, query = {}) {
  const q = String(query.q || query.search || '').trim().toLowerCase();
  const status = query.status ? String(query.status) : '';
  return (rows || []).filter((r) => {
    if (status && String(r.status ?? '') !== status) return false;
    if (query.priority !== undefined && String(r.priority ?? '') !== String(query.priority)) return false;
    if (!q) return true;
    return JSON.stringify(r).toLowerCase().includes(q);
  });
}
function toCSV(rows) {
  const list = rows || [];
  const headers = [...new Set(list.flatMap((r) => Object.keys(r || {})))];
  const esc = (v) => { const s = v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [headers.join(','), ...list.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n') + (list.length ? '\n' : '');
}
function sendExport(req, res, rows) {
  const filtered = filterRecords(rows, req.query);
  const format = String(req.query.format || 'json').toLowerCase();
  if (format === 'csv') { res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename="records.csv"'); return res.send(toCSV(filtered)); }
  res.setHeader('Content-Disposition', 'attachment; filename="records.json"'); return res.json(filtered);
}
const TASK_STATUSES = ['open', 'in_progress', 'done', 'blocked'];
function validateTaskInput(body = {}) { const title = String(body.title || '').trim(); if (!title) return { valid: false, error: 'title is required' }; const status = body.status ? String(body.status) : 'open'; if (!TASK_STATUSES.includes(status)) return { valid: false, error: 'invalid task status' }; return { valid: true, value: { title, status, priority: body.priority ? String(body.priority) : 'normal', notes: body.notes ? String(body.notes) : '', relatedId: body.relatedId ?? body.related_id ?? null } }; }
function summarize(records, labels) {
  const list = records || []; const byStatus = {}; let flagged = 0;
  for (const r of list) { const s = String(r.status ?? 'unknown'); byStatus[s] = (byStatus[s] || 0) + 1; const blob = JSON.stringify(r).toLowerCase(); if (/review|blocked|failed|stale|manual|high/.test(blob)) flagged += 1; }
  return { totalRecords: list.length, byStatus, flaggedForReview: flagged, hasRecords: list.length > 0, note: list.length ? labels.emptyNote : labels.emptyNote };
}
function aiFallback(feature, records, labels) { const s = summarize(records, labels); return { summary: `${labels.total}: ${s.totalRecords}`, totalRecords: s.totalRecords, byStatus: s.byStatus, flaggedForReview: s.flaggedForReview, hasRecords: s.hasRecords, recommendation: s.totalRecords === 0 ? 'Add records before relying on this analysis.' : 'Review flagged records first; deterministic counts only.', feature }; }
async function maybeCallProvider(feature, records, env = process.env, fetchImpl = global.fetch) {
  const key = env.OPENROUTER_API_KEY || env.OPENAI_API_KEY; if (!key) return null;
  const isOpenRouter = Boolean(env.OPENROUTER_API_KEY); const url = isOpenRouter ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
  const model = env.OPENROUTER_MODEL || env.OPENAI_MODEL || (isOpenRouter ? 'anthropic/claude-3-5-sonnet-20241022' : 'gpt-4o-mini');
  const resp = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'system', content: 'Return valid JSON only. Operational summary only; no diagnosis, prescribing or clinical claims.' }, { role: 'user', content: `Feature ${feature}. Summarize these records as JSON with labelled sections: ${JSON.stringify(records).slice(0, 6000)}` }], temperature: 0.2 }) });
  const data = await resp.json(); const text = data.choices?.[0]?.message?.content || ''; try { return { provider: isOpenRouter ? 'openrouter' : 'openai', model, data: JSON.parse(text.replace(/```json|```/g, '').trim()) }; } catch { return { provider: isOpenRouter ? 'openrouter' : 'openai', model, data: { summary: text } }; }
}
async function runAiFeature(feature, records, labels, env, fetchImpl) {
  try { const p = await maybeCallProvider(feature, records, env, fetchImpl); if (p) return { aiGenerated: true, provider: p.provider, model: p.model, data: p.data }; } catch (e) { return { aiGenerated: false, provider: null, fallbackReason: `Provider call failed: ${e.message}`, data: aiFallback(feature, records, labels) }; }
  return { aiGenerated: false, provider: null, fallbackReason: 'No OPENROUTER_API_KEY or OPENAI_API_KEY configured; deterministic fallback.', data: aiFallback(feature, records, labels) };
}
module.exports = { filterRecords, toCSV, sendExport, validateTaskInput, TASK_STATUSES, summarize, aiFallback, runAiFeature };
