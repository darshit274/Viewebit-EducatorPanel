import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Video, FileText, HelpCircle, Radio } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { coursesService } from '../../services/courses';
import { Course, CourseModule, Lesson, LessonType, QuizCategoryOption, PdfOption } from '../../types';

const LESSON_TYPE_ICON: Record<LessonType, React.ElementType> = {
  video: Video,
  document: FileText,
  quiz: HelpCircle,
  live: Radio,
};

interface LessonFormProps {
  moduleUuid: string;
  onCreated: () => void;
  onCancel: () => void;
}

const LessonForm: React.FC<LessonFormProps> = ({ moduleUuid, onCreated, onCancel }) => {
  const [title, setTitle] = useState('');
  const [lessonType, setLessonType] = useState<LessonType>('video');
  const [videoUrl, setVideoUrl] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [pdfId, setPdfId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isFreePreview, setIsFreePreview] = useState(false);
  const [quizCategories, setQuizCategories] = useState<QuizCategoryOption[]>([]);
  const [pdfs, setPdfs] = useState<PdfOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    coursesService.getAvailableQuizCategories().then((res) => setQuizCategories(res.data || [])).catch(() => setQuizCategories([]));
    coursesService.getAvailablePdfs().then((res) => setPdfs(res.data || [])).catch(() => setPdfs([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (lessonType === 'quiz' && !categoryId) {
      toast.error('Select a quiz category for this quiz lesson');
      return;
    }
    if (lessonType === 'document' && !pdfId && !contentHtml.trim()) {
      toast.error('Select a PDF or write document content');
      return;
    }
    if (lessonType === 'video' && !videoUrl.trim()) {
      toast.error('Video URL is required');
      return;
    }

    setLoading(true);
    try {
      await coursesService.createLesson(moduleUuid, {
        title,
        lesson_type: lessonType,
        video_url: lessonType === 'video' ? videoUrl : undefined,
        content_html: lessonType === 'document' ? contentHtml || undefined : undefined,
        pdf_id: lessonType === 'document' && pdfId ? pdfId : undefined,
        category_id: lessonType === 'quiz' && categoryId ? parseInt(categoryId) : undefined,
        is_free_preview: isFreePreview,
      });
      toast.success('Lesson added');
      onCreated();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add lesson');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3 mt-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Lesson Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Type *</label>
          <select
            value={lessonType}
            onChange={(e) => setLessonType(e.target.value as LessonType)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="video">Video</option>
            <option value="document">Document</option>
            <option value="quiz">Quiz (Quiz Category)</option>
            <option value="live">Live Session</option>
          </select>
        </div>
      </div>

      {lessonType === 'video' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Video URL *</label>
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      )}

      {lessonType === 'document' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Use an existing PDF</label>
            <select
              value={pdfId}
              onChange={(e) => setPdfId(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">None</option>
              {pdfs.map((pdf) => (
                <option key={pdf.id} value={pdf.id}>{pdf.title}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Don't see your PDF? Upload one in <a href="/pdfs" className="text-primary-600 hover:underline">PDF Library</a> first.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Or write content directly</label>
            <textarea
              value={contentHtml}
              onChange={(e) => setContentHtml(e.target.value)}
              rows={3}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      )}

      {lessonType === 'quiz' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Quiz Category *</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          >
            <option value="">Select a quiz category</option>
            {quizCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Don't see the quiz you need? Build one in <a href="/quizzes" className="text-primary-600 hover:underline">Quiz Categories</a> first.
          </p>
        </div>
      )}

      {lessonType === 'live' && (
        <p className="text-xs text-gray-500">
          Live sessions can be scheduled and linked from the Live Sessions tab once created.
        </p>
      )}

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={isFreePreview} onChange={(e) => setIsFreePreview(e.target.checked)} className="h-4 w-4 text-primary-600 rounded" />
        <span className="text-sm text-gray-700">Free preview (visible even to non-enrolled students)</span>
      </label>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
          Cancel
        </button>
        <button type="submit" className="px-3 py-1.5 text-sm text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50" disabled={loading}>
          {loading ? 'Adding...' : 'Add Lesson'}
        </button>
      </div>
    </form>
  );
};

export const CourseBuilderPage: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [addingLessonToModule, setAddingLessonToModule] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; type: 'module' | 'lesson'; uuid: string; label: string; loading: boolean }>({
    isOpen: false,
    type: 'lesson',
    uuid: '',
    label: '',
    loading: false,
  });

  const loadCourse = useCallback(async () => {
    if (!uuid) return;
    setLoading(true);
    try {
      const response = await coursesService.getCourseByUuid(uuid);
      setCourse(response.data);
    } catch (error) {
      toast.error('Failed to load course');
    } finally {
      setLoading(false);
    }
  }, [uuid]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  const handlePublishToggle = async () => {
    if (!course) return;
    const nextStatus = course.status === 'published' ? 'draft' : 'published';
    try {
      await coursesService.setCourseStatus(course.uuid, nextStatus);
      toast.success(`Course ${nextStatus}`);
      loadCourse();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update course status');
    }
  };

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;
    if (!newModuleTitle.trim()) {
      toast.error('Module title is required');
      return;
    }
    try {
      await coursesService.createModule(course.uuid, newModuleTitle);
      setNewModuleTitle('');
      toast.success('Module added');
      loadCourse();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add module');
    }
  };

  const moveModule = async (modules: CourseModule[], index: number, direction: -1 | 1) => {
    if (!course) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= modules.length) return;

    const reordered = [...modules];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    try {
      await coursesService.reorderModules(course.uuid, reordered.map((m) => m.uuid));
      loadCourse();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reorder modules');
    }
  };

  const moveLesson = async (moduleUuid: string, lessons: Lesson[], index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= lessons.length) return;

    const reordered = [...lessons];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    try {
      await coursesService.reorderLessons(moduleUuid, reordered.map((l) => l.uuid));
      loadCourse();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reorder lessons');
    }
  };

  const handleConfirmDelete = async () => {
    setConfirmModal((prev) => ({ ...prev, loading: true }));
    try {
      if (confirmModal.type === 'module') {
        await coursesService.deleteModule(confirmModal.uuid);
      } else {
        await coursesService.deleteLesson(confirmModal.uuid);
      }
      toast.success('Deleted successfully');
      loadCourse();
      setConfirmModal({ isOpen: false, type: 'lesson', uuid: '', label: '', loading: false });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete');
      setConfirmModal((prev) => ({ ...prev, loading: false }));
    }
  };

  if (loading) {
    return <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>;
  }

  if (!course) {
    return <div className="p-12 text-center text-gray-600">Course not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/courses')} className="p-2 text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
            <p className="text-gray-600">{course.description}</p>
          </div>
        </div>
        <button onClick={handlePublishToggle} className={course.status === 'published' ? 'btn-secondary' : 'btn-primary'}>
          {course.status === 'published' ? 'Unpublish' : 'Publish'}
        </button>
      </div>

      <div className="card p-6">
        <form onSubmit={handleAddModule} className="flex gap-3 mb-6">
          <input
            type="text"
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            placeholder="New module title, e.g. 'Intro to bonds'"
            className="input-field flex-1 border"
          />
          <button type="submit" className="btn-primary inline-flex items-center">
            <Plus className="h-4 w-4 mr-2" />
            Add Module
          </button>
        </form>

        <div className="space-y-4">
          {(course.modules || []).map((module, moduleIndex) => (
            <div key={module.uuid} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">{moduleIndex + 1}. {module.title}</h3>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveModule(course.modules || [], moduleIndex, -1)} className="p-1 text-gray-400 hover:text-gray-600" disabled={moduleIndex === 0}>
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => moveModule(course.modules || [], moduleIndex, 1)} className="p-1 text-gray-400 hover:text-gray-600" disabled={moduleIndex === (course.modules?.length || 1) - 1}>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setConfirmModal({ isOpen: true, type: 'module', uuid: module.uuid, label: module.title, loading: false })}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 pl-4">
                {module.lessons.map((lesson, lessonIndex) => {
                  const Icon = LESSON_TYPE_ICON[lesson.lesson_type];
                  return (
                    <div key={lesson.uuid} className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
                      <div className="flex items-center gap-2 text-sm text-gray-800">
                        <Icon className="h-4 w-4 text-primary-600" />
                        {lesson.title}
                        {lesson.is_free_preview && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Free preview</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => moveLesson(module.uuid, module.lessons, lessonIndex, -1)} className="p-1 text-gray-400 hover:text-gray-600" disabled={lessonIndex === 0}>
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => moveLesson(module.uuid, module.lessons, lessonIndex, 1)} className="p-1 text-gray-400 hover:text-gray-600" disabled={lessonIndex === module.lessons.length - 1}>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmModal({ isOpen: true, type: 'lesson', uuid: lesson.uuid, label: lesson.title, loading: false })}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {addingLessonToModule === module.uuid ? (
                  <LessonForm
                    moduleUuid={module.uuid}
                    onCreated={() => { setAddingLessonToModule(null); loadCourse(); }}
                    onCancel={() => setAddingLessonToModule(null)}
                  />
                ) : (
                  <button
                    onClick={() => setAddingLessonToModule(module.uuid)}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center mt-2"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add lesson
                  </button>
                )}
              </div>
            </div>
          ))}

          {(!course.modules || course.modules.length === 0) && (
            <p className="text-sm text-gray-500 text-center py-6">No modules yet — add one above to get started.</p>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: 'lesson', uuid: '', label: '', loading: false })}
        onConfirm={handleConfirmDelete}
        title={`Delete ${confirmModal.type === 'module' ? 'Module' : 'Lesson'}`}
        message={`Are you sure you want to delete "${confirmModal.label}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        loading={confirmModal.loading}
      />
    </div>
  );
};
