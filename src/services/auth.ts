import api from './api';
import { AuthResponse, LoginCredentials, Educator } from '../types';
import { STORAGE_KEYS } from '../config/constants';

interface OTPVerificationData {
  email: string;
  otp: string;
}

interface ResendOTPData {
  email: string;
}

interface LoginResponse {
  email: string;
  requiresOTP: boolean;
}

export const authService = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await api.post('/educator/login', credentials);
    return response.data.data;
  },

  verifyOTP: async (data: OTPVerificationData): Promise<AuthResponse> => {
    const response = await api.post('/educator/verify-otp', data);
    const { data: responseData } = response.data;

    sessionStorage.setItem(STORAGE_KEYS.TOKEN, responseData.token);
    sessionStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(responseData.educator));

    return responseData;
  },

  resendOTP: async (data: ResendOTPData): Promise<void> => {
    await api.post('/educator/resend-otp', data);
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/educator/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
      sessionStorage.removeItem(STORAGE_KEYS.USER);
    }
  },

  getProfile: async (): Promise<Educator> => {
    const response = await api.get('/educator/profile');
    return response.data.data;
  },

  isAuthenticated: (): boolean => {
    const token = sessionStorage.getItem(STORAGE_KEYS.TOKEN);
    const user = sessionStorage.getItem(STORAGE_KEYS.USER);
    return !!(token && user);
  },

  getCurrentEducator: (): Educator | null => {
    const userStr = sessionStorage.getItem(STORAGE_KEYS.USER);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  },
};
