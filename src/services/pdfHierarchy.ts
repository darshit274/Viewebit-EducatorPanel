import api from './api';

export type PdfNodeType = 'unset' | 'container' | 'pdf_holder';

export interface PdfCategoryNode {
  id: number;
  uuid: string;
  name: string;
  description?: string | null;
  node_type: PdfNodeType;
  parent_category_id: number | null;
  is_active: boolean;
}

export interface PdfItem {
  id: string;
  title: string;
  description?: string | null;
  original_filename: string;
  file_size: number;
  is_active: boolean;
}

export interface PdfCategoryContent {
  category: PdfCategoryNode & {
    childCategories: PdfCategoryNode[];
    pdfs: PdfItem[];
    parentCategory?: { id: number; uuid: string; name: string } | null;
  };
  childCount: number;
  pdfCount: number;
}

export const pdfHierarchyService = {
  getRootCategories: async (): Promise<{ success: boolean; data: PdfCategoryNode[] }> => {
    const response = await api.get('/educator/pdfs/roots');
    return response.data;
  },

  getCategoryContent: async (categoryUuid: string): Promise<{ success: boolean; data: PdfCategoryContent }> => {
    const response = await api.get(`/educator/pdfs/categories/${categoryUuid}`);
    return response.data;
  },

  createRootCategory: async (name: string, description?: string) => {
    const response = await api.post('/educator/pdfs/categories', { name, description });
    return response.data;
  },

  createSubcategory: async (parentUuid: string, name: string, description?: string) => {
    const response = await api.post(`/educator/pdfs/categories/${parentUuid}/subcategories`, { name, description });
    return response.data;
  },

  deleteCategory: async (categoryUuid: string) => {
    const response = await api.delete(`/educator/pdfs/categories/${categoryUuid}`);
    return response.data;
  },

  uploadPdf: async (categoryUuid: string, title: string, file: File, description?: string) => {
    const formData = new FormData();
    formData.append('title', title);
    if (description) formData.append('description', description);
    formData.append('file', file);
    const response = await api.post(`/educator/pdfs/categories/${categoryUuid}/upload`, formData);
    return response.data;
  },

  deletePdf: async (pdfId: string) => {
    const response = await api.delete(`/educator/pdfs/pdfs/${pdfId}`);
    return response.data;
  },
};
