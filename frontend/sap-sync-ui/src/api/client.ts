// SAP B1 adapter axios instance — token read from localStorage (no circular dep)
import axios from 'axios';
import { VITE_APP_API_URL } from '../features/config';

export const sapApi = axios.create({
  baseURL: `${VITE_APP_API_URL}/sap`,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
sapApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
