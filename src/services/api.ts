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

// The backend's own origin, e.g. for static files under /uploads that live
// outside the /api prefix. Behind a reverse proxy VITE_API_URL is path-prefixed
// (https://host/backend/api), so a URL built from window.location or a raw
// host header would miss that prefix — deriving it from VITE_API_URL instead
// keeps it correct in every environment without hardcoding the prefix.
export const API_ORIGIN = (import.meta.env.VITE_API_URL as string).replace(/\/api\/?$/, '');

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
      // Only force a redirect if we actually had a session to expire — a failed
      // login attempt never had a token, and should just show its own inline error.
      const hadToken = !!sessionStorage.getItem(STORAGE_KEYS.TOKEN);

      sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
      sessionStorage.removeItem(STORAGE_KEYS.USER);

      if (hadToken) {
        window.location.href = import.meta.env.VITE_BASE_PATH || '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
