import axios from 'axios';

const API_BASE_URL = process.env.API_URL || process.env.REACT_APP_API_URL || 'https://expense-sharing-backend-4gsh.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data if token is invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (name, email, password) =>
    api.post('/users/register', { name, email, password }),
  login: (email, password) =>
    api.post('/users/login', { email, password }),
  getCurrentUser: () => api.get('/users/me'),
  getAllUsers: () => api.get('/users'),
};

export const groupAPI = {
  createGroup: (name, description, memberIds) =>
    api.post('/groups', { name, description, memberIds }),
  getUserGroups: () => api.get('/groups'),
  getGroupById: (id) => api.get(`/groups/${id}`),
  addMemberToGroup: (groupId, userId) =>
    api.post(`/groups/${groupId}/members`, { userId }),
  deleteGroup: (id) => api.delete(`/groups/${id}`),
};

export const expenseAPI = {
  createExpense: (description, amount, groupId, splitType, splits, percentages, category, notes) =>
    api.post('/expenses', {
      description,
      amount,
      groupId,
      splitType,
      splits,
      percentages,
      category,
      notes,
    }),
  getGroupExpenses: (groupId) =>
    api.get(`/expenses/group/${groupId}`),
  getExpenseById: (id) => api.get(`/expenses/${id}`),
  deleteExpense: (id) => api.delete(`/expenses/${id}`),
  // expenses involving current user across groups
  getMyExpenses: () => api.get('/expenses/me'),
};

export const balanceAPI = {
  getGroupBalances: (groupId) =>
    api.get(`/balances/group/${groupId}`),
  getUserBalance: (groupId, userId) =>
    api.get(`/balances/group/${groupId}/user/${userId}`),
  // overall balances for authenticated user across all groups
  getOverallUserBalance: () => api.get('/balances/me'),
};

export const settlementAPI = {
  createSettlement: (groupId, toUserId, amount, note) =>
    api.post(`/settlements/group/${groupId}`, { toUserId, amount, note }),
  getGroupSettlements: (groupId) => api.get(`/settlements/group/${groupId}`),
  // settlements involving current user across groups
  getMySettlements: () => api.get('/settlements/me'),
  deleteSettlement: (id) => api.delete(`/settlements/${id}`),
};

export const paymentAPI = {
  createCheckoutSession: (groupId, toUserId, amount) =>
    api.post(`/payments/create-session/${groupId}`, { toUserId, amount }),
  confirmPayment: (sessionId) => api.post(`/payments/confirm`, { sessionId }),
};

export default api;
