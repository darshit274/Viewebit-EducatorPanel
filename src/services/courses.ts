import api from './api';
import { Course, CourseModule, Lesson, LessonType, TestSeriesOption, QuizCategoryOption, PdfOption, CourseCategoryOption, AssignmentOption, LiveSessionOption } from '../types';

export const coursesService = {
  getMyCourses: async (): Promise<{ success: boolean; data: Course[] }> => {
    const response = await api.get('/educator/courses');
    return response.data;
  },

  getCourseByUuid: async (uuid: string): Promise<{ success: boolean; data: Course }> => {
    const response = await api.get(`/educator/courses/${uuid}`);
    return response.data;
  },

  createCourse: async (data: { title: string; description?: string; test_series_id?: number | null; price?: number; category_ids?: number[] }) => {
    const response = await api.post('/educator/courses', data);
    return response.data;
  },

  updateCourse: async (uuid: string, data: Partial<Course> & { price?: number; category_ids?: number[] }) => {
    const response = await api.put(`/educator/courses/${uuid}`, data);
    return response.data;
  },

  getCourseCategories: async (): Promise<{ success: boolean; data: CourseCategoryOption[] }> => {
    const response = await api.get('/educator/courses/categories');
    return response.data;
  },

  createCourseCategory: async (name: string): Promise<{ success: boolean; data: CourseCategoryOption }> => {
    const response = await api.post('/educator/courses/categories', { name });
    return response.data;
  },

  uploadThumbnail: async (uuid: string, file: File): Promise<{ success: boolean; data: { thumbnail_url: string } }> => {
    const formData = new FormData();
    formData.append('thumbnail', file);
    const response = await api.post(`/educator/courses/${uuid}/thumbnail`, formData);
    return response.data;
  },

  uploadCoursePdf: async (courseUuid: string, title: string, file: File, description?: string): Promise<{ success: boolean; data: { id: string; title: string } }> => {
    const formData = new FormData();
    formData.append('title', title);
    if (description) formData.append('description', description);
    formData.append('file', file);
    const response = await api.post(`/educator/courses/${courseUuid}/pdfs`, formData);
    return response.data;
  },

  createCourseQuizCategory: async (courseUuid: string, name: string): Promise<{ success: boolean; data: QuizCategoryOption }> => {
    const response = await api.post(`/educator/courses/${courseUuid}/quiz-categories`, { name });
    return response.data;
  },

  uploadLessonMedia: async (courseUuid: string, kind: 'video' | 'audio', file: File): Promise<{ success: boolean; data: { url: string } }> => {
    const formData = new FormData();
    formData.append('kind', kind);
    formData.append('file', file);
    const response = await api.post(`/educator/courses/${courseUuid}/lessons/media`, formData);
    return response.data;
  },

  setCourseStatus: async (uuid: string, status: Course['status']) => {
    const response = await api.patch(`/educator/courses/${uuid}/status`, { status });
    return response.data;
  },

  deleteCourse: async (uuid: string) => {
    const response = await api.delete(`/educator/courses/${uuid}`);
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

  getAvailableAssignments: async (courseId: number): Promise<{ success: boolean; data: AssignmentOption[] }> => {
    const response = await api.get('/educator/courses/available-assignments', { params: { course_id: courseId } });
    return response.data;
  },

  getAvailableLiveSessions: async (courseId: number, provider?: string): Promise<{ success: boolean; data: LiveSessionOption[] }> => {
    const response = await api.get('/educator/courses/available-live-sessions', { params: { course_id: courseId, provider } });
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

  updateModule: async (moduleUuid: string, data: { title?: string }): Promise<{ success: boolean; data: CourseModule }> => {
    const response = await api.put(`/educator/courses/modules/${moduleUuid}`, data);
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
      live_session_id?: number;
      assignment_id?: number;
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

  updateLesson: async (
    lessonUuid: string,
    data: {
      title?: string;
      video_url?: string;
      content_html?: string;
      pdf_id?: string;
      category_id?: number;
      live_session_id?: number;
      assignment_id?: number;
      duration_minutes?: number;
      is_free_preview?: boolean;
    }
  ): Promise<{ success: boolean; data: Lesson }> => {
    const response = await api.put(`/educator/courses/lessons/${lessonUuid}`, data);
    return response.data;
  },

  deleteLesson: async (lessonUuid: string) => {
    const response = await api.delete(`/educator/courses/lessons/${lessonUuid}`);
    return response.data;
  },
};
