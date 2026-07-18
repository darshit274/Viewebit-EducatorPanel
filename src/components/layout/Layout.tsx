import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { clsx } from 'clsx';

const pageTitle: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/courses': 'My Courses',
  '/assignments': 'Assignments & Quizzes',
  '/grading': 'Grading & Attendance',
  '/live-sessions': 'Live Sessions',
  '/announcements': 'Announcements & Q&A',
};

const resolveTitle = (pathname: string) => {
  if (pageTitle[pathname]) return pageTitle[pathname];
  if (pathname.startsWith('/courses/')) return 'Course Builder';
  return 'Educator Panel';
};

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const currentTitle = resolveTitle(location.pathname);

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar />
      </div>

      <div className={clsx('fixed inset-0 z-40 lg:hidden', sidebarOpen ? 'block' : 'hidden')}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
          <Sidebar />
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <Header title={currentTitle} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
