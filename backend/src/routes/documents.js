const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all documents by category
router.get('/category/:category', authenticateToken, async (req, res) => {
  try {
    const { category } = req.params;
    const { search } = req.query;
    let query = 'SELECT * FROM documents WHERE category = $1';
    const params = [category];

    if (search) {
      query += ' AND (title ILIKE $2 OR description ILIKE $2)';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY updated_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching documents:', err);
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

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching document:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create document
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, category, status, priority, metadata } = req.body;
    const result = await pool.query(
      `INSERT INTO documents (title, description, category, status, priority, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, description, category, status || 'draft', priority || 'medium', JSON.stringify(metadata || {}), req.user.name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating document:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update document
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, metadata } = req.body;
    const result = await pool.query(
      `UPDATE documents SET title = COALESCE($1, title), description = COALESCE($2, description),
       status = COALESCE($3, status), priority = COALESCE($4, priority),
       metadata = COALESCE($5, metadata), updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [title, description, status, priority, metadata ? JSON.stringify(metadata) : null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

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

    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    console.error('Error deleting document:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get dashboard stats
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
      recentDocuments: recentDocs.rows
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
