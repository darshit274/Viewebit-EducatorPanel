import React, { useState, useEffect } from 'react';
import { CheckSquare, FileText, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../../components/common/LoadingSpinner';
import { assignmentsService, Assignment, AssignmentSubmission } from '../../services/assignments';

interface GradeFormProps {
  submission: AssignmentSubmission;
  onGraded: () => void;
}

const GradeForm: React.FC<GradeFormProps> = ({ submission, onGraded }) => {
  const [grade, setGrade] = useState(submission.grade != null ? String(submission.grade) : '');
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (grade === '' || isNaN(Number(grade))) {
      toast.error('Enter a valid grade');
      return;
    }
    setSaving(true);
    try {
      await assignmentsService.gradeSubmission(submission.uuid, Number(grade), feedback || undefined);
      toast.success('Submission graded');
      onGraded();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to grade submission');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={grade}
        onChange={(e) => setGrade(e.target.value)}
        placeholder="Grade"
        className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      <input
        type="text"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Feedback (optional)"
        className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      <button onClick={handleSave} disabled={saving} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
        {saving ? 'Saving...' : submission.status === 'graded' ? 'Update' : 'Grade'}
      </button>
    </div>
  );
};

export const GradingPage: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [quizResults, setQuizResults] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

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
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissions = async (assignment: Assignment) => {
    setSelected(assignment);
    setLoadingSubmissions(true);
    try {
      const response = await assignmentsService.getSubmissions(assignment.uuid);
      setSubmissions(response.data || []);
      setQuizResults(response.quizResults);
    } catch (error) {
      toast.error('Failed to load submissions');
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <CardSkeleton key={i} />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Grading & Attendance</h1>
        <p className="text-gray-600">Review submissions and quiz results across your assignments</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900">Assignments</h3>
          </div>
          {assignments.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">No assignments yet</div>
          ) : (
            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {assignments.map((assignment) => (
                <button
                  key={assignment.uuid}
                  onClick={() => loadSubmissions(assignment)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${selected?.uuid === assignment.uuid ? 'bg-primary-50' : ''}`}
                >
                  <p className="text-sm font-medium text-gray-900">{assignment.title}</p>
                  <p className="text-xs text-gray-500">{assignment.course?.title}</p>
                  {!!assignment.pendingCount && (
                    <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      {assignment.pendingCount} pending
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 card p-6">
          {!selected ? (
            <div className="text-center py-12 text-gray-500">
              <CheckSquare className="h-16 w-16 text-gray-300 mx-auto mb-3" />
              Select an assignment to review submissions
            </div>
          ) : loadingSubmissions ? (
            <CardSkeleton />
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No submissions yet for "{selected.title}"</div>
          ) : quizResults ? (
            <div className="overflow-x-auto">
              <h3 className="font-medium text-gray-900 mb-4">Quiz Results — {selected.title}</h3>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Percentage</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {submissions.map((s) => (
                    <tr key={s.studentUuid}>
                      <td className="px-4 py-2 text-sm text-gray-900">{s.studentName || s.studentEmail}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{s.score}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{s.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Submissions — {selected.title}</h3>
              {submissions.map((submission) => (
                <div key={submission.uuid} className="border border-gray-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{submission.student?.username || submission.student?.email}</p>
                      <p className="text-xs text-gray-500">
                        Submitted {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : ''}
                        {submission.status === 'late' && <span className="text-red-600 ml-2">(late)</span>}
                      </p>
                    </div>
                    {submission.status === 'graded' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Graded: {submission.grade}
                      </span>
                    )}
                  </div>

                  {submission.submission_text && (
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-md p-2">{submission.submission_text}</p>
                  )}
                  {submission.file_url && (
                    <a href={submission.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
                      <FileText className="h-4 w-4" />
                      View submitted file
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}

                  <GradeForm submission={submission} onGraded={() => loadSubmissions(selected)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
