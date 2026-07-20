import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { studentsService } from '../../services/students';
import { StudentRow, AccessType } from '../../types';

const ACCESS_BADGE: Record<AccessType, string> = {
  paid: 'bg-green-100 text-green-800',
  free: 'bg-blue-100 text-blue-800',
  quiz: 'bg-purple-100 text-purple-800',
};
const ACCESS_LABEL: Record<AccessType, string> = {
  paid: 'Paid',
  free: 'Free',
  quiz: 'Quiz only',
};

export const StudentsPage: React.FC = () => {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [accessType, setAccessType] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const handle = setTimeout(() => {
      load();
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, accessType, page]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await studentsService.getStudents({ search, access_type: accessType, page, limit: 20 });
      setStudents(response.data || []);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (error) {
      toast.error('Failed to load students');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Students</h1>
        <p className="text-gray-600">Everyone engaging with your courses and quizzes</p>
      </div>

      <div className="card p-4 flex gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          placeholder="Search by name or email"
          className="input-field flex-1"
        />
        <select
          value={accessType}
          onChange={(e) => { setPage(1); setAccessType(e.target.value); }}
          className="input-field w-48"
        >
          <option value="all">All access types</option>
          <option value="paid">Paid</option>
          <option value="free">Free</option>
          <option value="quiz">Quiz only</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No students yet</h3>
            <p className="text-gray-600">Once students engage with your courses or quizzes, they'll show up here.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Courses</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Access</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quiz Attempts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {students.map((s) => (
                <tr key={s.uuid}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{s.name || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{s.email}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{s.courses.length > 0 ? s.courses.join(', ') : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ACCESS_BADGE[s.accessType]}`}>
                      {ACCESS_LABEL[s.accessType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {s.lastActivity ? new Date(s.lastActivity).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{s.quizAttempts}</td>
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
    </div>
  );
};
