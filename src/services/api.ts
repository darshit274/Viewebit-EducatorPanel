import axios from 'axios';
import { STORAGE_KEYS } from '../config/constants';

const DEFAULT_API_TIMEOUT_MS = parseInt(
  import.meta.env.VITE_API_TIMEOUT_MS as string,
  10
) || 120000;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: DEFAULT_API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem(STORAGE_KEYS.TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Let the browser set the multipart boundary itself for file uploads.
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
      sessionStorage.removeItem(STORAGE_KEYS.USER);
      if (!window.location.href.includes('login')) {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
