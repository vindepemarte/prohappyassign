import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Users, FileText, Settings, BarChart3 } from 'lucide-react';

// Basic loading spinner
export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; text?: string }> = ({ 
  size = 'md', 
  text 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-600`} />
      {text && <p className="mt-2 text-sm text-gray-600">{text}</p>}
    </div>
  );
};

// Loading skeleton for dashboard cards
export const DashboardCardSkeleton: React.FC = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-3/4" />
    </CardHeader>
    <CardContent className="space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </CardContent>
  </Card>
);

// Loading skeleton for project list
export const ProjectListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, index) => (
      <Card key={index}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

// Loading skeleton for user list
export const UserListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-6 w-16" />
      </div>
    ))}
  </div>
);

// Loading skeleton for hierarchy tree
export const HierarchyTreeSkeleton: React.FC = () => (
  <div className="space-y-4">
    {/* Root level */}
    <div className="border rounded-lg p-4">
      <div className="flex items-center space-x-3">
        <Users className="h-5 w-5 text-purple-600" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-20" />
      </div>
      
      {/* Level 1 children */}
      <div className="ml-8 mt-3 space-y-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="flex items-center space-x-3">
            <Users className="h-4 w-4 text-blue-600" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
        
        {/* Level 2 children */}
        <div className="ml-6 space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center space-x-3">
              <Users className="h-3 w-3 text-green-600" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Loading skeleton for statistics
export const StatisticsSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: 4 }).map((_, index) => (
      <Card key={index}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>
            <BarChart3 className="h-8 w-8 text-gray-300" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

// Loading skeleton for forms
export const FormSkeleton: React.FC<{ fields?: number }> = ({ fields = 4 }) => (
  <div className="space-y-4">
    {Array.from({ length: fields }).map((_, index) => (
      <div key={index} className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
    ))}
    <Skeleton className="h-10 w-32" />
  </div>
);

// Loading skeleton for tables
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ 
  rows = 5, 
  columns = 4 
}) => (
  <div className="space-y-3">
    {/* Header */}
    <div className="flex gap-4 p-3 bg-gray-50 rounded-lg">
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton key={index} className="h-4 flex-1" />
      ))}
    </div>
    
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex gap-4 p-3 border rounded-lg">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={colIndex} className="h-4 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

// Comprehensive loading state for different operations
export const HierarchyOperationLoading: React.FC<{ operation: string }> = ({ operation }) => {
  const operationMessages = {
    'loading_hierarchy': 'Loading hierarchy information...',
    'validating_assignment': 'Validating assignment permissions...',
    'moving_user': 'Moving user in hierarchy...',
    'generating_codes': 'Generating reference codes...',
    'sending_notification': 'Sending notification...',
    'calculating_pricing': 'Calculating pricing...',
    'loading_projects': 'Loading projects...',
    'saving_configuration': 'Saving configuration...'
  };

  const message = operationMessages[operation] || 'Processing...';

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="relative">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-6 bg-blue-600 rounded-full animate-pulse"></div>
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-600 font-medium">{message}</p>
      <p className="mt-1 text-xs text-gray-500">This may take a few moments</p>
    </div>
  );
};

// Loading overlay for forms
export const FormLoadingOverlay: React.FC<{ message?: string }> = ({ 
  message = 'Saving changes...' 
}) => (
  <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
    <div className="flex flex-col items-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <p className="mt-2 text-sm text-gray-600">{message}</p>
    </div>
  </div>
);

// Loading state for data tables with search
export const DataTableLoading: React.FC<{ 
  title?: string; 
  hasSearch?: boolean; 
  hasFilters?: boolean 
}> = ({ 
  title = 'Loading data...', 
  hasSearch = false, 
  hasFilters = false 
}) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-8 w-24" />
    </div>
    
    {hasSearch && (
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-24" />
      </div>
    )}
    
    {hasFilters && (
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    )}
    
    <TableSkeleton rows={8} columns={5} />
  </div>
);

// Loading state for dashboard with multiple sections
export const DashboardLoading: React.FC<{ sections?: string[] }> = ({ 
  sections = ['Overview', 'Projects', 'Statistics'] 
}) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-8 w-32" />
    </div>
    
    {/* Statistics cards */}
    <StatisticsSkeleton />
    
    {/* Main content sections */}
    {sections.map((section, index) => (
      <Card key={index}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-400" />
            <Skeleton className="h-6 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export default ErrorBoundary;