import React, { useEffect, useState } from 'react';
import { CreditCard, CheckCircle, XCircle, DollarSign, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { StatsCard } from '../../components/dashboard/StatsCard';
import { subscriptionsService } from '../../services/subscriptions';
import { coursesService } from '../../services/courses';
import { SubscriptionRow, Course } from '../../types';

const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-700',
};

const GrantAccessModal: React.FC<{ isOpen: boolean; onClose: () => void; onGranted: () => void }> = ({ isOpen, onClose, onGranted }) => {
  const [email, setEmail] = useState('');
  const [courseUuid, setCourseUuid] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      coursesService.getMyCourses().then((res) => setCourses((res.data || []).filter((c) => c.test_series_id))).catch(() => setCourses([]));
      setEmail('');
      setCourseUuid('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !courseUuid) {
      toast.error('Student email and course are required');
      return;
    }
    setLoading(true);
    try {
      await subscriptionsService.grantAccess(email.trim(), courseUuid);
      toast.success('Access granted');
      onGranted();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to grant access');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Grant Access</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Student Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field w-full" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Course *</label>
            <select value={courseUuid} onChange={(e) => setCourseUuid(e.target.value)} className="input-field w-full" required>
              <option value="">Select a course</option>
              {courses.map((c) => <option key={c.uuid} value={c.uuid}>{c.title}</option>)}
            </select>
            {courses.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">None of your courses are linked to a test series yet — access can only be granted for courses with a linked test series.</p>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={loading}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>{loading ? 'Granting...' : 'Grant Access'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const SubscriptionsPage: React.FC = () => {
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showGrantModal, setShowGrantModal] = useState(false);

  useEffect(() => {
    subscriptionsService.getStats().then((res) => setStats(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => { load(); }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, page]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await subscriptionsService.getSubscriptions({ search, status, page, limit: 20 });
      setRows(response.data || []);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (error) {
      toast.error('Failed to load subscriptions');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshAll = () => {
    load();
    subscriptionsService.getStats().then((res) => setStats(res.data)).catch(() => {});
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-gray-600">Who has paid access to your courses</p>
        </div>
        <button onClick={() => setShowGrantModal(true)} className="btn-primary inline-flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Grant Access
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard title="Active" value={stats.active} icon={CheckCircle} color="green" />
        <StatsCard title="Expired" value={stats.expired} icon={XCircle} color="red" />
        <StatsCard title="Total Revenue" value={`₹${stats.totalRevenue}`} icon={DollarSign} color="blue" />
      </div>

      <div className="card p-4 flex gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          placeholder="Search by student name or email"
          className="input-field flex-1"
        />
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="input-field w-48">
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No subscriptions yet</h3>
            <p className="text-gray-600">Once students purchase access to your courses, they'll show up here.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchased</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{r.student?.name || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{r.student?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{r.courseTitle || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{r.currency} {r.amountPaid}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(r.purchaseDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="px-3 py-2 text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      <GrantAccessModal isOpen={showGrantModal} onClose={() => setShowGrantModal(false)} onGranted={refreshAll} />
    </div>
  );
};
