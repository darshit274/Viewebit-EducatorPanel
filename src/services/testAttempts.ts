import api from './api';
import { TestAttemptSummary, TestAttemptDetail, Pagination } from '../types';

export const testAttemptsService = {
  getTestAttempts: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ success: boolean; data: TestAttemptSummary[]; pagination: Pagination }> => {
    const response = await api.get('/educator/test-attempts', { params });
    return response.data;
  },

  getStudentTestAttempts: async (
    studentUuid: string
  ): Promise<{ success: boolean; data: { student: { uuid: string; name: string | null; email: string | null }; attempts: TestAttemptDetail[] } }> => {
    const response = await api.get(`/educator/test-attempts/${studentUuid}`);
    return response.data;
  },
};
