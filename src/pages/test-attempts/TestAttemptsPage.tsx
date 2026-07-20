import React, { useEffect, useState } from 'react';
import { Activity, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { testAttemptsService } from '../../services/testAttempts';
import { TestAttemptSummary, TestAttemptDetail } from '../../types';

interface DrillDownState {
  isOpen: boolean;
  loading: boolean;
  student: { uuid: string; name: string | null; email: string | null } | null;
  attempts: TestAttemptDetail[];
}

export const TestAttemptsPage: React.FC = () => {
  const [rows, setRows] = useState<TestAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [drillDown, setDrillDown] = useState<DrillDownState>({ isOpen: false, loading: false, student: null, attempts: [] });

  useEffect(() => {
    const handle = setTimeout(() => { load(); }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await testAttemptsService.getTestAttempts({ search, page, limit: 20 });
      setRows(response.data || []);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (error) {
      toast.error('Failed to load test attempts');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const openDrillDown = async (studentUuid: string) => {
    setDrillDown({ isOpen: true, loading: true, student: null, attempts: [] });
    try {
      const response = await testAttemptsService.getStudentTestAttempts(studentUuid);
      setDrillDown({ isOpen: true, loading: false, student: response.data.student, attempts: response.data.attempts });
    } catch (error) {
      toast.error('Failed to load attempt history');
      setDrillDown({ isOpen: false, loading: false, student: null, attempts: [] });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Test Attempts</h1>
        <p className="text-gray-600">Quiz activity across your own quiz categories</p>
      </div>

      <div className="card p-4">
        <input
          type="text"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          placeholder="Search by name or email"
          className="input-field w-full"
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No attempts yet</h3>
            <p className="text-gray-600">Once students attempt your quizzes, their activity will show up here.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Attempts</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Latest Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Latest Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Latest Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((r) => (
                <tr key={r.studentUuid} className="cursor-pointer hover:bg-gray-50" onClick={() => openDrillDown(r.studentUuid)}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{r.studentName || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{r.studentEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{r.totalAttempts}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{r.latestAttempt.categoryName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{r.latestAttempt.percentage != null ? `${r.latestAttempt.percentage}%` : '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {r.latestAttempt.completedAt ? new Date(r.latestAttempt.completedAt).toLocaleDateString() : '—'}
                  </td>
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

      {drillDown.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{drillDown.student?.name || 'Attempt History'}</h2>
                <p className="text-sm text-gray-500">{drillDown.student?.email}</p>
              </div>
              <button onClick={() => setDrillDown({ isOpen: false, loading: false, student: null, attempts: [] })} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              {drillDown.loading ? (
                <CardSkeleton />
              ) : drillDown.attempts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No attempts found.</p>
              ) : (
                <div className="space-y-3">
                  {drillDown.attempts.map((a) => (
                    <div key={a.sessionId} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">{a.categoryName || 'Quiz'}</span>
                        <span className="text-sm text-gray-500">{a.completedAt ? new Date(a.completedAt).toLocaleString() : '—'}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Score: {a.finalScore ?? '—'} · {a.percentage != null ? `${a.percentage}%` : '—'} · Correct {a.totalCorrect}/{a.totalQuestions}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
