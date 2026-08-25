// Authentication types
export interface Educator {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  designation?: string;
  bio?: string;
  employee_code?: string;
  institution_id?: number | null;
  branch_id?: number | null;
  department_id?: number | null;
  institution?: { id: number; pricing_mode: 'school' | 'private_educator' | 'coaching_center' } | null;
  created_at?: string;
  last_login?: string;
}

export interface AuthResponse {
  educator: Educator;
  token: string;
  message: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// Course authoring types
export interface TestSeriesOption {
  id: number;
  uuid: string;
  name: string;
}

export interface QuizCategoryOption {
  id: number;
  uuid: string;
  name: string;
  node_type: 'unset' | 'container' | 'question_holder';
}

export interface PdfOption {
  id: string;
  title: string;
}

export interface CourseCategoryOption {
  id: number;
  uuid: string;
  name: string;
}

export interface AssignmentOption {
  id: number;
  uuid: string;
  title: string;
  submission_type: 'quiz' | 'file_upload' | 'text';
}

export interface LiveSessionOption {
  id: number;
  uuid: string;
  title: string;
  meeting_provider: 'zoom' | 'google_meet' | 'jitsi' | 'other';
  meeting_url: string;
  scheduled_start: string;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
}

// 'document' is legacy (pre-split text+pdf combined type) — still readable for
// old lessons but no longer offered when creating a new one.
export type LessonType = 'video' | 'document' | 'text' | 'pdf' | 'audio' | 'quiz' | 'live' | 'assignment';

export interface Lesson {
  id: number;
  uuid: string;
  course_module_id: number;
  title: string;
  lesson_type: LessonType;
  video_url?: string | null;
  content_html?: string | null;
  pdf_id?: string | null;
  category_id?: number | null;
  live_session_id?: number | null;
  assignment_id?: number | null;
  duration_minutes?: number | null;
  display_order: number;
  is_free_preview: boolean;
  is_active: boolean;
  liveSession?: LiveSessionOption | null;
  assignment?: AssignmentOption | null;
}

export interface CourseModule {
  id: number;
  uuid: string;
  course_id: number;
  title: string;
  display_order: number;
  is_active: boolean;
  lessons: Lesson[];
}

export type CourseStatus = 'draft' | 'published' | 'archived';

export interface Course {
  id: number;
  uuid: string;
  test_series_id?: number | null;
  educator_id: string;
  title: string;
  description?: string | null;
  thumbnail_url?: string | null;
  status: CourseStatus;
  completion_threshold_percent: number;
  testSeries?: { id: number; uuid: string; name: string; price?: number; pricing_type?: string; educator_id?: string | null };
  categories?: CourseCategoryOption[];
  modules?: CourseModule[];
  studentCount?: number;
  created_at?: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Student insights types
export type AccessType = 'paid' | 'free' | 'quiz';

export interface StudentRow {
  uuid: string;
  name: string | null;
  email: string | null;
  courses: string[];
  accessType: AccessType;
  lastActivity: string | null;
  quizAttempts: number;
}

export interface TestAttemptSummary {
  studentUuid: string;
  studentName: string | null;
  studentEmail: string | null;
  totalAttempts: number;
  completedAttempts: number;
  latestAttempt: {
    sessionId: string;
    categoryName: string | null;
    percentage: number | null;
    finalScore: number | null;
    completedAt: string | null;
  };
}

export interface TestAttemptDetail {
  sessionId: string;
  categoryName: string | null;
  percentage: number | null;
  finalScore: number | null;
  totalCorrect: number;
  totalWrong: number;
  totalQuestions: number;
  timeSpentSeconds: number | null;
  completedAt: string | null;
}

export type SubscriptionStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface SubscriptionRow {
  id: string;
  student: { uuid: string; name: string | null; email: string | null } | null;
  courseTitle: string | null;
  amountPaid: number;
  currency: string;
  status: SubscriptionStatus;
  purchaseDate: string;
  expiryDate: string | null;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
