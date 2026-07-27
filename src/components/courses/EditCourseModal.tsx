import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { coursesService } from '../../services/courses';
import { useAuth } from '../../hooks/useAuth';
import { Course } from '../../types';

interface EditCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  course: Course | null;
}

export const EditCourseModal: React.FC<EditCourseModalProps> = ({ isOpen, onClose, onSuccess, course }) => {
  const { educator } = useAuth();
  const pricingMode = educator?.institution?.pricing_mode || 'coaching_center';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  // A linked test series may be owned by an admin or another educator (e.g. a
  // coaching-center-created series shared onto this course); pricing on those
  // is out of this educator's control and submitting a price for them is a
  // guaranteed 400 on the backend.
  const canEditPrice = !course?.testSeries || course.testSeries.educator_id === educator?.id;

  useEffect(() => {
    if (isOpen && course) {
      setTitle(course.title);
      setDescription(course.description || '');
      setPrice(course.testSeries?.price !== undefined && course.testSeries?.price !== null ? String(course.testSeries.price) : '');
    }
  }, [isOpen, course]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setLoading(true);
    try {
      await coursesService.updateCourse(course.uuid, {
        title,
        description: description || undefined,
        ...(pricingMode === 'private_educator' && canEditPrice && price !== '' ? { price: parseFloat(price) } : {}),
      });
      toast.success('Course updated');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update course');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !course) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Edit Course</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Course Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
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
          {pricingMode === 'private_educator' && (
            canEditPrice ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price (₹)
                  <span className="text-xs text-gray-500 ml-1">(0 for a free course)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price (₹)</label>
                <p className="text-sm text-gray-500 px-3 py-2 bg-gray-50 rounded-md">
                  Price is set by another owner and can't be changed here.
                </p>
              </div>
            )
          )}
          <div className="border-t pt-4 flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
