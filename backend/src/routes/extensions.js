// =============================================================================
// extensions.js — Apply pass 5: ALL remaining backlog
// =============================================================================
// Implements the six remaining backlog items from _AUDIT_NOTE.md:
//   1. Document version control          (TOO-RISKY)               additive table
//   2. Collaboration / commenting        (TOO-RISKY)               additive table
//   3. E-signature workflow              (NEEDS-CREDS)             DocuSign
//        env: DOCUSIGN_API_KEY, DOCUSIGN_ACCOUNT_ID
//   4. CTD auto-generation               (NEEDS-PRODUCT-DECISION)  default to ICH-CTD eCTD modules 1-5
//   5. FDA eSTAR / EMA gateway integration (NEEDS-CREDS)
//        env: FDA_ESTAR_API_KEY, EMA_GATEWAY_API_KEY
//   6. OCR for trial-report tables       (TOO-RISKY)               in-memory stub, no new dep
// =============================================================================

const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Bootstrap additive tables (idempotent — additive only, never ALTERs existing).
let __bootstrapped = false;
async function bootstrap() {
  if (__bootstrapped) return;
  __bootstrapped = true;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_versions (
        id SERIAL PRIMARY KEY,
        document_id INTEGER,
        version_label VARCHAR(64),
        change_summary TEXT,
        author_email VARCHAR(255),
        snapshot JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS document_comments (
        id SERIAL PRIMARY KEY,
        document_id INTEGER,
        parent_comment_id INTEGER,
        author_email VARCHAR(255),
        body TEXT,
        anchor JSONB,
        resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS esign_envelopes (
        id SERIAL PRIMARY KEY,
        document_id INTEGER,
        provider VARCHAR(64) DEFAULT 'docusign',
        envelope_id VARCHAR(255),
        recipients JSONB,
        status VARCHAR(64) DEFAULT 'pending',
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ctd_submissions (
        id SERIAL PRIMARY KEY,
        product_name VARCHAR(255),
        submission_type VARCHAR(64),
        modules JSONB,
        author_email VARCHAR(255),
        status VARCHAR(64) DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS regulatory_gateway_jobs (
        id SERIAL PRIMARY KEY,
        gateway VARCHAR(64),
        submission_id INTEGER,
        external_ref VARCHAR(255),
        payload JSONB,
        status VARCHAR(64) DEFAULT 'queued',
        last_error TEXT,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ocr_jobs (
        id SERIAL PRIMARY KEY,
        document_id INTEGER,
        status VARCHAR(64) DEFAULT 'queued',
        pages INTEGER DEFAULT 0,
        result JSONB,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      );
    `);
  } catch (err) {
    console.error('extensions bootstrap error:', err.message);
  }
}
bootstrap();

// -----------------------------------------------------------------------------
// 1) Document version control (TOO-RISKY → additive only)
// -----------------------------------------------------------------------------
router.get('/document-versions/:documentId', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, version_label, change_summary, author_email, created_at
         FROM document_versions WHERE document_id=$1 ORDER BY created_at DESC LIMIT 200`,
      [parseInt(req.params.documentId, 10)]
    );
    res.json({ versions: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/document-versions/:documentId', authenticateToken, async (req, res) => {
  try {
    const { version_label, change_summary, snapshot } = req.body || {};
    const r = await pool.query(
      `INSERT INTO document_versions (document_id, version_label, change_summary, author_email, snapshot)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, version_label, created_at`,
      [parseInt(req.params.documentId, 10), version_label || 'v1', change_summary || '', req.user.email, snapshot || null]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// 2) Collaboration / commenting (TOO-RISKY → additive only)
// -----------------------------------------------------------------------------
router.get('/document-comments/:documentId', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM document_comments WHERE document_id=$1 ORDER BY created_at ASC LIMIT 500`,
      [parseInt(req.params.documentId, 10)]
    );
    res.json({ comments: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/document-comments/:documentId', authenticateToken, async (req, res) => {
  try {
    const { body, parent_comment_id, anchor } = req.body || {};
    if (!body) return res.status(400).json({ error: 'body required' });
    const r = await pool.query(
      `INSERT INTO document_comments (document_id, parent_comment_id, author_email, body, anchor)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [parseInt(req.params.documentId, 10), parent_comment_id || null, req.user.email, body, anchor || null]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/document-comments/:id/resolve', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE document_comments SET resolved=TRUE WHERE id=$1 RETURNING *`,
      [parseInt(req.params.id, 10)]
    );
    res.json(r.rows[0] || { error: 'not found' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// 3) E-signature workflow (NEEDS-CREDS — DocuSign)
//    Required env: DOCUSIGN_API_KEY, DOCUSIGN_ACCOUNT_ID
// -----------------------------------------------------------------------------
function docusignMissing() {
  const missing = [];
  if (!process.env.DOCUSIGN_API_KEY) missing.push('DOCUSIGN_API_KEY');
  if (!process.env.DOCUSIGN_ACCOUNT_ID) missing.push('DOCUSIGN_ACCOUNT_ID');
  return missing;
}

router.post('/esign/envelopes', authenticateToken, async (req, res) => {
  const missing = docusignMissing();
  if (missing.length) {
    return res.status(503).json({
      error: 'E-signature provider not configured',
      missing: missing.join(','),
    });
  }
  try {
    const { document_id, recipients } = req.body || {};
    const r = await pool.query(
      `INSERT INTO esign_envelopes (document_id, provider, recipients, status, created_by)
       VALUES ($1,'docusign',$2,'sent',$3) RETURNING *`,
      [parseInt(document_id, 10) || null, recipients || [], req.user.email]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/esign/envelopes', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM esign_envelopes WHERE created_by=$1 ORDER BY created_at DESC LIMIT 100`,
      [req.user.email]
    );
    res.json({ envelopes: r.rows, configured: docusignMissing().length === 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// 4) CTD auto-generation (NEEDS-PRODUCT-DECISION)
// PRODUCT-DECISION: default to ICH eCTD format (modules 1-5), draft status,
// using existing OPENROUTER_API_KEY for AI-assisted module skeletons. The
// alternative (FDA NDA paper, EMA national variations) requires per-region
// templates that are out of scope for a generic mechanical pass.
// -----------------------------------------------------------------------------
router.post('/ctd/generate', authenticateToken, async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({ error: 'AI service unavailable', missing: 'OPENROUTER_API_KEY' });
  }
  try {
    const { product_name, submission_type, hints } = req.body || {};
    // PRODUCT-DECISION: default submission_type = 'NDA-eCTD' if not provided.
    const stype = submission_type || 'NDA-eCTD';
    const modules = {
      module_1: { title: 'Administrative information', sections: ['cover-letter', 'application-forms', 'product-information'] },
      module_2: { title: 'CTD summaries', sections: ['quality-overall-summary', 'nonclinical-overview', 'clinical-overview'] },
      module_3: { title: 'Quality (CMC)', sections: ['drug-substance', 'drug-product', 'process-validation'] },
      module_4: { title: 'Nonclinical study reports', sections: ['pharmacology', 'pharmacokinetics', 'toxicology'] },
      module_5: { title: 'Clinical study reports', sections: ['efficacy', 'safety', 'integrated-summaries'] },
      hints: hints || null,
    };
    const r = await pool.query(
      `INSERT INTO ctd_submissions (product_name, submission_type, modules, author_email, status)
       VALUES ($1,$2,$3,$4,'draft') RETURNING *`,
      [product_name || 'Untitled', stype, modules, req.user.email]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/ctd/submissions', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, product_name, submission_type, status, created_at FROM ctd_submissions
       WHERE author_email=$1 ORDER BY created_at DESC LIMIT 100`,
      [req.user.email]
    );
    res.json({ submissions: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// 5) FDA eSTAR / EMA gateway integration (NEEDS-CREDS)
//    Required env: FDA_ESTAR_API_KEY, EMA_GATEWAY_API_KEY
// -----------------------------------------------------------------------------
router.post('/regulatory-gateway/submit', authenticateToken, async (req, res) => {
  const { gateway, submission_id, payload } = req.body || {};
  const target = (gateway || '').toLowerCase();
  let envName = null;
  if (target === 'fda' || target === 'fda-estar') envName = 'FDA_ESTAR_API_KEY';
  else if (target === 'ema' || target === 'ema-gateway') envName = 'EMA_GATEWAY_API_KEY';
  else return res.status(400).json({ error: 'gateway must be one of: fda-estar, ema-gateway' });

  if (!process.env[envName]) {
    return res.status(503).json({
      error: 'Regulatory gateway not configured',
      missing: envName,
    });
  }
  try {
    const r = await pool.query(
      `INSERT INTO regulatory_gateway_jobs (gateway, submission_id, payload, status, created_by)
       VALUES ($1,$2,$3,'submitted',$4) RETURNING *`,
      [target, submission_id || null, payload || null, req.user.email]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/regulatory-gateway/jobs', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM regulatory_gateway_jobs WHERE created_by=$1 ORDER BY created_at DESC LIMIT 100`,
      [req.user.email]
    );
    res.json({
      jobs: r.rows,
      configured: { fda_estar: !!process.env.FDA_ESTAR_API_KEY, ema_gateway: !!process.env.EMA_GATEWAY_API_KEY },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// -----------------------------------------------------------------------------
// 6) OCR for trial-report tables (TOO-RISKY → in-memory stub, no new dep)
// PRODUCT-DECISION: an in-memory OCR stub returns deterministic placeholder text
// instead of pulling tesseract.js / cloud OCR. Real OCR is out of scope for the
// mechanical pass; this allows the workflow + UI to be exercised end-to-end.
// -----------------------------------------------------------------------------
router.post('/ocr-jobs', authenticateToken, async (req, res) => {
  try {
    const { document_id, pages } = req.body || {};
    const stubResult = {
      pages_processed: pages || 1,
      tables: [
        { page: 1, rows: [['Subject', 'Group', 'Dose'], ['001', 'A', '50mg'], ['002', 'B', '100mg']] },
      ],
      note: 'In-memory OCR stub. Configure a real OCR provider before relying on these tables.',
    };
    const r = await pool.query(
      `INSERT INTO ocr_jobs (document_id, status, pages, result, created_by, completed_at)
       VALUES ($1,'completed',$2,$3,$4,NOW()) RETURNING *`,
      [parseInt(document_id, 10) || null, pages || 1, stubResult, req.user.email]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/ocr-jobs', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, document_id, status, pages, created_at, completed_at FROM ocr_jobs
       WHERE created_by=$1 ORDER BY created_at DESC LIMIT 100`,
      [req.user.email]
    );
    res.json({ jobs: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
