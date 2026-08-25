import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Users, Eye, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { EditCourseModal } from '../../components/courses/EditCourseModal';
import { RichTextEditor } from '../../components/courses/RichTextEditor';
import { CourseCategoryPicker } from '../../components/courses/CourseCategoryPicker';
import { CourseImageUpload } from '../../components/courses/CourseImageUpload';
import { coursesService } from '../../services/courses';
import { useAuth } from '../../hooks/useAuth';
import { Course, TestSeriesOption } from '../../types';
import { stripHtml } from '../../utils/stripHtml';

const STATUS_BADGE: Record<Course['status'], string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-green-100 text-green-800',
  archived: 'bg-red-100 text-red-800',
};

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (uuid: string) => void;
}

const CreateCourseModal: React.FC<CreateCourseModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { educator } = useAuth();
  const pricingMode = educator?.institution?.pricing_mode || 'coaching_center';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [testSeriesId, setTestSeriesId] = useState('');
  const [price, setPrice] = useState('');
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [testSeriesOptions, setTestSeriesOptions] = useState<TestSeriesOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      coursesService.getAvailableTestSeries().then((res) => setTestSeriesOptions(res.data || [])).catch(() => setTestSeriesOptions([]));
      setTitle('');
      setDescription('');
      setTestSeriesId('');
      setPrice('');
      setCategoryIds([]);
      setThumbnailPreview(null);
      setThumbnailFile(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setLoading(true);
    try {
      const response = await coursesService.createCourse({
        title,
        description: description || undefined,
        test_series_id: testSeriesId ? parseInt(testSeriesId) : null,
        category_ids: categoryIds,
        ...(pricingMode === 'private_educator' && price ? { price: parseFloat(price) } : {}),
      });
      const uuid = response.data.uuid;
      if (thumbnailFile) {
        try {
          await coursesService.uploadThumbnail(uuid, thumbnailFile);
        } catch {
          toast.error('Course created, but the featured image failed to upload — you can retry from Edit');
        }
      }
      toast.success('Course created successfully');
      onSuccess(uuid);
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create course');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Create Course</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Course Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Organic Chemistry — Batch 2026"
              required
            />
          </div>

          <CourseImageUpload value={thumbnailPreview} onChange={setThumbnailPreview} onFileSelected={setThumbnailFile} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <RichTextEditor value={description} onChange={setDescription} placeholder="Describe what students will learn in this course..." />
          </div>

          <CourseCategoryPicker selectedIds={categoryIds} onChange={setCategoryIds} />

          {pricingMode === 'private_educator' && (
            <div>
              <label className="block text-base font-semibold text-gray-900 mb-2">
                Price
                <span className="text-xs font-normal text-gray-500 ml-1">(optional — leave blank or 0 for a free course)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 text-lg font-medium border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0"
                />
              </div>
            </div>
          )}
          {pricingMode !== 'private_educator' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Link to Test Series
                <span className="text-xs text-gray-500 ml-1">(optional — enables quizzes and gates access via existing purchases)</span>
              </label>
              <select
                value={testSeriesId}
                onChange={(e) => setTestSeriesId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">None — video/document only course</option>
                {testSeriesOptions.map((ts) => (
                  <option key={ts.id} value={ts.id}>{ts.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="border-t pt-4 flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50" disabled={loading}>
              {loading ? 'Creating...' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const MyCoursesPage: React.FC = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; course: Course | null; loading: boolean }>({
    isOpen: false, course: null, loading: false,
  });

  const handleConfirmDelete = async () => {
    if (!confirmModal.course) return;
    setConfirmModal((prev) => ({ ...prev, loading: true }));
    try {
      await coursesService.deleteCourse(confirmModal.course.uuid);
      toast.success('Course deleted successfully');
      loadCourses();
      setConfirmModal({ isOpen: false, course: null, loading: false });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete course');
      setConfirmModal((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const response = await coursesService.getMyCourses();
      setCourses(response.data || []);
    } catch (error) {
      toast.error('Failed to load courses');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Courses</h1>
          <p className="text-gray-600">Create and manage your courses</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary inline-flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          New Course
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>
        ) : courses.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="h-24 w-24 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No courses yet</h3>
            <p className="text-gray-600 mb-6">Create your first course to start building modules and lessons.</p>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              New Course
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {courses.map((course) => (
              <div
                key={course.uuid}
                className="p-6 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/courses/${course.uuid}/builder`)}
              >
                <div>
                  <h4 className="text-lg font-medium text-gray-900">{course.title}</h4>
                  <p className="text-sm text-gray-600 truncate max-w-xl">{stripHtml(course.description)}</p>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[course.status]}`}>
                      {course.status}
                    </span>
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {course.studentCount ?? 0} students
                    </span>
                    {course.testSeries && (
                      <span className="text-sm text-gray-500">Linked: {course.testSeries.name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/courses/${course.uuid}/builder`); }}
                    className="p-2 text-gray-400 hover:text-primary-600"
                    title="View"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setEditCourse(course); }} className="p-2 text-gray-400 hover:text-primary-600" title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, course, loading: false }); }}
                    className="p-2 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateCourseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={(uuid) => navigate(`/courses/${uuid}/builder`)}
      />
      <EditCourseModal isOpen={!!editCourse} onClose={() => setEditCourse(null)} onSuccess={loadCourses} course={editCourse} />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, course: null, loading: false })}
        onConfirm={handleConfirmDelete}
        title="Delete Course"
        message={`Are you sure you want to delete "${confirmModal.course?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        loading={confirmModal.loading}
      />
    </div>
  );
};
