import api from './api';

export interface MyTestSeries {
  id: number;
  uuid: string;
  name: string;
  description?: string | null;
  pricing_type: 'free' | 'paid';
  price: number;
  currency: string;
  is_active: boolean;
  categoriesCount: number;
  created_at: string;
  course?: { uuid: string; title: string } | null;
}

export const testSeriesService = {
  listMine: async (): Promise<MyTestSeries[]> => {
    const response = await api.get('/educator/test-series');
    return response.data.data;
  },

  create: async (data: { title: string; description?: string; price?: number } | { course_uuid: string }) => {
    const response = await api.post('/educator/test-series', data);
    return response.data.data as MyTestSeries;
  },

  update: async (uuid: string, data: { title?: string; description?: string; price?: number; is_active?: boolean }) => {
    const response = await api.put(`/educator/test-series/${uuid}`, data);
    return response.data.data as MyTestSeries;
  },

  remove: async (uuid: string) => {
    await api.delete(`/educator/test-series/${uuid}`);
  },
};
