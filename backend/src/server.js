const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { validateRuntime } = require('./config/runtime');
validateRuntime();

const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const { authenticateToken } = require('./middleware/auth');

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

// Apply general limiter to all routes
app.use(generalLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/evidence-cases', authenticateToken, require('./routes/evidenceCases'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Unvalidated AI, gap, and regulatory-provider routes are deliberately not mounted.

// === Custom Views: Pharma Automation (batch records, regulatory) ===
app.use('/api/custom-views', authenticateToken, require('./routes/customViews'));

app.listen(PORT, () => {
  console.log(`Pharma evidence backend running on port ${PORT}`);
});
