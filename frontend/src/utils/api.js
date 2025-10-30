import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('voxflow_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('voxflow_token');
      localStorage.removeItem('voxflow_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  register: (data) => api.post('/api/auth/register', data),
  getMe: () => api.get('/api/auth/me'),
};

// API Key Management APIs
export const apiKeyAPI = {
  getAll: () => api.get('/api/api-keys/status'),
  save: (provider, data) => api.post(`/api/api-keys/${provider}`, data),
  update: (provider, data) => api.put(`/api/api-keys/${provider}`, data),
  delete: (provider) => api.delete(`/api/api-keys/${provider}`),
  validate: (provider, data) => api.get(`/api/api-keys/validate?providers=${provider}`),
};

// Agent APIs
export const agentAPI = {
  create: (data) => api.post('/api/agents', data),
  getAll: () => api.get('/api/agents'),
  getById: (id) => api.get(`/api/agents/${id}`),
  update: (id, data) => api.put(`/api/agents/${id}`, data),
  delete: (id) => api.delete(`/api/agents/${id}`),
  getRuns: (id, params) => api.get(`/api/agents/${id}/runs`, { params }),
};

// Call APIs
export const callAPI = {
  startWebCall: (data) => api.post('/api/calls/web/start', data),
  processMessage: (data) => api.post('/api/calls/web/message', data),
  endWebCall: (data) => api.post('/api/calls/web/end', data),
  startPhoneCall: (data) => api.post('/api/calls/phone/start', data),
  getRun: (id) => api.get(`/api/calls/run/${id}`),
  getTranscript: (id) => api.get(`/api/calls/transcript/${id}`),
};

// Campaign APIs
export const campaignAPI = {
  create: (formData) => api.post('/api/campaigns', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getAll: () => api.get('/api/campaigns'),
  getById: (id) => api.get(`/api/campaigns/${id}`),
  start: (id) => api.post(`/api/campaigns/${id}/start`),
  pause: (id) => api.post(`/api/campaigns/${id}/pause`),
  resume: (id) => api.post(`/api/campaigns/${id}/resume`),
  stop: (id) => api.post(`/api/campaigns/${id}/stop`),
};

// Config APIs
export const configAPI = {
  getService: () => api.get('/api/config/service'),
  saveService: (data) => api.post('/api/config/service', data),
  getTelephony: () => api.get('/api/config/telephony'),
  saveTelephony: (data) => api.post('/api/config/telephony', data),
};

// Usage APIs
export const usageAPI = {
  getDashboard: (params) => api.get('/api/usage/dashboard', { params }),
  getHistory: (params) => api.get('/api/usage/history', { params }),
};

// Report APIs
export const reportAPI = {
  getDaily: (params) => api.get('/api/reports/daily', { params }),
  downloadCSV: (params) => api.get('/api/reports/download', { 
    params,
    responseType: 'blob',
  }),
};

// Admin APIs
export const adminAPI = {
  // Dashboard and Analytics
  getDashboard: () => api.get('/api/admin/dashboard'),
  getPlatformOverview: () => api.get('/api/admin/analytics/overview'),
  getUserGrowthAnalytics: (params) => api.get('/api/admin/analytics/user-growth', { params }),
  getUsageAnalytics: (params) => api.get('/api/admin/analytics/usage', { params }),
  getRevenueAnalytics: () => api.get('/api/admin/analytics/revenue'),
  getSystemHealth: () => api.get('/api/admin/analytics/system-health'),
  
  // User Management
  getUsers: (params) => api.get('/api/admin/users', { params }),
  getUserById: (id) => api.get(`/api/admin/users/${id}`),
  updateUser: (id, data) => api.put(`/api/admin/users/${id}`, data),
  deactivateUser: (id) => api.post(`/api/admin/users/${id}/deactivate`),
  activateUser: (id) => api.post(`/api/admin/users/${id}/activate`),
  
  // Audit Logs
  getAuditLogs: (params) => api.get('/api/admin/audit-logs', { params }),
  
  // Data Export
  exportAnalyticsData: (type, params) => api.get(`/api/admin/analytics/export/${type}`, { 
    params,
    responseType: 'blob',
  }),
};

export default api;