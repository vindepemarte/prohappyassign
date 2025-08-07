import React from 'react';
import { ProjectStatus } from '../../types';
import { getStatusColors, getStatusDisplayName } from '../../utils/statusColors';

interface StatusBadgeProps {
  status: ProjectStatus;
  size?: 'sm' | 'md' | 'lg';
  showDescription?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  size = 'md', 
  showDescription = false 
}) => {
  const colors = getStatusColors(status);
  const displayName = getStatusDisplayName(status);
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  return (
    <div className="flex flex-col items-start">
      <span className={`
        ${colors.badge} 
        ${sizeClasses[size]} 
        font-semibold rounded-full whitespace-nowrap
      `}>
        {displayName}
      </span>
      {showDescription && (
        <p className={`text-xs mt-1 ${colors.text}`}>
          {colors.description}
        </p>
      )}
    </div>
  );
};

export default StatusBadge;