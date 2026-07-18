import api from './api';

export type SubmissionType = 'quiz' | 'file_upload' | 'text';
export type SubmissionStatus = 'submitted' | 'late' | 'graded' | 'returned';

export interface Assignment {
  id: number;
  uuid: string;
  course_id: number;
  title: string;
  description?: string | null;
  submission_type: SubmissionType;
  category_id?: number | null;
  max_points: number;
  due_date?: string | null;
  allow_late_submission: boolean;
  is_active: boolean;
  course?: { id: number; uuid: string; title: string };
  quizCategory?: { id: number; uuid: string; name: string };
  pendingCount?: number;
  created_at?: string;
}

export interface AssignmentSubmission {
  uuid: string;
  studentUuid?: string;
  studentName?: string;
  studentEmail?: string;
  submission_text?: string | null;
  file_url?: string | null;
  status?: SubmissionStatus;
  grade?: number | null;
  feedback?: string | null;
  submitted_at?: string;
  student?: { uuid: string; username: string; email: string };
  // Quiz-result shape (when the assignment.submission_type === 'quiz')
  score?: number;
  percentage?: number;
  completedAt?: string;
}

export const assignmentsService = {
  getAllMyAssignments: async (): Promise<{ success: boolean; data: Assignment[] }> => {
    const response = await api.get('/educator/assignments');
    return response.data;
  },

  createAssignment: async (
    courseUuid: string,
    data: {
      title: string;
      description?: string;
      submission_type: SubmissionType;
      category_id?: number;
      max_points?: number;
      due_date?: string;
      allow_late_submission?: boolean;
    }
  ) => {
    const response = await api.post(`/educator/courses/${courseUuid}/assignments`, data);
    return response.data;
  },

  deleteAssignment: async (uuid: string) => {
    const response = await api.delete(`/educator/assignments/${uuid}`);
    return response.data;
  },

  getSubmissions: async (assignmentUuid: string): Promise<{ success: boolean; data: AssignmentSubmission[]; quizResults: boolean }> => {
    const response = await api.get(`/educator/assignments/${assignmentUuid}/submissions`);
    return response.data;
  },

  gradeSubmission: async (submissionUuid: string, grade: number, feedback?: string) => {
    const response = await api.patch(`/educator/submissions/${submissionUuid}/grade`, { grade, feedback });
    return response.data;
  },
};
