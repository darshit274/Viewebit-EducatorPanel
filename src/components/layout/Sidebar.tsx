import { clsx } from 'clsx';
import {
  BookOpen,
  CheckSquare,
  ClipboardList,
  Home,
  LogOut,
  MessageSquare,
  Video,
  HelpCircle,
  FileText,
} from 'lucide-react';
import React from 'react';
import { NavLink } from 'react-router-dom';
import logo from '../../assets/Viewebit.jpg';
import { useAuth } from '../../hooks/useAuth';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'My Courses', href: '/courses', icon: BookOpen },
  { name: 'Quiz Categories', href: '/quizzes', icon: HelpCircle },
  { name: 'PDF Library', href: '/pdfs', icon: FileText },
  { name: 'Assignments & Quizzes', href: '/assignments', icon: ClipboardList },
  { name: 'Grading & Attendance', href: '/grading', icon: CheckSquare },
  { name: 'Live Sessions', href: '/live-sessions', icon: Video },
  { name: 'Announcements & Q&A', href: '/announcements', icon: MessageSquare },
];

export const Sidebar: React.FC = () => {
  const { educator, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex flex-col w-64 bg-white shadow-lg border-r border-gray-200 h-full">
      <div className="flex items-center px-6 py-4 border-b border-gray-200">
        <div className="flex items-center w-10 h-10">
          <img src={logo} alt="Viewebit Logo" style={{ borderRadius: '50%' }} />
          <div className="ml-3">
            <h1 className="text-lg font-semibold text-gray-900">Viewebit</h1>
            <p className="text-xs text-gray-500">Educator Panel</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {educator?.avatar ? (
              <img className="h-10 w-10 rounded-full" src={educator.avatar} alt={educator.name} />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-sm font-medium text-primary-600">
                  {educator?.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">{educator?.name}</p>
            <p className="text-xs text-gray-500">{educator?.designation || 'Faculty'}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              clsx(
                'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={clsx('mr-3 h-5 w-5 flex-shrink-0', isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500')} />
                <span className="flex-1">{item.name}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="group flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5 flex-shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );
};
