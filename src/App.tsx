import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { MessageSquare } from 'lucide-react';
import { AuthProvider, useAuth, ProtectedRoute } from './hooks/useAuth';
import { LoginForm } from './components/auth/LoginForm';
import { Layout } from './components/layout/Layout';
import { EducatorDashboard } from './pages/dashboard/EducatorDashboard';
import { MyCoursesPage } from './pages/courses/MyCoursesPage';
import { CourseBuilderPage } from './pages/courses/CourseBuilderPage';
import { AssignmentsPage } from './pages/assignments/AssignmentsPage';
import { GradingPage } from './pages/grading/GradingPage';
import { LiveSessionsPage } from './pages/live/LiveSessionsPage';
import { QuizCategoriesPage } from './pages/quizzes/QuizCategoriesPage';
import { PdfLibraryPage } from './pages/pdfs/PdfLibraryPage';
import { ComingSoonPage } from './pages/ComingSoonPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AuthWrapper: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onSuccess={() => navigate('/dashboard')} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route path="" element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<ProtectedRoute><EducatorDashboard /></ProtectedRoute>} />
        <Route path="courses" element={<ProtectedRoute><MyCoursesPage /></ProtectedRoute>} />
        <Route path="courses/:uuid/builder" element={<ProtectedRoute><CourseBuilderPage /></ProtectedRoute>} />
        <Route path="assignments" element={<ProtectedRoute><AssignmentsPage /></ProtectedRoute>} />
        <Route path="grading" element={<ProtectedRoute><GradingPage /></ProtectedRoute>} />
        <Route path="live-sessions" element={<ProtectedRoute><LiveSessionsPage /></ProtectedRoute>} />
        <Route path="quizzes" element={<ProtectedRoute><QuizCategoriesPage /></ProtectedRoute>} />
        <Route path="pdfs" element={<ProtectedRoute><PdfLibraryPage /></ProtectedRoute>} />
        <Route
          path="announcements"
          element={
            <ProtectedRoute>
              <ComingSoonPage
                title="Announcements & Q&A"
                description="Post course announcements and answer student questions."
                icon={MessageSquare}
                phase="a future phase"
              />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router basename={import.meta.env.VITE_BASE_PATH || '/'}>
          <div className="App">
            <AuthWrapper />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#ffffff',
                  color: '#374151',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                },
                success: { iconTheme: { primary: '#10b981', secondary: '#ffffff' } },
                error: { iconTheme: { primary: '#ef4444', secondary: '#ffffff' } },
              }}
            />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
