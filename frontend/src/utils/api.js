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
  getMe: () => api.get('/api/auth/me'),
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

export default api;