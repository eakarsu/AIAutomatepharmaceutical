const express = require('express');
const fetch = require('node-fetch');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

async function callOpenRouter(systemPrompt, userPrompt) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'PharmaDocs AI'
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'OpenRouter API error');
  }

  return data.choices[0].message.content;
}

// Summarize document
router.post('/summarize/:id', authenticateToken, async (req, res) => {
  try {
    const doc = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Document not found' });

    const document = doc.rows[0];
    const result = await callOpenRouter(
      'You are an expert pharmaceutical document analyst. Provide clear, professional summaries of pharmaceutical documents. Format your response with clear sections using markdown headers (##), bullet points, and bold text for key terms.',
      `Please provide a comprehensive summary of this pharmaceutical document:\n\nTitle: ${document.title}\nCategory: ${document.category}\nDescription: ${document.description}\nMetadata: ${JSON.stringify(document.metadata)}`
    );

    await pool.query(
      'UPDATE documents SET metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{ai_summary}\', $1) WHERE id = $2',
      [JSON.stringify(result), document.id]
    );

    res.json({ summary: result, document_id: document.id });
  } catch (err) {
    console.error('AI Summarize error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Analyze compliance
router.post('/compliance-check/:id', authenticateToken, async (req, res) => {
  try {
    const doc = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Document not found' });

    const document = doc.rows[0];
    const result = await callOpenRouter(
      'You are an FDA compliance expert for pharmaceutical companies. Analyze documents for regulatory compliance issues. Format your response with clear sections: ## Compliance Status, ## Key Findings, ## Recommendations, ## Risk Level. Use bullet points and bold for emphasis.',
      `Analyze this pharmaceutical document for FDA compliance:\n\nTitle: ${document.title}\nCategory: ${document.category}\nDescription: ${document.description}\nStatus: ${document.status}\nMetadata: ${JSON.stringify(document.metadata)}`
    );

    await pool.query(
      'UPDATE documents SET metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{ai_compliance}\', $1) WHERE id = $2',
      [JSON.stringify(result), document.id]
    );

    res.json({ analysis: result, document_id: document.id });
  } catch (err) {
    console.error('AI Compliance error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Extract key data
router.post('/extract/:id', authenticateToken, async (req, res) => {
  try {
    const doc = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Document not found' });

    const document = doc.rows[0];
    const result = await callOpenRouter(
      'You are a pharmaceutical data extraction specialist. Extract and structure key data points from pharmaceutical documents. Format with clear sections: ## Key Data Points, ## Critical Values, ## Observations, ## Action Items. Use tables where appropriate.',
      `Extract key data from this pharmaceutical document:\n\nTitle: ${document.title}\nCategory: ${document.category}\nDescription: ${document.description}\nMetadata: ${JSON.stringify(document.metadata)}`
    );

    await pool.query(
      'UPDATE documents SET metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{ai_extraction}\', $1) WHERE id = $2',
      [JSON.stringify(result), document.id]
    );

    res.json({ extraction: result, document_id: document.id });
  } catch (err) {
    console.error('AI Extract error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate report
router.post('/generate-report', authenticateToken, async (req, res) => {
  try {
    const { category, reportType } = req.body;
    const docs = await pool.query(
      'SELECT title, description, status, priority, metadata FROM documents WHERE category = $1 ORDER BY updated_at DESC LIMIT 20',
      [category]
    );

    const result = await callOpenRouter(
      'You are a pharmaceutical report generation expert. Create comprehensive, professional reports. Format with: ## Executive Summary, ## Detailed Findings, ## Statistical Overview, ## Recommendations, ## Conclusion. Use bullet points, bold text, and numbered lists.',
      `Generate a ${reportType || 'summary'} report for the following ${category} documents:\n\n${docs.rows.map((d, i) => `${i + 1}. ${d.title}: ${d.description} (Status: ${d.status}, Priority: ${d.priority})`).join('\n')}`
    );

    res.json({ report: result, category, documentCount: docs.rows.length });
  } catch (err) {
    console.error('AI Report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Transcribe/format document
router.post('/transcribe', authenticateToken, async (req, res) => {
  try {
    const { rawText, documentType } = req.body;

    const result = await callOpenRouter(
      'You are a pharmaceutical document formatting specialist. Take raw, unstructured text and transform it into a professionally formatted pharmaceutical document. Use proper medical/pharmaceutical terminology. Format with clear sections, headers (##), bullet points, and tables where appropriate.',
      `Please transcribe and professionally format this raw pharmaceutical text into a structured ${documentType || 'general'} document:\n\n${rawText}`
    );

    res.json({ formatted: result, type: documentType });
  } catch (err) {
    console.error('AI Transcribe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Risk assessment
router.post('/risk-assessment/:id', authenticateToken, async (req, res) => {
  try {
    const doc = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (doc.rows.length === 0) return res.status(404).json({ error: 'Document not found' });

    const document = doc.rows[0];
    const result = await callOpenRouter(
      'You are a pharmaceutical risk assessment specialist. Evaluate documents for potential risks including safety, regulatory, operational, and quality risks. Format with: ## Risk Score (1-10), ## Risk Categories, ## Critical Risks, ## Mitigation Strategies, ## Timeline for Action.',
      `Perform a risk assessment on this pharmaceutical document:\n\nTitle: ${document.title}\nCategory: ${document.category}\nDescription: ${document.description}\nPriority: ${document.priority}\nMetadata: ${JSON.stringify(document.metadata)}`
    );

    await pool.query(
      'UPDATE documents SET metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{ai_risk}\', $1) WHERE id = $2',
      [JSON.stringify(result), document.id]
    );

    res.json({ assessment: result, document_id: document.id });
  } catch (err) {
    console.error('AI Risk error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
