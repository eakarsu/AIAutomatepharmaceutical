const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// Apply pass 5: tolerate IPv6 keyGenerator validation in newer versions of express-rate-limit
let __ipKeyGen = (req) => req.ip;
try { __ipKeyGen = require('express-rate-limit').ipKeyGenerator || __ipKeyGen; } catch (_) {}
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const aiRoutes = require('./routes/ai');
const aiFeaturesRoutes = require('./routes/aiFeatures');
const extensionsRoutes = require('./routes/extensions'); // Apply pass 5: backlog

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// Security headers
app.use(helmet());

// CORS — restrict to CLIENT_URL
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// General rate limiter: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Limit is 100 per 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI rate limiter: 20 requests per user per hour
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req, res) => {
    return req.user ? String(req.user.id || req.user.email) : __ipKeyGen(req, res);
  },
  message: { error: 'Too many AI requests. Limit is 20 per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general limiter to all routes
app.use(generalLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/ai', aiRateLimiter, aiRoutes);
app.use('/api/ai-features', aiRateLimiter, aiFeaturesRoutes);
app.use('/api/ext', extensionsRoutes); // Apply pass 5: document mgmt + esign + CTD + gateway + OCR

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`✓ PharmaDocs Backend running on port ${PORT}`);
  console.log(`✓ CORS origin: ${CLIENT_URL}`);
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn('⚠ WARNING: OPENROUTER_API_KEY is not set. AI features will fail.');
  }
  if (!process.env.JWT_SECRET) {
    console.warn('⚠ WARNING: JWT_SECRET is not set. Using fallback (insecure for production).');
  }
});

// BATCH_00_AUDIT_MOUNTS
app.use('/api/regulatory-flag', require('./routes/regulatoryFlag'));
app.use('/api/deviation-detect', require('./routes/deviationDetect'));
app.use('/api/trial-extract', require('./routes/trialExtract'));
app.use('/api/ctd-generation', require('./routes/ctdGeneration'));
app.use('/api/fda-ema-bridge', require('./routes/fdaEmaBridge'));

// === Batch 00 Gaps & Frontend Mounts ===
app.use('/api/gap-ai-document-classification-ind-vs', require('./routes/gap_ai_document_classification_ind_vs'));
app.use('/api/gap-ai-adverse-event-detection', require('./routes/gap_ai_adverse_event_detection'));
app.use('/api/gap-ai-manufacturing-deviation-flagging', require('./routes/gap_ai_manufacturing_deviation_flagging'));
app.use('/api/gap-ai-clinical-trial-endpoint-extraction', require('./routes/gap_ai_clinical_trial_endpoint_extraction'));
app.use('/api/gap-document-version-control-branching', require('./routes/gap_document_version_control_branching'));
app.use('/api/gap-collaboration-commenting-threads', require('./routes/gap_collaboration_commenting_threads'));
app.use('/api/gap-e-signature-workflow', require('./routes/gap_e_signature_workflow'));
app.use('/api/gap-regulatory-submission-preparation-ctd-format', require('./routes/gap_regulatory_submission_preparation_ctd_format'));
app.use('/api/gap-outbound-webhooks', require('./routes/gap_outbound_webhooks'));
