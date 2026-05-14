const express = require('express');
const { body, query, validationResult } = require('express-validator');
const fetch = require('node-fetch');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

const TOKEN_PRICING = {
  'anthropic/claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'anthropic/claude-haiku-4.5': { input: 0.001, output: 0.005 },
  default: { input: 0.003, output: 0.015 },
};

const PHARMA_CATEGORIES = [
  'clinical_trials', 'regulatory', 'manufacturing', 'quality_control',
  'pharmacovigilance', 'labeling', 'submissions', 'sops', 'validation',
  'audit_reports', 'drug_substances', 'biologics', 'formulation',
  'stability', 'preclinical', 'medical_affairs', 'pharmacokinetics',
  // frontend-facing categories
  'lab_results', 'fda_compliance', 'drug_trials', 'regulatory_submissions',
  'adverse_events', 'manufacturing_records', 'clinical_protocols', 'drug_safety',
  'medical_literature', 'audit_trail', 'supply_chain', 'patent_documents',
];

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

// ─── OpenRouter call ───────────────────────────────────────────────────────
async function callOpenRouter(systemPrompt, userPrompt, model = OPENROUTER_MODEL) {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not configured');
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
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

  return { content, inputTokens, outputTokens, totalTokens, costUsd, model };
}

// ─── Persist AI result ─────────────────────────────────────────────────────
async function persistAiResult(documentId, analysisType, aiResponse, parsedOutput, userEmail) {
  try {
    const r = await pool.query(
      `INSERT INTO ai_results
         (document_id, analysis_type, model, raw_output, parsed_output, input_tokens, output_tokens, cost_usd, user_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        documentId || null,
        analysisType,
        aiResponse.model,
        aiResponse.content,
        parsedOutput ? JSON.stringify(parsedOutput) : null,
        aiResponse.inputTokens,
        aiResponse.outputTokens,
        aiResponse.costUsd,
        userEmail || null,
      ]
    );
    return r.rows[0].id;
  } catch (err) {
    console.error('persistAiResult error:', err.message);
    return null;
  }
}

// ─── Log token usage ───────────────────────────────────────────────────────
async function logUsage(userEmail, feature, aiResponse) {
  try {
    await pool.query(
      `INSERT INTO ai_usage_log (user_email, feature, model, input_tokens, output_tokens, total_tokens, cost_usd)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userEmail, feature, aiResponse.model, aiResponse.inputTokens, aiResponse.outputTokens, aiResponse.totalTokens, aiResponse.costUsd]
    );
  } catch (err) {
    console.error('logUsage error:', err.message);
  }
}

// ─── Summarize document ────────────────────────────────────────────────────
router.post('/summarize/:id', authenticateToken, async (req, res) => {
  try {
    const doc = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Document not found' });

    const document = doc.rows[0];
    const aiResp = await callOpenRouter(
      `You are an expert pharmaceutical document analyst. Summarize the document and return ONLY valid JSON in this exact format:
{"summary_text":"<markdown summary with ## headers and bullet points>","key_points":["point1","point2"],"document_type":"<type>","confidence":"high|medium|low"}`,
      `Document to summarize:\nTitle: ${document.title}\nCategory: ${document.category}\nDescription: ${document.description}\nMetadata: ${JSON.stringify(document.metadata)}`
    );

    const parsed = parseAIJson(aiResp.content) || { summary_text: aiResp.content, key_points: [], document_type: document.category, confidence: 'medium' };

    await pool.query(
      'UPDATE documents SET metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{ai_summary}\', $1) WHERE id = $2',
      [JSON.stringify(parsed.summary_text || aiResp.content), document.id]
    );

    await persistAiResult(document.id, 'summarize', aiResp, parsed, req.user.email);
    await logUsage(req.user.email, 'summarize', aiResp);

    res.json({ summary: parsed.summary_text || aiResp.content, structured: parsed, document_id: document.id, model: aiResp.model, tokens: aiResp.totalTokens });
  } catch (err) {
    console.error('AI Summarize error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Compliance check ──────────────────────────────────────────────────────
router.post('/compliance-check/:id', authenticateToken, async (req, res) => {
  try {
    const doc = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Document not found' });

    const document = doc.rows[0];
    const aiResp = await callOpenRouter(
      `You are an FDA compliance expert for pharmaceutical companies. Analyze the document and return ONLY valid JSON:
{"compliance_status":"compliant|non_compliant|partially_compliant","risk_level":"low|medium|high|critical","risk_score":0-100,"findings":["finding1","finding2"],"recommendations":["rec1","rec2"],"applicable_regulations":["21 CFR 211","ICH Q10"],"analysis_text":"<detailed markdown>"}`,
      `Analyze for FDA compliance:\nTitle: ${document.title}\nCategory: ${document.category}\nDescription: ${document.description}\nStatus: ${document.status}\nMetadata: ${JSON.stringify(document.metadata)}`
    );

    const parsed = parseAIJson(aiResp.content) || { compliance_status: 'unknown', risk_level: 'medium', risk_score: 50, findings: [], recommendations: [], applicable_regulations: [], analysis_text: aiResp.content };

    await pool.query(
      'UPDATE documents SET metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{ai_compliance}\', $1) WHERE id = $2',
      [JSON.stringify(parsed.analysis_text || aiResp.content), document.id]
    );

    await persistAiResult(document.id, 'compliance_check', aiResp, parsed, req.user.email);
    await logUsage(req.user.email, 'compliance_check', aiResp);

    res.json({ analysis: parsed.analysis_text || aiResp.content, structured: parsed, document_id: document.id, model: aiResp.model, tokens: aiResp.totalTokens });
  } catch (err) {
    console.error('AI Compliance error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Extract key data ──────────────────────────────────────────────────────
router.post('/extract/:id', authenticateToken, async (req, res) => {
  try {
    const doc = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Document not found' });

    const document = doc.rows[0];
    const aiResp = await callOpenRouter(
      `You are a pharmaceutical data extraction specialist. Extract structured data and return ONLY valid JSON:
{"key_data_points":{"key":"value"},"critical_values":["value1"],"observations":["obs1"],"action_items":["action1"],"extraction_text":"<detailed markdown with tables>"}`,
      `Extract key data from:\nTitle: ${document.title}\nCategory: ${document.category}\nDescription: ${document.description}\nMetadata: ${JSON.stringify(document.metadata)}`
    );

    const parsed = parseAIJson(aiResp.content) || { key_data_points: {}, critical_values: [], observations: [], action_items: [], extraction_text: aiResp.content };

    await pool.query(
      'UPDATE documents SET metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{ai_extraction}\', $1) WHERE id = $2',
      [JSON.stringify(parsed.extraction_text || aiResp.content), document.id]
    );

    await persistAiResult(document.id, 'extract', aiResp, parsed, req.user.email);
    await logUsage(req.user.email, 'extract', aiResp);

    res.json({ extraction: parsed.extraction_text || aiResp.content, structured: parsed, document_id: document.id, model: aiResp.model, tokens: aiResp.totalTokens });
  } catch (err) {
    console.error('AI Extract error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Generate report ───────────────────────────────────────────────────────
router.post('/generate-report', authenticateToken, [
  body('category').isIn(PHARMA_CATEGORIES).withMessage('category must be a valid pharmaceutical category'),
  body('reportType').optional().isString().isLength({ max: 80 }),
  body('content').optional().isLength({ max: 50000 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { category, reportType } = req.body;
    const docs = await pool.query(
      'SELECT title, description, status, priority, metadata FROM documents WHERE category = $1 ORDER BY updated_at DESC LIMIT 20',
      [category]
    );

    const aiResp = await callOpenRouter(
      `You are a pharmaceutical report generation expert. Return ONLY valid JSON:
{"executive_summary":"<text>","detailed_findings":["finding1"],"statistical_overview":{"total_docs":0,"by_status":{}},"recommendations":["rec1"],"conclusion":"<text>","report_text":"<full markdown report>"}`,
      `Generate a ${reportType || 'summary'} report for ${category} documents:\n\n${docs.rows.map((d, i) => `${i + 1}. ${d.title}: ${d.description} (Status: ${d.status}, Priority: ${d.priority})`).join('\n')}`
    );

    const parsed = parseAIJson(aiResp.content) || { report_text: aiResp.content, executive_summary: '', detailed_findings: [], recommendations: [], conclusion: '' };

    await persistAiResult(null, 'generate_report', aiResp, parsed, req.user.email);
    await logUsage(req.user.email, 'generate_report', aiResp);

    res.json({ report: parsed.report_text || aiResp.content, structured: parsed, category, documentCount: docs.rows.length, model: aiResp.model, tokens: aiResp.totalTokens });
  } catch (err) {
    console.error('AI Report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Transcribe / format ───────────────────────────────────────────────────
router.post('/transcribe', authenticateToken, [
  body('rawText').notEmpty().withMessage('rawText is required').isLength({ max: 50000 }),
  body('documentType').optional().isString().isLength({ max: 100 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const { rawText, documentType } = req.body;

    const aiResp = await callOpenRouter(
      `You are a pharmaceutical document formatting specialist. Return ONLY valid JSON:
{"formatted_text":"<professionally formatted document in markdown>","document_title":"<suggested title>","suggested_category":"<category>","sections":["section1"]}`,
      `Transcribe and professionally format this raw pharmaceutical text into a structured ${documentType || 'general'} document:\n\n${rawText}`
    );

    const parsed = parseAIJson(aiResp.content) || { formatted_text: aiResp.content, document_title: '', suggested_category: documentType || '' };

    await persistAiResult(null, 'transcribe', aiResp, parsed, req.user.email);
    await logUsage(req.user.email, 'transcribe', aiResp);

    res.json({ formatted: parsed.formatted_text || aiResp.content, structured: parsed, type: documentType, model: aiResp.model, tokens: aiResp.totalTokens });
  } catch (err) {
    console.error('AI Transcribe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Risk assessment ───────────────────────────────────────────────────────
router.post('/risk-assessment/:id', authenticateToken, async (req, res) => {
  try {
    const doc = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Document not found' });

    const document = doc.rows[0];
    const aiResp = await callOpenRouter(
      `You are a pharmaceutical risk assessment specialist. Return ONLY valid JSON:
{"risk_score":1-10,"risk_level":"low|medium|high|critical","risk_categories":{"safety":"low|medium|high","regulatory":"low|medium|high","operational":"low|medium|high","quality":"low|medium|high"},"critical_risks":["risk1"],"mitigation_strategies":["strategy1"],"timeline_for_action":"<timeframe>","assessment_text":"<full markdown assessment>"}`,
      `Risk assessment for:\nTitle: ${document.title}\nCategory: ${document.category}\nDescription: ${document.description}\nPriority: ${document.priority}\nMetadata: ${JSON.stringify(document.metadata)}`
    );

    const parsed = parseAIJson(aiResp.content) || { risk_score: 5, risk_level: 'medium', risk_categories: {}, critical_risks: [], mitigation_strategies: [], assessment_text: aiResp.content };

    await pool.query(
      'UPDATE documents SET metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{ai_risk}\', $1) WHERE id = $2',
      [JSON.stringify(parsed.assessment_text || aiResp.content), document.id]
    );

    await persistAiResult(document.id, 'risk_assessment', aiResp, parsed, req.user.email);
    await logUsage(req.user.email, 'risk_assessment', aiResp);

    res.json({ assessment: parsed.assessment_text || aiResp.content, structured: parsed, document_id: document.id, model: aiResp.model, tokens: aiResp.totalTokens });
  } catch (err) {
    console.error('AI Risk error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Batch AI analysis ─────────────────────────────────────────────────────
router.post('/batch-analyze', authenticateToken, [
  body('document_ids').isArray({ min: 1, max: 10 }).withMessage('document_ids must be an array of 1-10 ids'),
  body('document_ids.*').isInt({ min: 1 }).withMessage('each document_id must be a positive integer'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { document_ids } = req.body;
  const results = [];

  for (const id of document_ids) {
    try {
      const doc = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
      if (doc.rows.length === 0) {
        results.push({ document_id: id, error: 'Document not found' });
        continue;
      }

      const document = doc.rows[0];
      const aiResp = await callOpenRouter(
        `You are an FDA compliance expert. Return ONLY valid JSON:
{"compliance_status":"compliant|non_compliant|partially_compliant","risk_level":"low|medium|high|critical","risk_score":0-100,"findings":["finding1"],"recommendations":["rec1"],"analysis_text":"<markdown>"}`,
        `Analyze for FDA compliance:\nTitle: ${document.title}\nCategory: ${document.category}\nDescription: ${document.description}\nStatus: ${document.status}`
      );

      const parsed = parseAIJson(aiResp.content) || { compliance_status: 'unknown', risk_level: 'medium', risk_score: 50, findings: [], recommendations: [], analysis_text: aiResp.content };

      await pool.query(
        'UPDATE documents SET metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{ai_compliance}\', $1) WHERE id = $2',
        [JSON.stringify(parsed.analysis_text || aiResp.content), document.id]
      );

      await persistAiResult(document.id, 'batch_compliance', aiResp, parsed, req.user.email);
      await logUsage(req.user.email, 'batch_compliance', aiResp);

      results.push({
        document_id: id,
        title: document.title,
        category: document.category,
        analysis: parsed.analysis_text || aiResp.content,
        structured: parsed,
        analyzed_at: new Date().toISOString(),
        model: aiResp.model,
        tokens: aiResp.totalTokens,
      });
    } catch (err) {
      results.push({ document_id: id, error: err.message });
    }
  }

  res.json({ results, total: results.length, successful: results.filter(r => !r.error).length });
});

// ─── SSE streaming analysis ────────────────────────────────────────────────
router.get('/analyze/stream', authenticateToken, [
  query('documentId').isInt({ min: 1 }).withMessage('documentId must be a positive integer'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`data: ${JSON.stringify({ type: 'error', message: errors.array()[0].msg })}\n\n`);
    return res.end();
  }

  const { documentId } = req.query;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (type, payload) => {
    res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
  };

  try {
    sendEvent('step', { step: 1, message: 'Fetching document from database...' });

    const doc = await pool.query('SELECT * FROM documents WHERE id = $1', [documentId]);
    if (doc.rows.length === 0) {
      sendEvent('error', { message: 'Document not found' });
      return res.end();
    }

    const document = doc.rows[0];
    sendEvent('step', { step: 2, message: `Document loaded: ${document.title}` });

    sendEvent('step', { step: 3, message: 'Running compliance analysis...' });
    const complianceResp = await callOpenRouter(
      `You are an FDA compliance expert. Return ONLY valid JSON:
{"compliance_status":"compliant|non_compliant|partially_compliant","risk_level":"low|medium|high|critical","risk_score":0-100,"findings":["finding1"],"recommendations":["rec1"],"analysis_text":"<markdown>"}`,
      `Analyze for FDA compliance:\nTitle: ${document.title}\nCategory: ${document.category}\nDescription: ${document.description}`
    );
    const complianceParsed = parseAIJson(complianceResp.content) || { analysis_text: complianceResp.content };
    sendEvent('step', { step: 4, message: 'Compliance analysis complete.' });

    sendEvent('step', { step: 5, message: 'Running risk assessment...' });
    const riskResp = await callOpenRouter(
      `You are a pharmaceutical risk assessment specialist. Return ONLY valid JSON:
{"risk_score":1-10,"risk_level":"low|medium|high|critical","critical_risks":["risk1"],"mitigation_strategies":["strategy1"],"assessment_text":"<markdown>"}`,
      `Risk assessment for:\nTitle: ${document.title}\nCategory: ${document.category}\nDescription: ${document.description}`
    );
    const riskParsed = parseAIJson(riskResp.content) || { assessment_text: riskResp.content };
    sendEvent('step', { step: 6, message: 'Risk assessment complete.' });

    sendEvent('step', { step: 7, message: 'Saving results to database...' });
    await pool.query(
      `UPDATE documents SET metadata = jsonb_set(jsonb_set(COALESCE(metadata, '{}'), '{ai_compliance}', $1), '{ai_risk}', $2) WHERE id = $3`,
      [JSON.stringify(complianceParsed.analysis_text || complianceResp.content), JSON.stringify(riskParsed.assessment_text || riskResp.content), documentId]
    );

    await persistAiResult(parseInt(documentId), 'stream_compliance', complianceResp, complianceParsed, req.user.email);
    await persistAiResult(parseInt(documentId), 'stream_risk', riskResp, riskParsed, req.user.email);
    await logUsage(req.user.email, 'stream_analysis', complianceResp);
    await logUsage(req.user.email, 'stream_analysis', riskResp);

    sendEvent('step', { step: 8, message: 'Analysis saved.' });

    sendEvent('complete', {
      document_id: parseInt(documentId),
      compliance: complianceParsed.analysis_text || complianceResp.content,
      compliance_structured: complianceParsed,
      risk: riskParsed.assessment_text || riskResp.content,
      risk_structured: riskParsed,
      analyzed_at: new Date().toISOString(),
      model: OPENROUTER_MODEL,
    });
  } catch (err) {
    console.error('SSE Analysis error:', err);
    sendEvent('error', { message: err.message });
  } finally {
    res.end();
  }
});

// ─── Find similar documents (NEW) ──────────────────────────────────────────
router.post('/find-similar/:id', authenticateToken, async (req, res) => {
  try {
    const doc = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Document not found' });

    const document = doc.rows[0];
    const candidates = await pool.query(
      'SELECT id, title, description, category, status FROM documents WHERE category = $1 AND id != $2 ORDER BY updated_at DESC LIMIT 20',
      [document.category, document.id]
    );

    if (candidates.rows.length === 0) {
      return res.json({ similar: [], document_id: document.id, message: 'No other documents in this category' });
    }

    const aiResp = await callOpenRouter(
      `You are a pharmaceutical document similarity analyst. Return ONLY valid JSON:
{"similar_documents":[{"id":0,"title":"","similarity_score":0-100,"reason":""}],"potential_duplicates":[{"id":0,"title":"","confidence":"high|medium|low"}],"analysis_summary":"<text>"}`,
      `Source document:\nTitle: ${document.title}\nDescription: ${document.description}\n\nCompare against these candidates:\n${candidates.rows.map(d => `ID:${d.id} | ${d.title} | ${d.description || '(no description)'}`).join('\n')}`
    );

    const parsed = parseAIJson(aiResp.content) || { similar_documents: [], potential_duplicates: [], analysis_summary: aiResp.content };

    await persistAiResult(document.id, 'find_similar', aiResp, parsed, req.user.email);
    await logUsage(req.user.email, 'find_similar', aiResp);

    res.json({ similar: parsed.similar_documents, potential_duplicates: parsed.potential_duplicates, analysis_summary: parsed.analysis_summary, document_id: document.id, model: aiResp.model, tokens: aiResp.totalTokens });
  } catch (err) {
    console.error('Find similar error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Compliance digest (NEW) ───────────────────────────────────────────────
router.post('/compliance-digest', authenticateToken, async (req, res) => {
  try {
    const docs = await pool.query(
      `SELECT id, title, category, status, priority, description, updated_at
       FROM documents
       WHERE updated_at >= NOW() - INTERVAL '7 days'
       ORDER BY priority DESC, updated_at DESC
       LIMIT 50`
    );

    if (docs.rows.length === 0) {
      return res.json({ digest: 'No documents updated in the last 7 days.', structured: null, documentCount: 0 });
    }

    const aiResp = await callOpenRouter(
      `You are a pharmaceutical compliance analyst generating a weekly digest. Return ONLY valid JSON:
{"digest_title":"Weekly Compliance Digest","period":"last 7 days","total_documents":0,"by_risk_level":{"critical":[],"high":[],"medium":[],"low":[]},"key_concerns":["concern1"],"commendations":["good1"],"action_items":["action1"],"digest_text":"<full markdown weekly digest>"}`,
      `Generate a weekly compliance digest for these ${docs.rows.length} updated documents:\n\n${docs.rows.map(d => `[${d.priority.toUpperCase()}] ${d.title} (${d.category}, ${d.status}) - updated ${new Date(d.updated_at).toLocaleDateString()}`).join('\n')}`
    );

    const parsed = parseAIJson(aiResp.content) || { digest_text: aiResp.content, total_documents: docs.rows.length };

    await persistAiResult(null, 'compliance_digest', aiResp, parsed, req.user.email);
    await logUsage(req.user.email, 'compliance_digest', aiResp);

    res.json({ digest: parsed.digest_text || aiResp.content, structured: parsed, documentCount: docs.rows.length, model: aiResp.model, tokens: aiResp.totalTokens });
  } catch (err) {
    console.error('Compliance digest error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Get AI results history ────────────────────────────────────────────────
router.get('/results', authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { document_id, analysis_type } = req.query;

    const conditions = ['1=1'];
    const params = [];

    if (document_id) { params.push(document_id); conditions.push(`document_id = $${params.length}`); }
    if (analysis_type) { params.push(analysis_type); conditions.push(`analysis_type = $${params.length}`); }

    const where = conditions.join(' AND ');
    const countResult = await pool.query(`SELECT COUNT(*) FROM ai_results WHERE ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit); params.push(offset);
    const rows = await pool.query(
      `SELECT id, document_id, analysis_type, model, parsed_output, input_tokens, output_tokens, cost_usd, user_email, created_at
       FROM ai_results WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      data: rows.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('AI results error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Document classification (IND/NDA/BLA/etc.) ─────────────────────────────
router.post('/classify-document/:id', authenticateToken, async (req, res) => {
  try {
    const doc = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    const document = doc.rows[0];

    const aiResp = await callOpenRouter(
      `You are a regulatory affairs specialist. Classify the pharmaceutical document by submission type and stage. Return ONLY valid JSON:
{"classification":"IND|NDA|BLA|ANDA|505b2|DMF|CTA|MAA|other","subtype":"<string>","stage":"preclinical|phase1|phase2|phase3|post-market|other","therapeutic_area":"<string>","confidence":"high|medium|low","rationale":"<brief>","tags":["..."]}`,
      `Classify this pharmaceutical document.\nTitle: ${document.title}\nCategory: ${document.category}\nDescription: ${document.description}\nMetadata: ${JSON.stringify(document.metadata)}`
    );
    const parsed = parseAIJson(aiResp.content) || { classification: 'other', confidence: 'low', rationale: aiResp.content };
    await persistAiResult(document.id, 'classify-document', aiResp, parsed, req.user.email);
    await logUsage(req.user.email, 'classify-document', aiResp);
    res.json({ document_id: document.id, ...parsed, model: aiResp.model, tokens: aiResp.totalTokens });
  } catch (err) {
    console.error('AI classify-document error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Adverse event detection ────────────────────────────────────────────────
router.post('/adverse-event-detect', authenticateToken, async (req, res) => {
  try {
    const { document_id, narrative, patient_summary } = req.body;
    if (!narrative && !document_id) return res.status(400).json({ error: 'narrative or document_id is required' });

    let body = narrative;
    if (!body && document_id) {
      const doc = await pool.query('SELECT title, description, metadata FROM documents WHERE id = $1', [document_id]);
      if (doc.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
      body = `${doc.rows[0].title}\n${doc.rows[0].description}\n${JSON.stringify(doc.rows[0].metadata)}`;
    }

    const aiResp = await callOpenRouter(
      `You are a pharmacovigilance officer. Detect adverse events (AEs) and serious adverse events (SAEs) from the narrative. Apply MedDRA reasoning. Return ONLY valid JSON:
{"adverse_events":[{"event_term":"<MedDRA preferred term>","seriousness":"non-serious|serious","outcome":"recovered|recovering|not-recovered|fatal|unknown","causality":"unrelated|unlikely|possible|probable|definite","onset":"<text>","duration":"<text>"}],"is_serious":true|false,"requires_expedited_report":true|false,"summary":"<brief>","confidence":"high|medium|low"}`,
      `Patient summary: ${patient_summary || 'unknown'}\n\nNarrative:\n${body}`
    );
    const parsed = parseAIJson(aiResp.content) || { adverse_events: [], confidence: 'low', summary: aiResp.content };
    await persistAiResult(document_id || null, 'adverse-event-detect', aiResp, parsed, req.user.email);
    await logUsage(req.user.email, 'adverse-event-detect', aiResp);
    res.json({ document_id: document_id || null, ...parsed, model: aiResp.model, tokens: aiResp.totalTokens });
  } catch (err) {
    console.error('AI adverse-event-detect error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Manufacturing deviation flagging ───────────────────────────────────────
router.post('/manufacturing-deviation', authenticateToken, async (req, res) => {
  try {
    const { batch_id, batch_record, specifications, environment_data } = req.body;
    if (!batch_record) return res.status(400).json({ error: 'batch_record is required' });

    const aiResp = await callOpenRouter(
      `You are a GMP quality assurance specialist. Identify deviations from validated specifications and flag potential out-of-spec / out-of-trend conditions. Return ONLY valid JSON:
{"has_deviations":true|false,"deviations":[{"category":"in-process|environmental|equipment|material|documentation","severity":"minor|major|critical","description":"<text>","specification":"<text>","actual":"<text>","cfr_reference":"<text>","corrective_action":"<text>"}],"requires_capa":true|false,"investigation_priority":"low|medium|high|critical","summary":"<brief>"}`,
      `Batch ID: ${batch_id || 'unknown'}\nSpecifications:\n${JSON.stringify(specifications || {})}\nBatch Record:\n${typeof batch_record === 'string' ? batch_record : JSON.stringify(batch_record)}\nEnvironment Data:\n${JSON.stringify(environment_data || {})}`
    );
    const parsed = parseAIJson(aiResp.content) || { has_deviations: false, deviations: [], summary: aiResp.content };
    await persistAiResult(null, 'manufacturing-deviation', aiResp, parsed, req.user.email);
    await logUsage(req.user.email, 'manufacturing-deviation', aiResp);
    res.json({ batch_id: batch_id || null, ...parsed, model: aiResp.model, tokens: aiResp.totalTokens });
  } catch (err) {
    console.error('AI manufacturing-deviation error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
