import React from 'react';
import { Project } from '../../types';
import { getStatusColors, isUrgentStatus } from '../../utils/statusColors';
import StatusBadge from './StatusBadge';

interface ProjectCardProps {
  project: Project;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ 
  project, 
  children, 
  onClick, 
  className = '' 
}) => {
  const colors = getStatusColors(project.status);
  const isUrgent = isUrgentStatus(project.status);
  
  return (
    <div 
      className={`
        border-2 rounded-xl bg-slate-50 shadow-md transition-all duration-200 flex flex-col
        ${colors.border}
        ${isUrgent ? 'shadow-lg ring-2 ring-opacity-20 ' + colors.border.replace('border-', 'ring-') : ''}
        ${onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {/* Status Indicator Bar */}
      <div className={`h-1 rounded-t-xl ${colors.badge.split(' ')[0]}`}></div>
      
      {/* Card Header */}
      <div className={`p-4 ${colors.background} rounded-t-xl border-b ${colors.border}`}>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className={`font-bold text-lg ${colors.text} break-words`}>
              {project.title}
            </h3>
            {project.order_reference && (
              <p className="text-xs text-gray-600 mt-1">
                Order: <span className="font-mono font-semibold text-blue-600">
                  {project.order_reference}
                </span>
              </p>
            )}
          </div>
          <div className="ml-4 flex-shrink-0">
            <StatusBadge status={project.status} size="sm" />
          </div>
        </div>
        
        {/* Urgent Status Alert */}
        {isUrgent && (
          <div className={`mt-3 p-2 rounded-lg ${colors.background} border ${colors.border}`}>
            <div className="flex items-center space-x-2">
              <svg className={`w-4 h-4 ${colors.text}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className={`text-xs font-medium ${colors.text}`}>
                Requires Attention
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* Card Content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
};

export default ProjectCard;