const express = require('express');
const { body, query, validationResult } = require('express-validator');
const fetch = require('node-fetch');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

// Pricing per 1K tokens (USD)
const TOKEN_PRICING = {
  'anthropic/claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'anthropic/claude-haiku-4.5': { input: 0.001, output: 0.005 },
  default: { input: 0.003, output: 0.015 },
};

// ─── parseAIJson helper ────────────────────────────────────────────────────
function parseAIJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) {}
  const stripped = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
  try { return JSON.parse(stripped); } catch (e) {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch (e) {}
  }
  return null;
}

async function callOpenRouter(systemPrompt, userPrompt, model = OPENROUTER_MODEL) {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not set');
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:3000',
      'X-Title': 'PharmaDocs AI',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'OpenRouter API error');

  const content = data.choices[0].message.content;
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;
  const totalTokens = data.usage?.total_tokens || 0;
  const pricing = TOKEN_PRICING[model] || TOKEN_PRICING.default;
  const costUsd = (inputTokens * pricing.input + outputTokens * pricing.output) / 1000;

  return { content, tokens: totalTokens, input_tokens: inputTokens, output_tokens: outputTokens, costUsd, model };
}

async function logUsage(userEmail, feature, aiResp) {
  try {
    await pool.query(
      `INSERT INTO ai_usage_log (user_email, feature, model, input_tokens, output_tokens, total_tokens, cost_usd)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userEmail, feature, aiResp.model, aiResp.input_tokens, aiResp.output_tokens, aiResp.tokens, aiResp.costUsd]
    );
  } catch (err) {
    console.error('logUsage error:', err.message);
  }
}

async function persistAiResult(documentId, analysisType, aiResp, parsedOutput, userEmail) {
  try {
    const pricing = TOKEN_PRICING[aiResp.model] || TOKEN_PRICING.default;
    const cost = ((aiResp.input_tokens || 0) * pricing.input + (aiResp.output_tokens || 0) * pricing.output) / 1000;
    await pool.query(
      `INSERT INTO ai_results (document_id, analysis_type, model, raw_output, parsed_output, input_tokens, output_tokens, cost_usd, user_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [documentId || null, analysisType, aiResp.model, aiResp.content, parsedOutput ? JSON.stringify(parsedOutput) : null, aiResp.input_tokens, aiResp.output_tokens, cost, userEmail || null]
    );
  } catch (err) {
    console.error('persistAiResult error:', err.message);
  }
}

// ─── Pagination helper ─────────────────────────────────────────────────────
function getPagination(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ========================================
// 1. Compliance Trend Dashboard (FIXED SQL)
// GET /api/ai-features/compliance-trends?category=...&days=30
// ========================================
router.get('/compliance-trends', authenticateToken, async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30));
    const { category } = req.query;

    const params = [days];
    let categoryFilter = '';
    if (category) {
      params.push(category);
      categoryFilter = `AND category = $${params.length}`;
    }

    const trends = await pool.query(
      `SELECT
         DATE_TRUNC('day', updated_at) as day,
         category,
         COUNT(*) as doc_count,
         COUNT(*) FILTER (WHERE priority = 'critical') as critical_count,
         COUNT(*) FILTER (WHERE priority = 'high') as high_count,
         COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
         COUNT(*) FILTER (WHERE status = 'review') as review_count
       FROM documents
       WHERE updated_at >= NOW() - ($1 || ' days')::INTERVAL ${categoryFilter}
       GROUP BY day, category
       ORDER BY day DESC`,
      params
    );

    const aggregateByDay = {};
    for (const row of trends.rows) {
      const d = row.day.toISOString().split('T')[0];
      if (!aggregateByDay[d]) {
        aggregateByDay[d] = { day: d, doc_count: 0, critical_count: 0, high_count: 0, approved_count: 0, review_count: 0, risk_score: 0 };
      }
      aggregateByDay[d].doc_count += parseInt(row.doc_count);
      aggregateByDay[d].critical_count += parseInt(row.critical_count);
      aggregateByDay[d].high_count += parseInt(row.high_count);
      aggregateByDay[d].approved_count += parseInt(row.approved_count);
      aggregateByDay[d].review_count += parseInt(row.review_count);
    }

    // Compute risk score (0-100): critical*10 + high*5 normalized
    for (const d in aggregateByDay) {
      const a = aggregateByDay[d];
      const raw = a.critical_count * 10 + a.high_count * 5;
      a.risk_score = a.doc_count > 0 ? Math.min(100, Math.round((raw / a.doc_count) * 5)) : 0;
    }

    res.json({
      period_days: days,
      category: category || 'all',
      timeline: Object.values(aggregateByDay).sort((a, b) => a.day.localeCompare(b.day)),
      raw: trends.rows,
    });
  } catch (err) {
    console.error('Compliance trends error:', err);
    res.status(500).json({ error: err.message });
  }
});

// AI anomaly detection on compliance trends (NEW)
router.post('/compliance-trends/analyze', authenticateToken, async (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(req.body.days) || 30));
    const params = [days];
    const trends = await pool.query(
      `SELECT
         DATE_TRUNC('day', updated_at) as day,
         COUNT(*) as doc_count,
         COUNT(*) FILTER (WHERE priority = 'critical') as critical_count,
         COUNT(*) FILTER (WHERE priority = 'high') as high_count
       FROM documents
       WHERE updated_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY day ORDER BY day ASC`,
      params
    );

    const timeline = trends.rows.map(r => ({
      day: r.day.toISOString().split('T')[0],
      doc_count: parseInt(r.doc_count),
      critical_count: parseInt(r.critical_count),
      high_count: parseInt(r.high_count),
      risk_score: Math.min(100, (parseInt(r.critical_count) * 10 + parseInt(r.high_count) * 5)),
    }));

    const aiResp = await callOpenRouter(
      `You are a pharmaceutical compliance analyst specializing in anomaly detection. Return ONLY valid JSON:
{"anomalies":[{"date":"YYYY-MM-DD","type":"spike|drop|sustained_high","risk_score":0,"description":""}],"root_cause_hypotheses":["hypothesis1"],"trend_direction":"improving|worsening|stable","recommended_actions":["action1"],"overall_risk_assessment":"low|medium|high|critical","analysis_summary":"<text>"}`,
      `Analyze this ${days}-day compliance risk timeline for anomalies:\n${JSON.stringify(timeline, null, 2)}`
    );

    const parsed = parseAIJson(aiResp.content) || { anomalies: [], root_cause_hypotheses: [], trend_direction: 'stable', recommended_actions: [], analysis_summary: aiResp.content };

    await persistAiResult(null, 'anomaly_detection', aiResp, parsed, req.user.email);
    await logUsage(req.user.email, 'anomaly_detection', aiResp);

    res.json({ timeline, anomalies: parsed, model: aiResp.model, tokens: aiResp.tokens });
  } catch (err) {
    console.error('Anomaly detection error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========================================
// 2. AI Prompt Templates - CRUD with pagination + validation
// ========================================
async function ensurePromptTemplatesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_prompt_templates (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      analysis_type VARCHAR(80) NOT NULL,
      system_prompt TEXT NOT NULL,
      user_prompt_template TEXT,
      created_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
}
ensurePromptTemplatesTable().catch(() => {});

router.get('/prompt-templates', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const countResult = await pool.query('SELECT COUNT(*) FROM ai_prompt_templates');
    const total = parseInt(countResult.rows[0].count);
    const r = await pool.query('SELECT * FROM ai_prompt_templates ORDER BY updated_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ data: r.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/prompt-templates', authenticateToken, [
  body('name').notEmpty().isLength({ max: 200 }).withMessage('name required, max 200 chars'),
  body('analysis_type').notEmpty().isLength({ max: 80 }).withMessage('analysis_type required, max 80 chars'),
  body('system_prompt').notEmpty().isLength({ max: 10000 }).withMessage('system_prompt required, max 10000 chars'),
  body('user_prompt_template').optional().isLength({ max: 5000 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { name, analysis_type, system_prompt, user_prompt_template } = req.body;
    const r = await pool.query(
      `INSERT INTO ai_prompt_templates (name, analysis_type, system_prompt, user_prompt_template, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, analysis_type, system_prompt, user_prompt_template || null, req.user.email || req.user.name]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/prompt-templates/:id', authenticateToken, [
  body('name').notEmpty().isLength({ max: 200 }).withMessage('name required, max 200 chars'),
  body('analysis_type').notEmpty().isLength({ max: 80 }).withMessage('analysis_type required'),
  body('system_prompt').notEmpty().isLength({ max: 10000 }).withMessage('system_prompt required'),
  body('user_prompt_template').optional().isLength({ max: 5000 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { name, analysis_type, system_prompt, user_prompt_template } = req.body;
    const r = await pool.query(
      `UPDATE ai_prompt_templates SET name=$1, analysis_type=$2, system_prompt=$3, user_prompt_template=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [name, analysis_type, system_prompt, user_prompt_template, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/prompt-templates/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM ai_prompt_templates WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Preview: run a custom prompt against sample text
router.post('/prompt-templates/preview', authenticateToken, [
  body('system_prompt').notEmpty().isLength({ max: 10000 }).withMessage('system_prompt required'),
  body('sample_text').notEmpty().isLength({ max: 20000 }).withMessage('sample_text required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { system_prompt, sample_text } = req.body;
    const result = await callOpenRouter(system_prompt, sample_text);
    const parsed = parseAIJson(result.content);
    await logUsage(req.user.email, 'prompt_preview', result);
    res.json({ preview: result.content, parsed, model: result.model, tokens: result.tokens });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========================================
// 3. Document Audit Trail with pagination (FIXED column name)
// GET /api/ai-features/audit-trail?document_id=...&page=1&limit=20
// ========================================
router.get('/audit-trail', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const { document_id, user_id } = req.query;
    const conditions = ['1=1'];
    const params = [];

    if (document_id) { params.push(document_id); conditions.push(`document_id = $${params.length}`); }
    if (user_id) { params.push(user_id); conditions.push(`user_id = $${params.length}`); }

    const where = conditions.join(' AND ');

    // Support both 'timestamp' and 'created_at' column names
    const colCheck = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='document_audit_log' AND column_name IN ('created_at','timestamp')`
    );
    const timeCol = colCheck.rows.find(r => r.column_name === 'created_at') ? 'created_at' :
                    colCheck.rows.find(r => r.column_name === 'timestamp') ? '"timestamp"' : 'NOW()';

    const countResult = await pool.query(`SELECT COUNT(*) FROM document_audit_log WHERE ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit); params.push(offset);
    const r = await pool.query(
      `SELECT *, ${timeCol} as created_at FROM document_audit_log WHERE ${where} ORDER BY ${timeCol} DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: r.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('audit-trail error:', err);
    res.json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  }
});

// ========================================
// 4. Regulatory Calendar with pagination + validation
// ========================================
async function ensureRegEventsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS regulatory_events (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100),
      regulatory_body VARCHAR(100),
      due_date DATE NOT NULL,
      status VARCHAR(50) DEFAULT 'upcoming',
      priority VARCHAR(20) DEFAULT 'medium',
      assigned_to VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
}
ensureRegEventsTable().catch(() => {});

router.get('/regulatory-calendar', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const { from, to } = req.query;
    const conditions = ['1=1'];
    const params = [];

    if (from) { params.push(from); conditions.push(`due_date >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`due_date <= $${params.length}`); }

    const where = conditions.join(' AND ');
    const countResult = await pool.query(`SELECT COUNT(*) FROM regulatory_events WHERE ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit); params.push(offset);
    const r = await pool.query(
      `SELECT * FROM regulatory_events WHERE ${where} ORDER BY due_date ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: r.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/regulatory-calendar', authenticateToken, [
  body('title').notEmpty().isLength({ max: 255 }).withMessage('title required, max 255 chars'),
  body('due_date').notEmpty().isISO8601().withMessage('due_date must be a valid date'),
  body('status').optional().isIn(['upcoming', 'in_progress', 'submitted', 'completed', 'overdue']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('regulatory_body').optional().isLength({ max: 100 }),
  body('category').optional().isLength({ max: 100 }),
  body('assigned_to').optional().isLength({ max: 255 }),
  body('description').optional().isLength({ max: 5000 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { title, description, category, regulatory_body, due_date, status, priority, assigned_to } = req.body;
    const r = await pool.query(
      `INSERT INTO regulatory_events (title, description, category, regulatory_body, due_date, status, priority, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, description, category, regulatory_body, due_date, status || 'upcoming', priority || 'medium', assigned_to]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/regulatory-calendar/:id', authenticateToken, [
  body('title').optional().isLength({ max: 255 }),
  body('due_date').optional().isISO8601().withMessage('due_date must be a valid date'),
  body('status').optional().isIn(['upcoming', 'in_progress', 'submitted', 'completed', 'overdue']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { title, description, category, regulatory_body, due_date, status, priority, assigned_to } = req.body;
    const r = await pool.query(
      `UPDATE regulatory_events SET
         title=COALESCE($1, title), description=COALESCE($2, description),
         category=COALESCE($3, category), regulatory_body=COALESCE($4, regulatory_body),
         due_date=COALESCE($5, due_date), status=COALESCE($6, status),
         priority=COALESCE($7, priority), assigned_to=COALESCE($8, assigned_to),
         updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [title, description, category, regulatory_body, due_date, status, priority, assigned_to, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/regulatory-calendar/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM regulatory_events WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI predict regulatory timeline
router.post('/regulatory-calendar/predict', authenticateToken, [
  body('submission_type').notEmpty().isLength({ max: 50 }).withMessage('submission_type required'),
  body('target_date').optional().isISO8601(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { submission_type, target_date } = req.body;
    const result = await callOpenRouter(
      `You are an FDA regulatory affairs expert. Return ONLY valid JSON:
{"milestones":[{"name":"<milestone>","weeks_before_target":<number>,"description":"<description>","responsible_party":"<team>"}],"total_timeline_weeks":<number>,"critical_path":["step1","step2"],"risk_factors":["risk1"]}`,
      `Predict the milestone timeline for a ${submission_type} submission${target_date ? ` targeting ${target_date}` : ''}.`
    );

    const parsed = parseAIJson(result.content) || { raw: result.content };
    await logUsage(req.user.email, 'regulatory_predict', result);

    res.json({ ...parsed, model: result.model, tokens: result.tokens });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========================================
// 5. Cross-Document Analysis with validation
// POST /api/ai-features/cross-document-analysis { document_ids: [...] }
// ========================================
router.post('/cross-document-analysis', authenticateToken, [
  body('document_ids').isArray({ min: 2, max: 20 }).withMessage('document_ids must be array of 2-20 ids'),
  body('document_ids.*').isInt({ min: 1 }).withMessage('each document_id must be a positive integer'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { document_ids } = req.body;
    const docs = await pool.query(
      'SELECT id, title, category, description, status FROM documents WHERE id = ANY($1::int[])',
      [document_ids]
    );
    if (docs.rows.length < 2) return res.status(404).json({ error: 'Need at least 2 valid documents' });

    const summary = docs.rows
      .map((d, i) => `Doc ${i + 1} [${d.id}] (${d.category}, ${d.status}): ${d.title}\n${d.description || '(no description)'}`)
      .join('\n\n');

    const result = await callOpenRouter(
      `You are a pharmaceutical consistency checker. Return ONLY valid JSON:
{"consistency_issues":[{"type":"contradiction|missing_element|conflicting_statement","description":"","affected_doc_ids":[0]}],"missing_elements":["element1"],"recommendations":["rec1"],"overall_consistency_score":0-100,"analysis_text":"<full markdown>"}`,
      `Analyze these ${docs.rows.length} pharmaceutical documents for consistency:\n\n${summary}`
    );

    const parsed = parseAIJson(result.content) || { consistency_issues: [], missing_elements: [], recommendations: [], overall_consistency_score: 0, analysis_text: result.content };

    await persistAiResult(null, 'cross_document', result, parsed, req.user.email);
    await logUsage(req.user.email, 'cross_document', result);

    res.json({
      documents: docs.rows.map((d) => ({ id: d.id, title: d.title, category: d.category })),
      analysis: parsed.analysis_text || result.content,
      structured: parsed,
      tokens: result.tokens,
      model: result.model,
      analyzed_at: new Date().toISOString(),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========================================
// 6. API Export (HL7 / FHIR / JSON)
// ========================================
router.get('/export/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;
    const r = await pool.query('SELECT * FROM documents WHERE id=$1', [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    const doc = r.rows[0];

    if (format === 'fhir') {
      const fhirResource = {
        resourceType: 'DocumentReference',
        id: String(doc.id),
        status: doc.status === 'approved' ? 'current' : 'draft',
        type: { text: doc.category },
        date: doc.created_at,
        description: doc.description,
        category: [{ text: doc.category }],
        author: [{ display: doc.created_by }],
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: Buffer.from(doc.description || '').toString('base64'),
            title: doc.title,
          },
        }],
        meta: { lastUpdated: doc.updated_at, source: 'PharmaDocs AI', tag: [{ code: doc.priority }] },
      };
      res.setHeader('Content-Type', 'application/fhir+json');
      return res.json(fhirResource);
    }

    if (format === 'hl7') {
      const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const hl7 = [
        `MSH|^~\\&|PHARMADOCS|AI|RECEIVER|HOST|${ts}||MDM^T02|${doc.id}|P|2.5`,
        `EVN|T02|${ts}`,
        `PID|||DOC${doc.id}^^^PHARMADOCS^MR||${(doc.title || '').replace(/\|/g, ' ')}`,
        `TXA|1|${doc.category}|TX|${ts}|||${doc.created_by || 'unknown'}|||||${doc.id}|${doc.status}|AU`,
        `OBX|1|TX|DESC^Description||${(doc.description || '').replace(/\|/g, ' ').replace(/\n/g, '~')}|||N`,
      ].join('\n');
      res.setHeader('Content-Type', 'text/plain');
      return res.send(hl7);
    }

    res.json({ format: 'json', document: doc, exported_at: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========================================
// 7. Cost Analytics with pagination
// ========================================
async function ensureAiUsageTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_usage_log (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255),
      feature VARCHAR(80),
      department VARCHAR(80),
      model VARCHAR(120),
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      cost_usd NUMERIC(10,6) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}
ensureAiUsageTable().catch(() => {});

router.get('/cost-analytics', authenticateToken, async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30));

    const usage = await pool.query(
      `SELECT feature, model, COUNT(*) as call_count, SUM(input_tokens) as input_tokens,
         SUM(output_tokens) as output_tokens, SUM(total_tokens) as total_tokens, SUM(cost_usd) as total_cost
       FROM ai_usage_log
       WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY feature, model ORDER BY total_cost DESC`,
      [days]
    );

    const byUser = await pool.query(
      `SELECT user_email, COUNT(*) as call_count, SUM(total_tokens) as total_tokens, SUM(cost_usd) as total_cost
       FROM ai_usage_log
       WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY user_email ORDER BY total_cost DESC LIMIT 20`,
      [days]
    );

    const byDay = await pool.query(
      `SELECT DATE_TRUNC('day', created_at) as day, COUNT(*) as call_count,
         SUM(total_tokens) as total_tokens, SUM(cost_usd) as total_cost
       FROM ai_usage_log
       WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
       GROUP BY day ORDER BY day ASC`,
      [days]
    );

    const totalCost = usage.rows.reduce((a, r) => a + parseFloat(r.total_cost || 0), 0);
    const totalCalls = usage.rows.reduce((a, r) => a + parseInt(r.call_count || 0), 0);
    const totalTokens = usage.rows.reduce((a, r) => a + parseInt(r.total_tokens || 0), 0);

    res.json({
      period_days: days,
      summary: {
        total_cost_usd: parseFloat(totalCost.toFixed(4)),
        total_calls: totalCalls,
        total_tokens: totalTokens,
        avg_cost_per_call: totalCalls ? parseFloat((totalCost / totalCalls).toFixed(4)) : 0,
      },
      by_feature_model: usage.rows,
      by_user: byUser.rows,
      by_day: byDay.rows,
      pricing: TOKEN_PRICING,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Log a usage event
router.post('/cost-analytics/log', authenticateToken, [
  body('feature').notEmpty().isLength({ max: 80 }).withMessage('feature required'),
  body('model').notEmpty().isLength({ max: 120 }).withMessage('model required'),
  body('input_tokens').isInt({ min: 0 }),
  body('output_tokens').isInt({ min: 0 }),
  body('department').optional().isLength({ max: 80 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { feature, department, model, input_tokens, output_tokens } = req.body;
    const m = TOKEN_PRICING[model] || TOKEN_PRICING.default;
    const cost = ((input_tokens || 0) * m.input + (output_tokens || 0) * m.output) / 1000;
    const r = await pool.query(
      `INSERT INTO ai_usage_log (user_email, feature, department, model, input_tokens, output_tokens, total_tokens, cost_usd)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.email, feature, department, model, input_tokens, output_tokens, (input_tokens || 0) + (output_tokens || 0), cost]
    );
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
