export const ENV = {
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  IS_DEVELOPMENT: import.meta.env.DEV,
  IS_PRODUCTION: import.meta.env.PROD,
} as const;

export const APP_CONFIG = {
  NAME: 'Viewebit Educator',
  VERSION: '1.0.0',
  DESCRIPTION: 'Educator Panel for Viewebit Education Platform',
  COMPANY: 'Viewebit Academy',
} as const;

export const STORAGE_KEYS = {
  TOKEN: 'educator_token',
  USER: 'educator_user',
} as const;
