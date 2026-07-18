import api from './api';

export type NodeType = 'unset' | 'container' | 'question_holder';

export interface QuizCategory {
  id: number;
  uuid: string;
  name: string;
  description?: string | null;
  node_type: NodeType;
  parent_category_id: number | null;
  is_active: boolean;
  test_duration_minutes: number;
}

export interface QuizQuestion {
  id: number;
  uuid: string;
  category_id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation?: string | null;
  marks: number;
  is_active: boolean;
}

export interface CategoryContent {
  category: QuizCategory & {
    childCategories: QuizCategory[];
    questions: QuizQuestion[];
    parentCategory?: { id: number; uuid: string; name: string } | null;
  };
  childCount: number;
  questionCount: number;
}

export const quizHierarchyService = {
  getRootCategories: async (): Promise<{ success: boolean; data: QuizCategory[] }> => {
    const response = await api.get('/educator/quizzes/roots');
    return response.data;
  },

  getCategoryContent: async (categoryUuid: string): Promise<{ success: boolean; data: CategoryContent }> => {
    const response = await api.get(`/educator/quizzes/categories/${categoryUuid}`);
    return response.data;
  },

  createRootCategory: async (name: string, description?: string) => {
    const response = await api.post('/educator/quizzes/categories', { name, description });
    return response.data;
  },

  createSubcategory: async (parentUuid: string, name: string, description?: string) => {
    const response = await api.post(`/educator/quizzes/categories/${parentUuid}/subcategories`, { name, description });
    return response.data;
  },

  updateCategory: async (categoryUuid: string, data: Partial<QuizCategory>) => {
    const response = await api.put(`/educator/quizzes/categories/${categoryUuid}`, data);
    return response.data;
  },

  deleteCategory: async (categoryUuid: string) => {
    const response = await api.delete(`/educator/quizzes/categories/${categoryUuid}`);
    return response.data;
  },

  createQuestion: async (
    categoryUuid: string,
    data: {
      question_text: string;
      option_a: string;
      option_b: string;
      option_c: string;
      option_d: string;
      correct_answer: 'A' | 'B' | 'C' | 'D';
      explanation?: string;
      marks?: number;
    }
  ) => {
    const response = await api.post(`/educator/quizzes/categories/${categoryUuid}/questions`, data);
    return response.data;
  },

  deleteQuestion: async (questionUuid: string) => {
    const response = await api.delete(`/educator/quizzes/questions/${questionUuid}`);
    return response.data;
  },
};
