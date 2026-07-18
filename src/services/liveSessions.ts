import api from './api';

export type MeetingProvider = 'zoom' | 'google_meet' | 'jitsi' | 'other';
export type LiveSessionStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';

export interface LiveSession {
  id: number;
  uuid: string;
  course_id?: number | null;
  title: string;
  description?: string | null;
  scheduled_start: string;
  scheduled_end?: string | null;
  meeting_provider: MeetingProvider;
  meeting_url: string;
  status: LiveSessionStatus;
  course?: { id: number; uuid: string; title: string };
  attendeeCount?: number;
}

export interface AttendanceRecord {
  id: number;
  joined_at: string;
  left_at?: string | null;
  duration_seconds?: number | null;
  student: { uuid: string; username: string; email: string };
}

export const liveSessionsService = {
  getMySessions: async (): Promise<{ success: boolean; data: LiveSession[] }> => {
    const response = await api.get('/educator/live-sessions');
    return response.data;
  },

  createSession: async (data: {
    course_id?: number;
    title: string;
    description?: string;
    scheduled_start: string;
    scheduled_end?: string;
    meeting_provider: MeetingProvider;
    meeting_url: string;
  }) => {
    const response = await api.post('/educator/live-sessions', data);
    return response.data;
  },

  updateStatus: async (uuid: string, status: LiveSessionStatus) => {
    const response = await api.put(`/educator/live-sessions/${uuid}`, { status });
    return response.data;
  },

  cancelSession: async (uuid: string) => {
    const response = await api.patch(`/educator/live-sessions/${uuid}/cancel`);
    return response.data;
  },

  getAttendance: async (uuid: string): Promise<{ success: boolean; data: AttendanceRecord[] }> => {
    const response = await api.get(`/educator/live-sessions/${uuid}/attendance`);
    return response.data;
  },
};
