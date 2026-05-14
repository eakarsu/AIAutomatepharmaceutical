const express = require('express');
const { body, validationResult } = require('express-validator');
const PDFDocument = require('pdfkit');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

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

// Pagination helper
function getPagination(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// Validation rules for document creation
const documentValidation = [
  body('category')
    .isIn(PHARMA_CATEGORIES)
    .withMessage(`category must be one of: ${PHARMA_CATEGORIES.join(', ')}`),
  body('content')
    .optional()
    .isLength({ max: 50000 })
    .withMessage('content must not exceed 50,000 characters'),
  body('description')
    .optional()
    .isLength({ max: 50000 })
    .withMessage('description must not exceed 50,000 characters'),
  body('title')
    .notEmpty()
    .withMessage('title is required'),
];

// Helper: log audit event
async function logAudit(documentId, userId, action, details = {}) {
  try {
    await pool.query(
      'INSERT INTO document_audit_log (document_id, user_id, action, details) VALUES ($1, $2, $3, $4)',
      [documentId, String(userId), action, JSON.stringify(details)]
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

// Helper: save document version
async function saveVersion(documentId, currentDoc, changedBy) {
  try {
    const maxVersionResult = await pool.query(
      'SELECT COALESCE(MAX(version_number), 0) as max_ver FROM document_versions WHERE document_id = $1',
      [documentId]
    );
    const nextVersion = parseInt(maxVersionResult.rows[0].max_ver) + 1;
    await pool.query(
      'INSERT INTO document_versions (document_id, version_number, content, changed_by) VALUES ($1, $2, $3, $4)',
      [documentId, nextVersion, JSON.stringify(currentDoc), changedBy]
    );
  } catch (err) {
    console.error('Version save error:', err.message);
  }
}

// Global paginated document list across all categories
// GET /api/documents?page=1&limit=20&search=&category=&status=
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const { search, category, status, priority } = req.query;

    const conditions = ['1=1'];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length})`);
    }
    if (category) { params.push(category); conditions.push(`category = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (priority) { params.push(priority); conditions.push(`priority = $${params.length}`); }

    const where = conditions.join(' AND ');
    const countResult = await pool.query(`SELECT COUNT(*) FROM documents WHERE ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit); params.push(offset);
    const result = await pool.query(
      `SELECT * FROM documents WHERE ${where} ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all documents by category (with pagination)
router.get('/category/:category', authenticateToken, async (req, res) => {
  try {
    const { category } = req.params;
    const { search } = req.query;
    const { page, limit, offset } = getPagination(req);

    const conditions = ['category = $1'];
    const params = [category];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length})`);
    }

    const where = conditions.join(' AND ');
    const countResult = await pool.query(`SELECT COUNT(*) FROM documents WHERE ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit); params.push(offset);
    const result = await pool.query(
      `SELECT * FROM documents WHERE ${where} ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get dashboard stats (MUST be before /:id to avoid route collision)
router.get('/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    const totalDocs = await pool.query('SELECT COUNT(*) FROM documents');
    const byCategory = await pool.query(
      'SELECT category, COUNT(*) as count FROM documents GROUP BY category ORDER BY count DESC'
    );
    const byStatus = await pool.query(
      'SELECT status, COUNT(*) as count FROM documents GROUP BY status'
    );
    const recentDocs = await pool.query(
      'SELECT * FROM documents ORDER BY updated_at DESC LIMIT 5'
    );

    res.json({
      total: parseInt(totalDocs.rows[0].count),
      byCategory: byCategory.rows,
      byStatus: byStatus.rows,
      recentDocuments: recentDocs.rows,
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single document
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await logAudit(id, req.user.id || req.user.email, 'view', { documentId: id });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching document:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export document as PDF
router.get('/:id/export/pdf', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = result.rows[0];
    const metadata = typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : (doc.metadata || {});

    await logAudit(id, req.user.id || req.user.email, 'export_pdf', { documentId: id });

    const pdf = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="compliance-${id}.pdf"`);
    pdf.pipe(res);

    // Header
    pdf.fontSize(20).font('Helvetica-Bold').text('PHARMACEUTICAL COMPLIANCE DOCUMENT', { align: 'center' });
    pdf.moveDown(0.5);
    pdf.fontSize(10).font('Helvetica').fillColor('#666')
      .text(`Generated: ${new Date().toUTCString()}`, { align: 'center' });
    pdf.moveDown(1);

    // Divider
    pdf.moveTo(50, pdf.y).lineTo(562, pdf.y).stroke('#cccccc');
    pdf.moveDown(1);

    // Document Metadata
    pdf.fontSize(14).font('Helvetica-Bold').fillColor('#000').text('Document Information');
    pdf.moveDown(0.5);
    pdf.fontSize(11).font('Helvetica');
    const fields = [
      ['Title', doc.title],
      ['Category', doc.category],
      ['Status', doc.status],
      ['Priority', doc.priority],
      ['Created By', doc.created_by || 'N/A'],
      ['Created At', doc.created_at ? new Date(doc.created_at).toUTCString() : 'N/A'],
      ['Last Updated', doc.updated_at ? new Date(doc.updated_at).toUTCString() : 'N/A'],
    ];
    for (const [label, value] of fields) {
      pdf.font('Helvetica-Bold').text(`${label}: `, { continued: true })
         .font('Helvetica').text(String(value || 'N/A'));
    }

    if (doc.description) {
      pdf.moveDown(0.5);
      pdf.font('Helvetica-Bold').text('Description:');
      pdf.font('Helvetica').text(doc.description);
    }

    pdf.moveDown(1);
    pdf.moveTo(50, pdf.y).lineTo(562, pdf.y).stroke('#cccccc');
    pdf.moveDown(1);

    // AI Analysis Summary
    if (metadata.ai_summary) {
      pdf.fontSize(14).font('Helvetica-Bold').text('AI Analysis Summary');
      pdf.moveDown(0.5);
      pdf.fontSize(10).font('Helvetica').text(metadata.ai_summary);
      pdf.moveDown(1);
    }

    // Risk Assessment
    if (metadata.ai_risk) {
      pdf.fontSize(14).font('Helvetica-Bold').text('Risk Assessment');
      pdf.moveDown(0.5);
      pdf.fontSize(10).font('Helvetica').text(metadata.ai_risk);
      pdf.moveDown(1);
    }

    // Compliance Status
    if (metadata.ai_compliance) {
      pdf.fontSize(14).font('Helvetica-Bold').text('Compliance Analysis');
      pdf.moveDown(0.5);
      pdf.fontSize(10).font('Helvetica').text(metadata.ai_compliance);
      pdf.moveDown(1);
    }

    // Footer
    pdf.moveTo(50, pdf.y).lineTo(562, pdf.y).stroke('#cccccc');
    pdf.moveDown(0.5);
    pdf.fontSize(8).fillColor('#999')
      .text('CONFIDENTIAL - For internal use only. This document is generated automatically by PharmaDocs AI.', { align: 'center' });

    pdf.end();
  } catch (err) {
    console.error('PDF export error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get document version history
router.get('/:id/versions', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, document_id, version_number, changed_by, changed_at FROM document_versions WHERE document_id = $1 ORDER BY version_number DESC',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching versions:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create document
router.post('/', authenticateToken, documentValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  try {
    const { title, description, category, status, priority, metadata } = req.body;
    const result = await pool.query(
      `INSERT INTO documents (title, description, category, status, priority, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, description, category, status || 'draft', priority || 'medium', JSON.stringify(metadata || {}), req.user.name]
    );

    await logAudit(result.rows[0].id, req.user.id || req.user.email, 'create', { title, category });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating document:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update document
const updateDocumentValidation = [
  body('title').optional().isLength({ min: 1, max: 500 }).withMessage('title must be 1-500 chars'),
  body('status').optional().isIn(['draft', 'in_progress', 'review', 'completed', 'approved', 'submitted', 'rejected'])
    .withMessage('invalid status value'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('invalid priority value'),
  body('description').optional().isLength({ max: 50000 }),
];

router.put('/:id', authenticateToken, updateDocumentValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  try {
    const { id } = req.params;
    const { title, description, status, priority, metadata } = req.body;

    // Fetch current version before update
    const current = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Save old version
    await saveVersion(id, current.rows[0], req.user.name || req.user.email);

    const result = await pool.query(
      `UPDATE documents SET title = COALESCE($1, title), description = COALESCE($2, description),
       status = COALESCE($3, status), priority = COALESCE($4, priority),
       metadata = COALESCE($5, metadata), updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [title, description, status, priority, metadata ? JSON.stringify(metadata) : null, id]
    );

    const action = status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'edit';
    await logAudit(id, req.user.id || req.user.email, action, { title, status, priority });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating document:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete document
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await logAudit(id, req.user.id || req.user.email, 'delete', { documentId: id });

    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    console.error('Error deleting document:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get dashboard stats
module.exports = router;
