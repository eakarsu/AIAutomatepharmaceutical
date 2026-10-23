'use strict';
const express = require('express');
const { runAiFeature } = require('../lib/featurePack26c');
const LABELS = {"total": "Evidence cases", "byStatus": "Cases by status", "flagged": "Cases flagged for review", "emptyNote": "No evidence cases supplied. No diagnosis or prescribing output is produced."};
const FEATURES = [["evidence-completeness", "Evidence completeness"], ["interaction-review", "Interaction-rule review (non-clinical)"], ["traceability-gaps", "Source traceability gaps"]];
function createFeatureAiRouter({ authenticate, loadRecords } = {}) {
  const router = express.Router(); if (authenticate) router.use(authenticate);
  for (const [slug] of FEATURES) router.post('/' + slug, async (req, res) => { let records = Array.isArray(req.body?.records) ? req.body.records : null; if (!records && loadRecords) { try { records = await loadRecords(req); } catch { records = []; } } const out = await runAiFeature(slug, records || [], LABELS); return res.json({ feature: slug, ...out }); });
  router.get('/features', (req, res) => res.json({ features: FEATURES.map(([id, title]) => ({ id, title })) }));
  return router;
}
module.exports = { createFeatureAiRouter, FEATURES, LABELS };
