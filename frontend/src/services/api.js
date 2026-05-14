import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('pharma_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      localStorage.removeItem('pharma_token');
      localStorage.removeItem('pharma_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

export const documents = {
  // Global paginated list: returns { data, pagination }
  list: (params = {}) => api.get('/documents', { params }),
  // Category list: returns { data, pagination }
  getByCategory: (category, search, page = 1, limit = 20) =>
    api.get(`/documents/category/${category}`, { params: { search, page, limit } }),
  getById: (id) => api.get(`/documents/${id}`),
  create: (data) => api.post('/documents', data),
  update: (id, data) => api.put(`/documents/${id}`, data),
  delete: (id) => api.delete(`/documents/${id}`),
  getStats: () => api.get('/documents/stats/dashboard'),
};

export const ai = {
  summarize: (id) => api.post(`/ai/summarize/${id}`),
  complianceCheck: (id) => api.post(`/ai/compliance-check/${id}`),
  extract: (id) => api.post(`/ai/extract/${id}`),
  generateReport: (category, reportType) => api.post('/ai/generate-report', { category, reportType }),
  transcribe: (rawText, documentType) => api.post('/ai/transcribe', { rawText, documentType }),
  riskAssessment: (id) => api.post(`/ai/risk-assessment/${id}`),
  batchAnalyze: (document_ids) => api.post('/ai/batch-analyze', { document_ids }),
  findSimilar: (id) => api.post(`/ai/find-similar/${id}`),
  complianceDigest: () => api.post('/ai/compliance-digest'),
  classifyDocument: (id) => api.post(`/ai/classify-document/${id}`),
  adverseEventDetect: (data) => api.post('/ai/adverse-event-detect', data),
  manufacturingDeviation: (data) => api.post('/ai/manufacturing-deviation', data),
  // AI results history: returns { data, pagination }
  getResults: (params = {}) => api.get('/ai/results', { params }),
  // SSE: returns EventSource URL (include token in query param for SSE)
  streamUrl: (documentId) => {
    const token = localStorage.getItem('pharma_token');
    return `${API_BASE}/ai/analyze/stream?documentId=${documentId}&token=${token}`;
  },
};

// 8 custom AI feature routes
export const aiFeatures = {
  // 1. Compliance Trend Dashboard
  trends: (params = {}) => api.get('/ai-features/compliance-trends', { params }),
  analyzeAnomalies: (days = 30) => api.post('/ai-features/compliance-trends/analyze', { days }),

  // 2. AI Prompt Templates — returns { data, pagination }
  listPromptTemplates: (params = {}) => api.get('/ai-features/prompt-templates', { params }),
  createPromptTemplate: (data) => api.post('/ai-features/prompt-templates', data),
  updatePromptTemplate: (id, data) => api.put(`/ai-features/prompt-templates/${id}`, data),
  deletePromptTemplate: (id) => api.delete(`/ai-features/prompt-templates/${id}`),
  previewPrompt: (data) => api.post('/ai-features/prompt-templates/preview', data),

  // 3. Audit Trail — returns { data, pagination }
  auditTrail: (params = {}) => api.get('/ai-features/audit-trail', { params }),

  // 4. Regulatory Calendar — returns { data, pagination }
  listRegEvents: (params = {}) => api.get('/ai-features/regulatory-calendar', { params }),
  createRegEvent: (data) => api.post('/ai-features/regulatory-calendar', data),
  updateRegEvent: (id, data) => api.put(`/ai-features/regulatory-calendar/${id}`, data),
  deleteRegEvent: (id) => api.delete(`/ai-features/regulatory-calendar/${id}`),
  predictRegTimeline: (data) => api.post('/ai-features/regulatory-calendar/predict', data),

  // 5. Cross-Document Analysis
  crossDoc: (document_ids) => api.post('/ai-features/cross-document-analysis', { document_ids }),

  // 6. API Export
  exportUrl: (id, format = 'json') => `${API_BASE}/ai-features/export/${id}?format=${format}`,
  exportDoc: (id, format = 'json') =>
    api.get(`/ai-features/export/${id}`, {
      params: { format },
      ...(format === 'hl7' ? { responseType: 'text', transformResponse: [(d) => d] } : {}),
    }),

  // 7. Cost Analytics
  costAnalytics: (days = 30) => api.get('/ai-features/cost-analytics', { params: { days } }),
  logUsage: (data) => api.post('/ai-features/cost-analytics/log', data),
};

// Documents extended endpoints
export const docExtended = {
  versions: (id) => api.get(`/documents/${id}/versions`),
  exportPdfUrl: (id) => `${API_BASE}/documents/${id}/export/pdf`,
};

export default api;
