const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    summary: { capa_items: 21, overdue: 4, inspection_ready: 13, high_risk_deviations: 5 },
    items: [
      { id: 'CAPA-1028', document: 'Batch Record BR-442', deviation: 'temperature excursion', owner: 'QA', status: 'effectiveness check' },
      { id: 'CAPA-1031', document: 'SOP-MFG-12', deviation: 'line clearance miss', owner: 'Manufacturing', status: 'overdue' },
      { id: 'CAPA-1044', document: 'Validation Protocol VP-77', deviation: 'sample timing gap', owner: 'Validation', status: 'draft response' },
    ],
  });
});

router.post('/triage', (req, res) => {
  const { severity = 'medium', repeat = false } = req.body || {};
  res.json({ priority: severity === 'high' || repeat ? 'inspection risk' : 'standard', required_artifacts: ['root cause', 'action plan', 'effectiveness check'] });
});

module.exports = router;
