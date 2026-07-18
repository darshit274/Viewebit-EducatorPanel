import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { coursesService } from '../../services/courses';
import { Course, TestSeriesOption } from '../../types';

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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [testSeriesId, setTestSeriesId] = useState('');
  const [testSeriesOptions, setTestSeriesOptions] = useState<TestSeriesOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      coursesService.getAvailableTestSeries().then((res) => setTestSeriesOptions(res.data || [])).catch(() => setTestSeriesOptions([]));
      setTitle('');
      setDescription('');
      setTestSeriesId('');
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
      });
      toast.success('Course created successfully');
      onSuccess(response.data.uuid);
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
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Create Course</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
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
                  <p className="text-sm text-gray-600">{course.description}</p>
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
                <button className="btn-secondary text-sm">Manage</button>
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
    </div>
  );
};
