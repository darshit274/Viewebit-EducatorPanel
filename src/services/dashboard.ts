import api from './api';

export interface EducatorDashboardStats {
  totalCourses: number;
  totalStudents: number;
  pendingGrading: number;
  upcomingLiveSessions: number;
}

export const dashboardService = {
  getStats: async (): Promise<{ success: boolean; data: EducatorDashboardStats }> => {
    const response = await api.get('/educator/dashboard/stats');
    return response.data;
  },
};
