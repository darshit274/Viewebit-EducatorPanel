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

export type LessonType = 'video' | 'document' | 'quiz' | 'live';

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
  duration_minutes?: number | null;
  display_order: number;
  is_free_preview: boolean;
  is_active: boolean;
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
  testSeries?: { id: number; uuid: string; name: string };
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
