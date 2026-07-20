import api from './api';
import { SubscriptionRow, Pagination } from '../types';

export const subscriptionsService = {
  getSubscriptions: async (params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ success: boolean; data: SubscriptionRow[]; pagination: Pagination }> => {
    const response = await api.get('/educator/subscriptions', { params });
    return response.data;
  },

  getStats: async (): Promise<{ success: boolean; data: { total: number; active: number; expired: number; totalRevenue: number } }> => {
    const response = await api.get('/educator/subscriptions/stats');
    return response.data;
  },

  grantAccess: async (student_email: string, course_uuid: string) => {
    const response = await api.post('/educator/subscriptions/manual', { student_email, course_uuid });
    return response.data;
  },
};
