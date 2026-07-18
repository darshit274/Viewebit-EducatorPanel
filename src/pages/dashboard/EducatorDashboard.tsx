import React, { useEffect, useState } from 'react';
import { BookOpen, Users, ClipboardCheck, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { StatsCard } from '../../components/dashboard/StatsCard';
import { dashboardService, EducatorDashboardStats } from '../../services/dashboard';
import { useAuth } from '../../hooks/useAuth';

export const EducatorDashboard: React.FC = () => {
  const { educator } = useAuth();
  const [stats, setStats] = useState<EducatorDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await dashboardService.getStats();
        setStats(response.data);
      } catch (error) {
        toast.error('Failed to load dashboard stats');
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {educator?.name}</h1>
        <p className="text-gray-600">Here's what's happening with your courses today</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard title="My Courses" value={loading ? '—' : stats?.totalCourses ?? 0} icon={BookOpen} color="blue" />
        <StatsCard title="Students" value={loading ? '—' : stats?.totalStudents ?? 0} icon={Users} color="green" />
        <StatsCard title="Pending Grading" value={loading ? '—' : stats?.pendingGrading ?? 0} icon={ClipboardCheck} color="yellow" />
        <StatsCard title="Upcoming Live Sessions" value={loading ? '—' : stats?.upcomingLiveSessions ?? 0} icon={Video} color="purple" />
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Getting started</h3>
        <p className="text-gray-600 text-sm">
          Head to <span className="font-medium text-primary-600">My Courses</span> to create your first course,
          then use the Course Builder to add modules and lessons — link existing tests and PDFs, or add your own
          video lectures.
        </p>
      </div>
    </div>
  );
};
