import { ProjectStatus } from '../types';

export interface StatusColorConfig {
  border: string;
  background: string;
  text: string;
  badge: string;
  description: string;
}

/**
 * Comprehensive status color configuration
 * Provides consistent colors across the entire application
 */
export const STATUS_COLORS: Record<ProjectStatus, StatusColorConfig> = {
  pending_payment_approval: {
    border: 'border-orange-400',
    background: 'bg-orange-50',
    text: 'text-orange-800',
    badge: 'bg-orange-100 text-orange-800',
    description: 'Waiting for client payment confirmation'
  },
  rejected_payment: {
    border: 'border-red-400',
    background: 'bg-red-50',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-800',
    description: 'Payment was rejected and needs review'
  },
  awaiting_worker_assignment: {
    border: 'border-cyan-400',
    background: 'bg-cyan-50',
    text: 'text-cyan-800',
    badge: 'bg-cyan-100 text-cyan-800',
    description: 'Ready to be assigned to a worker'
  },
  in_progress: {
    border: 'border-blue-400',
    background: 'bg-blue-50',
    text: 'text-blue-800',
    badge: 'bg-blue-100 text-blue-800',
    description: 'Currently being worked on by assigned worker'
  },
  pending_quote_approval: {
    border: 'border-purple-400',
    background: 'bg-purple-50',
    text: 'text-purple-800',
    badge: 'bg-purple-100 text-purple-800',
    description: 'Waiting for client to approve quote changes'
  },
  needs_changes: {
    border: 'border-yellow-400',
    background: 'bg-yellow-50',
    text: 'text-yellow-800',
    badge: 'bg-yellow-100 text-yellow-800',
    description: 'Client has requested modifications'
  },
  pending_final_approval: {
    border: 'border-indigo-400',
    background: 'bg-indigo-50',
    text: 'text-indigo-800',
    badge: 'bg-indigo-100 text-indigo-800',
    description: 'Waiting for final client approval'
  },
  completed: {
    border: 'border-green-400',
    background: 'bg-green-50',
    text: 'text-green-800',
    badge: 'bg-green-100 text-green-800',
    description: 'Project has been successfully completed'
  },
  refund: {
    border: 'border-red-500',
    background: 'bg-red-100',
    text: 'text-red-900',
    badge: 'bg-red-200 text-red-900',
    description: 'Project cancelled and requires refund processing'
  },
  cancelled: {
    border: 'border-gray-400',
    background: 'bg-gray-50',
    text: 'text-gray-800',
    badge: 'bg-gray-100 text-gray-800',
    description: 'Project has been cancelled'
  }
};

/**
 * Get status color configuration
 */
export const getStatusColors = (status: ProjectStatus): StatusColorConfig => {
  return STATUS_COLORS[status] || STATUS_COLORS.pending_payment_approval;
};

/**
 * Get status display name
 */
export const getStatusDisplayName = (status: ProjectStatus): string => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Get status priority for sorting (lower number = higher priority)
 */
export const getStatusPriority = (status: ProjectStatus): number => {
  const priorities: Record<ProjectStatus, number> = {
    pending_quote_approval: 1,
    needs_changes: 2,
    pending_final_approval: 3,
    in_progress: 4,
    awaiting_worker_assignment: 5,
    pending_payment_approval: 6,
    rejected_payment: 7,
    refund: 8,
    completed: 9,
    cancelled: 10
  };
  return priorities[status] || 999;
};

/**
 * Check if status requires urgent attention
 */
export const isUrgentStatus = (status: ProjectStatus): boolean => {
  return ['pending_quote_approval', 'needs_changes', 'refund'].includes(status);
};

/**
 * Check if status is in active workflow
 */
export const isActiveStatus = (status: ProjectStatus): boolean => {
  return !['completed', 'cancelled', 'refund'].includes(status);
};