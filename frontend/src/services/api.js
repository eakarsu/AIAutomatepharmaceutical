import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
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
  getByCategory: (category, search) => api.get(`/documents/category/${category}`, { params: { search } }),
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
};

export default api;
