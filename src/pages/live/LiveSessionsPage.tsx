import React, { useState, useEffect } from 'react';
import { Plus, Video, Users, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { liveSessionsService, LiveSession, MeetingProvider, AttendanceRecord } from '../../services/liveSessions';
import { coursesService } from '../../services/courses';
import { Course } from '../../types';

const STATUS_BADGE: Record<LiveSession['status'], string> = {
  scheduled: 'bg-primary-50 text-primary-700',
  live: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [provider, setProvider] = useState<MeetingProvider>('google_meet');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      coursesService.getMyCourses().then((res) => setCourses(res.data || [])).catch(() => setCourses([]));
      setCourseId('');
      setTitle('');
      setScheduledStart('');
      setScheduledEnd('');
      setProvider('google_meet');
      setMeetingUrl('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !scheduledStart || !meetingUrl.trim()) {
      toast.error('Title, start time, and meeting URL are required');
      return;
    }
    setLoading(true);
    try {
      await liveSessionsService.createSession({
        course_id: courseId ? parseInt(courseId) : undefined,
        title,
        scheduled_start: new Date(scheduledStart).toISOString(),
        scheduled_end: scheduledEnd ? new Date(scheduledEnd).toISOString() : undefined,
        meeting_provider: provider,
        meeting_url: meetingUrl,
      });
      toast.success('Live session scheduled');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to schedule session');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Schedule Live Session</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Course (optional)</label>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">Not linked to a course</option>
              {courses.map((c) => <option key={c.uuid} value={c.id}>{c.title}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Session Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Organic Chemistry — L5 Live"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start *</label>
              <input
                type="datetime-local"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End (optional)</label>
              <input
                type="datetime-local"
                value={scheduledEnd}
                onChange={(e) => setScheduledEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
              <select value={provider} onChange={(e) => setProvider(e.target.value as MeetingProvider)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="google_meet">Google Meet</option>
                <option value="zoom">Zoom</option>
                <option value="jitsi">Jitsi (embeddable)</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Meeting URL *</label>
              <input
                type="text"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="https://meet.google.com/..."
                required
              />
            </div>
          </div>

          <div className="border-t pt-4 flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50" disabled={loading}>
              {loading ? 'Scheduling...' : 'Schedule Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const LiveSessionsPage: React.FC = () => {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<LiveSession | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const response = await liveSessionsService.getMySessions();
      setSessions(response.data || []);
    } catch (error) {
      toast.error('Failed to load live sessions');
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = async (session: LiveSession) => {
    setSelected(session);
    setLoadingAttendance(true);
    try {
      const response = await liveSessionsService.getAttendance(session.uuid);
      setAttendance(response.data || []);
    } catch (error) {
      toast.error('Failed to load attendance');
      setAttendance([]);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleStatusChange = async (session: LiveSession, status: LiveSession['status']) => {
    try {
      await liveSessionsService.updateStatus(session.uuid, status);
      toast.success(`Session marked ${status}`);
      loadSessions();
      if (selected?.uuid === session.uuid) setSelected({ ...session, status });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update session');
    }
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Sessions</h1>
          <p className="text-gray-600">Schedule sessions on Zoom, Google Meet, or Jitsi and track attendance</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary inline-flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Schedule Session
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          {sessions.length === 0 ? (
            <div className="p-12 text-center">
              <Video className="h-24 w-24 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No live sessions scheduled</h3>
              <button onClick={() => setShowModal(true)} className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Schedule Session
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {sessions.map((session) => (
                <div key={session.uuid} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="cursor-pointer flex-1" onClick={() => loadAttendance(session)}>
                      <h4 className="text-md font-medium text-gray-900">{session.title}</h4>
                      <p className="text-sm text-gray-600">{new Date(session.scheduled_start).toLocaleString()}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[session.status]}`}>
                          {session.status}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {session.attendeeCount ?? 0} attended
                        </span>
                        {session.course && <span className="text-xs text-gray-500">{session.course.title}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={session.meeting_url} target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-primary-600" title="Open meeting link">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      {session.status === 'scheduled' && (
                        <button onClick={() => handleStatusChange(session, 'live')} className="btn-secondary text-xs px-3 py-1.5">
                          Mark Live
                        </button>
                      )}
                      {session.status === 'live' && (
                        <button onClick={() => handleStatusChange(session, 'completed')} className="btn-primary text-xs px-3 py-1.5">
                          Mark Completed
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Attendance</h3>
          {!selected ? (
            <p className="text-sm text-gray-500">Select a session to view attendance</p>
          ) : loadingAttendance ? (
            <CardSkeleton />
          ) : attendance.length === 0 ? (
            <p className="text-sm text-gray-500">No one has joined "{selected.title}" yet</p>
          ) : (
            <ul className="space-y-2">
              {attendance.map((record) => (
                <li key={record.id} className="text-sm border-b border-gray-100 pb-2">
                  <p className="font-medium text-gray-900">{record.student.username}</p>
                  <p className="text-xs text-gray-500">
                    Joined {new Date(record.joined_at).toLocaleTimeString()}
                    {record.left_at && ` · left ${new Date(record.left_at).toLocaleTimeString()}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ScheduleModal isOpen={showModal} onClose={() => setShowModal(false)} onSuccess={loadSessions} />
    </div>
  );
};
