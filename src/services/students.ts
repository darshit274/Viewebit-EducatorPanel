import api from './api';
import { StudentRow, Pagination } from '../types';

export const studentsService = {
  getStudents: async (params?: {
    search?: string;
    access_type?: string;
    page?: number;
    limit?: number;
  }): Promise<{ success: boolean; data: StudentRow[]; pagination: Pagination }> => {
    const response = await api.get('/educator/students', { params });
    return response.data;
  },
};
