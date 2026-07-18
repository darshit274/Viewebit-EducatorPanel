import React, { useState, useEffect } from 'react';
import { Plus, ClipboardList, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { assignmentsService, Assignment, SubmissionType } from '../../services/assignments';
import { coursesService } from '../../services/courses';
import { Course, QuizCategoryOption } from '../../types';

interface CreateAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateAssignmentModal: React.FC<CreateAssignmentModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [quizCategories, setQuizCategories] = useState<QuizCategoryOption[]>([]);
  const [courseUuid, setCourseUuid] = useState('');
  const [title, setTitle] = useState('');
  const [submissionType, setSubmissionType] = useState<SubmissionType>('text');
  const [categoryId, setCategoryId] = useState('');
  const [maxPoints, setMaxPoints] = useState('100');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      coursesService.getMyCourses().then((res) => setCourses(res.data || [])).catch(() => setCourses([]));
      coursesService.getAvailableQuizCategories().then((res) => setQuizCategories(res.data || [])).catch(() => setQuizCategories([]));
      setCourseUuid('');
      setTitle('');
      setSubmissionType('text');
      setCategoryId('');
      setMaxPoints('100');
      setDueDate('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseUuid || !title.trim()) {
      toast.error('Course and title are required');
      return;
    }
    if (submissionType === 'quiz' && !categoryId) {
      toast.error('Select a quiz category for this quiz assignment');
      return;
    }
    setLoading(true);
    try {
      await assignmentsService.createAssignment(courseUuid, {
        title,
        submission_type: submissionType,
        category_id: submissionType === 'quiz' ? parseInt(categoryId) : undefined,
        max_points: parseInt(maxPoints) || 100,
        due_date: dueDate || undefined,
      });
      toast.success('Assignment created successfully');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create assignment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">New Assignment</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Course *</label>
            <select value={courseUuid} onChange={(e) => setCourseUuid(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" required>
              <option value="">Select a course</option>
              {courses.map((c) => <option key={c.uuid} value={c.uuid}>{c.title}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Reactions HW"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Submission Type *</label>
              <select value={submissionType} onChange={(e) => setSubmissionType(e.target.value as SubmissionType)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="text">Text answer</option>
                <option value="file_upload">File upload</option>
                <option value="quiz">Quiz (Quiz Category)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Points</label>
              <input
                type="number"
                value={maxPoints}
                onChange={(e) => setMaxPoints(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {submissionType === 'quiz' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quiz Category *</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" required>
                <option value="">Select a quiz category</option>
                {quizCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="border-t pt-4 flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50" disabled={loading}>
              {loading ? 'Creating...' : 'Create Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const AssignmentsPage: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, assignment: null as Assignment | null, loading: false });

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const response = await assignmentsService.getAllMyAssignments();
      setAssignments(response.data || []);
    } catch (error) {
      toast.error('Failed to load assignments');
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmModal.assignment) return;
    setConfirmModal((prev) => ({ ...prev, loading: true }));
    try {
      await assignmentsService.deleteAssignment(confirmModal.assignment.uuid);
      toast.success('Assignment deleted successfully');
      loadAssignments();
      setConfirmModal({ isOpen: false, assignment: null, loading: false });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete assignment');
      setConfirmModal((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assignments & Quizzes</h1>
          <p className="text-gray-600">Create assignments and quizzes for your courses</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary inline-flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          New Assignment
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>
        ) : assignments.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="h-24 w-24 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments yet</h3>
            <p className="text-gray-600 mb-6">Create your first assignment or quiz for a course.</p>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              New Assignment
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {assignments.map((assignment) => (
              <div key={assignment.uuid} className="p-6 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <h4 className="text-md font-medium text-gray-900">{assignment.title}</h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-gray-500">{assignment.course?.title}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                      {assignment.submission_type.replace('_', ' ')}
                    </span>
                    {assignment.due_date && (
                      <span className="text-xs text-gray-400">Due {new Date(assignment.due_date).toLocaleDateString()}</span>
                    )}
                    {!!assignment.pendingCount && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {assignment.pendingCount} pending
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setConfirmModal({ isOpen: true, assignment, loading: false })}
                  className="p-2 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateAssignmentModal isOpen={showModal} onClose={() => setShowModal(false)} onSuccess={loadAssignments} />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, assignment: null, loading: false })}
        onConfirm={handleConfirmDelete}
        title="Delete Assignment"
        message={`Are you sure you want to delete "${confirmModal.assignment?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        loading={confirmModal.loading}
      />
    </div>
  );
};
