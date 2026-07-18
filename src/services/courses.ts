import api from './api';
import { Course, CourseModule, Lesson, LessonType, TestSeriesOption, QuizCategoryOption, PdfOption } from '../types';

export const coursesService = {
  getMyCourses: async (): Promise<{ success: boolean; data: Course[] }> => {
    const response = await api.get('/educator/courses');
    return response.data;
  },

  getCourseByUuid: async (uuid: string): Promise<{ success: boolean; data: Course }> => {
    const response = await api.get(`/educator/courses/${uuid}`);
    return response.data;
  },

  createCourse: async (data: { title: string; description?: string; test_series_id?: number | null }) => {
    const response = await api.post('/educator/courses', data);
    return response.data;
  },

  updateCourse: async (uuid: string, data: Partial<Course>) => {
    const response = await api.put(`/educator/courses/${uuid}`, data);
    return response.data;
  },

  setCourseStatus: async (uuid: string, status: Course['status']) => {
    const response = await api.patch(`/educator/courses/${uuid}/status`, { status });
    return response.data;
  },

  getAvailableTestSeries: async (): Promise<{ success: boolean; data: TestSeriesOption[] }> => {
    const response = await api.get('/educator/courses/available-test-series');
    return response.data;
  },

  getAvailableQuizCategories: async (): Promise<{ success: boolean; data: QuizCategoryOption[] }> => {
    const response = await api.get('/educator/courses/available-quiz-categories');
    return response.data;
  },

  getAvailablePdfs: async (): Promise<{ success: boolean; data: PdfOption[] }> => {
    const response = await api.get('/educator/courses/available-pdfs');
    return response.data;
  },

  createModule: async (courseUuid: string, title: string): Promise<{ success: boolean; data: CourseModule }> => {
    const response = await api.post(`/educator/courses/${courseUuid}/modules`, { title });
    return response.data;
  },

  reorderModules: async (courseUuid: string, orderedModuleUuids: string[]) => {
    const response = await api.patch(`/educator/courses/${courseUuid}/modules/reorder`, { orderedModuleUuids });
    return response.data;
  },

  deleteModule: async (moduleUuid: string) => {
    const response = await api.delete(`/educator/courses/modules/${moduleUuid}`);
    return response.data;
  },

  createLesson: async (
    moduleUuid: string,
    data: {
      title: string;
      lesson_type: LessonType;
      video_url?: string;
      content_html?: string;
      pdf_id?: string;
      category_id?: number;
      duration_minutes?: number;
      is_free_preview?: boolean;
    }
  ): Promise<{ success: boolean; data: Lesson }> => {
    const response = await api.post(`/educator/courses/modules/${moduleUuid}/lessons`, data);
    return response.data;
  },

  reorderLessons: async (moduleUuid: string, orderedLessonUuids: string[]) => {
    const response = await api.patch(`/educator/courses/modules/${moduleUuid}/lessons/reorder`, { orderedLessonUuids });
    return response.data;
  },

  deleteLesson: async (lessonUuid: string) => {
    const response = await api.delete(`/educator/courses/lessons/${lessonUuid}`);
    return response.data;
  },
};
