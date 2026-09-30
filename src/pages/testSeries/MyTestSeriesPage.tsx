import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Pencil, ListChecks, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { testSeriesService, MyTestSeries } from '../../services/testSeries';

interface SeriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  series: MyTestSeries | null;
}

const SeriesModal: React.FC<SeriesModalProps> = ({ isOpen, onClose, onSuccess, series }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [loading, setLoading] = useState(false);
  const isEdit = !!series;

  useEffect(() => {
    if (isOpen) {
      setTitle(series?.name || '');
      setDescription(series?.description || '');
      setPrice(series ? String(series.price) : '0');
    }
  }, [isOpen, series]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      toast.error('Enter a valid, non-negative price');
      return;
    }
    setLoading(true);
    try {
      if (isEdit && series) {
        await testSeriesService.update(series.uuid, { title, description: description || undefined, price: numericPrice });
        toast.success('Test series updated');
      } else {
        await testSeriesService.create({ title, description: description || undefined, price: numericPrice });
        toast.success('Test series created');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save test series');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">{isEdit ? 'Edit Test Series' : 'New Test Series'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. General Aptitude Mock Series"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Price (₹)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">0 makes it free. Students see this series on the Test Series page once it has content.</p>
          </div>
          <div className="border-t pt-4 flex space-x-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const MyTestSeriesPage: React.FC = () => {
  const [series, setSeries] = useState<MyTestSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSeries, setEditSeries] = useState<MyTestSeries | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; uuid: string; label: string; loading: boolean }>({
    isOpen: false, uuid: '', label: '', loading: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await testSeriesService.listMine();
      setSeries(data);
    } catch (error) {
      toast.error('Failed to load your test series');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirmDelete = async () => {
    setConfirmDelete((prev) => ({ ...prev, loading: true }));
    try {
      await testSeriesService.remove(confirmDelete.uuid);
      toast.success('Test series deleted');
      setConfirmDelete({ isOpen: false, uuid: '', label: '', loading: false });
      load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete test series');
      setConfirmDelete((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Test Series</h1>
          <p className="text-gray-600">Standalone test series you sell directly to students — separate from your courses</p>
        </div>
        <button onClick={() => { setEditSeries(null); setShowModal(true); }} className="btn-primary inline-flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          New Test Series
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>
        ) : series.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="h-24 w-24 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No test series yet</h3>
            <p className="text-gray-500 mb-4">Create one, then add categories and questions — it'll show up on the student Test Series page.</p>
            <button onClick={() => { setEditSeries(null); setShowModal(true); }} className="btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              New Test Series
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {series.map((s) => (
              <div key={s.uuid} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{s.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.pricing_type === 'paid' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {s.pricing_type === 'paid' ? `₹${s.price}` : 'Free'}
                    </span>
                    {!s.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>}
                  </div>
                  {s.description && <p className="text-sm text-gray-500 mt-1">{s.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">{s.categoriesCount} categor{s.categoriesCount === 1 ? 'y' : 'ies'}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Link to={`/test-series/${s.uuid}/content`} className="p-2 text-gray-400 hover:text-primary-600" title="Manage content">
                    <ListChecks className="h-4 w-4" />
                  </Link>
                  <button onClick={() => { setEditSeries(s); setShowModal(true); }} className="p-2 text-gray-400 hover:text-primary-600" title="Edit details">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete({ isOpen: true, uuid: s.uuid, label: s.name, loading: false })}
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

      <SeriesModal isOpen={showModal} onClose={() => setShowModal(false)} onSuccess={load} series={editSeries} />
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, uuid: '', label: '', loading: false })}
        onConfirm={handleConfirmDelete}
        title="Delete test series?"
        message={`This permanently deletes "${confirmDelete.label}" and all its categories and questions. This can't be undone.`}
        loading={confirmDelete.loading}
      />
    </div>
  );
};

export default MyTestSeriesPage;
