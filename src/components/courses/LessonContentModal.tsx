import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { coursesService } from '../../services/courses';
import { liveSessionsService, MeetingProvider } from '../../services/liveSessions';
import { Lesson, LessonType, PdfOption, QuizCategoryOption, AssignmentOption, LiveSessionOption } from '../../types';
import { RichTextEditor } from './RichTextEditor';
import { ContentTypeSelection } from './ContentTypePicker';

const PROVIDER_LABEL: Record<MeetingProvider, string> = {
  jitsi: 'Live Stream',
  google_meet: 'Google Meet',
  zoom: 'Zoom Meeting',
  other: 'Meeting',
};

function toYoutubeEmbed(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

interface LessonContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  courseId: number;
  moduleUuid?: string; // required for create
  lesson?: Lesson | null; // present for edit
  initialSelection?: ContentTypeSelection | null; // present for create
}

export const LessonContentModal: React.FC<LessonContentModalProps> = ({
  isOpen, onClose, onSuccess, courseId, moduleUuid, lesson, initialSelection,
}) => {
  if (!isOpen) return null;
  const key = lesson ? `edit-${lesson.uuid}` : `create-${initialSelection?.lessonType}-${initialSelection?.meetingProvider ?? ''}`;
  return (
    <LessonContentForm
      key={key}
      onClose={onClose}
      onSuccess={onSuccess}
      courseId={courseId}
      moduleUuid={moduleUuid}
      lesson={lesson ?? null}
      initialSelection={initialSelection ?? null}
    />
  );
};

const LessonContentForm: React.FC<Omit<LessonContentModalProps, 'isOpen'>> = ({
  onClose, onSuccess, courseId, moduleUuid, lesson, initialSelection,
}) => {
  const lessonType: LessonType = lesson?.lesson_type ?? initialSelection?.lessonType ?? 'text';
  const meetingProvider: MeetingProvider = (lesson?.liveSession?.meeting_provider as MeetingProvider) ?? initialSelection?.meetingProvider ?? 'other';

  const [title, setTitle] = useState(lesson?.title ?? '');
  const [contentHtml, setContentHtml] = useState(lesson?.content_html ?? '');
  const [mediaUrl, setMediaUrl] = useState(lesson?.video_url ?? '');
  const [pdfId, setPdfId] = useState(lesson?.pdf_id ?? '');
  const [categoryId, setCategoryId] = useState(lesson?.category_id ? String(lesson.category_id) : '');
  const [assignmentId, setAssignmentId] = useState(lesson?.assignment_id ? String(lesson.assignment_id) : '');
  const [liveSessionId, setLiveSessionId] = useState(lesson?.live_session_id ? String(lesson.live_session_id) : '');
  const [isFreePreview, setIsFreePreview] = useState(lesson?.is_free_preview ?? false);
  const [loading, setLoading] = useState(false);

  const [pdfs, setPdfs] = useState<PdfOption[]>([]);
  const [quizCategories, setQuizCategories] = useState<QuizCategoryOption[]>([]);
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSessionOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  const [showNewSession, setShowNewSession] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionStart, setNewSessionStart] = useState('');
  const [newSessionUrl, setNewSessionUrl] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);

  useEffect(() => {
    setOptionsLoading(true);
    const load = async () => {
      try {
        if (lessonType === 'pdf' || lessonType === 'document') {
          const res = await coursesService.getAvailablePdfs();
          setPdfs(res.data || []);
        } else if (lessonType === 'quiz') {
          const res = await coursesService.getAvailableQuizCategories();
          setQuizCategories(res.data || []);
        } else if (lessonType === 'assignment') {
          const res = await coursesService.getAvailableAssignments(courseId);
          setAssignments(res.data || []);
        } else if (lessonType === 'live') {
          const res = await coursesService.getAvailableLiveSessions(courseId, lesson ? undefined : meetingProvider);
          setLiveSessions(res.data || []);
        }
      } catch {
        toast.error('Failed to load options');
      } finally {
        setOptionsLoading(false);
      }
    };
    load();
  }, [lessonType]);

  const handleCreateSession = async () => {
    if (!newSessionTitle.trim() || !newSessionStart || !newSessionUrl.trim()) {
      toast.error('Title, date/time, and meeting link are all required');
      return;
    }
    setCreatingSession(true);
    try {
      const res = await liveSessionsService.createSession({
        course_id: courseId,
        title: newSessionTitle,
        scheduled_start: new Date(newSessionStart).toISOString(),
        meeting_provider: meetingProvider,
        meeting_url: newSessionUrl,
      });
      const created: LiveSessionOption = res.data;
      setLiveSessions((prev) => [created, ...prev]);
      setLiveSessionId(String(created.id));
      setShowNewSession(false);
      setNewSessionTitle('');
      setNewSessionStart('');
      setNewSessionUrl('');
      toast.success('Session scheduled');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to schedule session');
    } finally {
      setCreatingSession(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (lessonType === 'video' && !mediaUrl.trim()) return toast.error('Video URL is required');
    if (lessonType === 'audio' && !mediaUrl.trim()) return toast.error('Audio URL is required');
    if (lessonType === 'text' && !contentHtml.trim()) return toast.error('Lesson content is required');
    if (lessonType === 'pdf' && !pdfId) return toast.error('Select a PDF');
    if (lessonType === 'quiz' && !categoryId) return toast.error('Select a quiz category');
    if (lessonType === 'assignment' && !assignmentId) return toast.error('Select an assignment');
    if (lessonType === 'live' && !liveSessionId) return toast.error('Select or schedule a session');

    const payload = {
      title,
      lesson_type: lessonType,
      video_url: lessonType === 'video' || lessonType === 'audio' ? mediaUrl : undefined,
      content_html: lessonType === 'text' || lessonType === 'document' ? contentHtml : undefined,
      pdf_id: lessonType === 'pdf' || lessonType === 'document' ? pdfId : undefined,
      category_id: lessonType === 'quiz' ? parseInt(categoryId) : undefined,
      assignment_id: lessonType === 'assignment' ? parseInt(assignmentId) : undefined,
      live_session_id: lessonType === 'live' ? parseInt(liveSessionId) : undefined,
      is_free_preview: isFreePreview,
    };

    setLoading(true);
    try {
      if (lesson) {
        await coursesService.updateLesson(lesson.uuid, payload);
        toast.success('Lesson updated');
      } else if (moduleUuid) {
        await coursesService.createLesson(moduleUuid, payload);
        toast.success('Content added');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save content');
    } finally {
      setLoading(false);
    }
  };

  const youtubeEmbed = lessonType === 'video' ? toYoutubeEmbed(mediaUrl) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          {lesson ? 'Edit Content' : `Add ${lessonType === 'live' ? PROVIDER_LABEL[meetingProvider] : lessonType[0].toUpperCase() + lessonType.slice(1)} Content`}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          {lessonType === 'text' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Content *</label>
              <RichTextEditor value={contentHtml} onChange={setContentHtml} placeholder="Write the lesson content..." />
            </div>
          )}

          {lessonType === 'document' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                This is a legacy Document lesson (combined text + PDF). New content should use the Text or PDF cards instead.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Use an existing PDF</label>
                <select
                  value={pdfId}
                  onChange={(e) => setPdfId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={optionsLoading}
                >
                  <option value="">None</option>
                  {pdfs.map((pdf) => (
                    <option key={pdf.id} value={pdf.id}>{pdf.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Or write content directly</label>
                <RichTextEditor value={contentHtml} onChange={setContentHtml} placeholder="Write the lesson content..." />
              </div>
            </div>
          )}

          {(lessonType === 'video' || lessonType === 'audio') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{lessonType === 'video' ? 'Video URL *' : 'Audio URL *'}</label>
              <input
                type="text"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {youtubeEmbed && (
                <div className="mt-3 aspect-video rounded-md overflow-hidden border border-gray-200">
                  <iframe src={youtubeEmbed} className="w-full h-full" allowFullScreen title="Video preview" />
                </div>
              )}
              {!youtubeEmbed && lessonType === 'video' && mediaUrl && (
                <video src={mediaUrl} controls className="mt-3 w-full rounded-md border border-gray-200 max-h-64" />
              )}
              {lessonType === 'audio' && mediaUrl && (
                <audio src={mediaUrl} controls className="mt-3 w-full" />
              )}
            </div>
          )}

          {lessonType === 'pdf' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">PDF *</label>
              <select
                value={pdfId}
                onChange={(e) => setPdfId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={optionsLoading}
              >
                <option value="">{optionsLoading ? 'Loading...' : 'Select a PDF'}</option>
                {pdfs.map((pdf) => (
                  <option key={pdf.id} value={pdf.id}>{pdf.title}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Don't see your PDF? Upload one in <a href="/pdfs" className="text-primary-600 hover:underline">PDF Library</a> first.
              </p>
            </div>
          )}

          {lessonType === 'quiz' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quiz Category *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={optionsLoading}
              >
                <option value="">{optionsLoading ? 'Loading...' : 'Select a quiz category'}</option>
                {quizCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Don't see the quiz you need? Build one in <a href="/quizzes" className="text-primary-600 hover:underline">Quiz Categories</a> first.
              </p>
            </div>
          )}

          {lessonType === 'assignment' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assignment *</label>
              <select
                value={assignmentId}
                onChange={(e) => setAssignmentId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={optionsLoading}
              >
                <option value="">{optionsLoading ? 'Loading...' : 'Select an assignment'}</option>
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Don't see it? Create one in <a href="/assignments" className="text-primary-600 hover:underline">Assignments & Quizzes</a> for this course first.
              </p>
            </div>
          )}

          {lessonType === 'live' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">{PROVIDER_LABEL[meetingProvider]} Session *</label>
                <button type="button" onClick={() => setShowNewSession((v) => !v)} className="text-xs font-medium text-primary-600 hover:text-primary-700">
                  {showNewSession ? 'Cancel new session' : '+ Schedule new session'}
                </button>
              </div>

              {!showNewSession && (
                <select
                  value={liveSessionId}
                  onChange={(e) => setLiveSessionId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={optionsLoading}
                >
                  <option value="">{optionsLoading ? 'Loading...' : `Select a ${PROVIDER_LABEL[meetingProvider].toLowerCase()} session`}</option>
                  {liveSessions.map((s) => (
                    <option key={s.id} value={s.id}>{s.title} — {new Date(s.scheduled_start).toLocaleString()}</option>
                  ))}
                </select>
              )}

              {showNewSession && (
                <div className="border border-gray-200 rounded-md p-3 space-y-3 bg-gray-50">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Session Title *</label>
                    <input
                      type="text"
                      value={newSessionTitle}
                      onChange={(e) => setNewSessionTitle(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date & Time *</label>
                    <input
                      type="datetime-local"
                      value={newSessionStart}
                      onChange={(e) => setNewSessionStart(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Meeting Link *</label>
                    <input
                      type="text"
                      value={newSessionUrl}
                      onChange={(e) => setNewSessionUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateSession}
                    disabled={creatingSession}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    {creatingSession ? 'Scheduling...' : 'Schedule Session'}
                  </button>
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isFreePreview} onChange={(e) => setIsFreePreview(e.target.checked)} className="h-4 w-4 text-primary-600 rounded" />
            <span className="text-sm text-gray-700">Free preview (visible even to non-enrolled students)</span>
          </label>

          <div className="border-t pt-4 flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50" disabled={loading}>
              {loading ? 'Saving...' : lesson ? 'Save Changes' : 'Add Content'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
