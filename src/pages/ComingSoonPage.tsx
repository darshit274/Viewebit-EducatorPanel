import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ComingSoonPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  phase: string;
}

export const ComingSoonPage: React.FC<ComingSoonPageProps> = ({ title, description, icon: Icon, phase }) => (
  <div className="card p-12 text-center">
    <Icon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
    <h2 className="text-lg font-medium text-gray-900 mb-2">{title}</h2>
    <p className="text-gray-600 max-w-md mx-auto">{description}</p>
    <p className="text-xs text-gray-400 mt-4">Shipping in {phase}</p>
  </div>
);
