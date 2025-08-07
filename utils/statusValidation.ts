import { ProjectStatus, UserRole } from '../types';

/**
 * Defines valid status transitions for projects
 */
const STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  // C -> A: Client submits project
  pending_payment_approval: ['rejected_payment', 'awaiting_worker_assignment'],
  
  // A -> C: Agent rejects payment
  rejected_payment: ['pending_payment_approval', 'awaiting_worker_assignment'],
  
  // A -> W: Agent approves payment and assigns worker
  awaiting_worker_assignment: ['in_progress', 'rejected_payment'],
  
  // W -> A: Worker works on project, can request adjustments or submit for approval
  in_progress: ['pending_final_approval', 'pending_quote_approval', 'needs_changes', 'refund', 'awaiting_worker_assignment'],
  
  // W -> C: Worker requests word count or deadline adjustment
  pending_quote_approval: ['in_progress', 'cancelled', 'awaiting_worker_assignment'],
  
  // C -> W: Client requests changes
  needs_changes: ['in_progress', 'refund', 'awaiting_worker_assignment'],
  
  // W -> A: Worker submits completed work
  pending_final_approval: ['completed', 'needs_changes', 'refund', 'in_progress'],
  
  // A -> All: Agent marks as completed
  completed: ['needs_changes', 'refund'], // Allow reopening if needed
  
  // A -> All: Agent processes refund
  refund: ['cancelled'],
  
  // Terminal state
  cancelled: []
};

/**
 * Defines which user roles can transition to which statuses
 */
const ROLE_STATUS_PERMISSIONS: Record<UserRole, ProjectStatus[]> = {
  // Client permissions: can approve/reject payments, request changes, accept/reject adjustments
  client: ['pending_payment_approval', 'rejected_payment', 'needs_changes', 'cancelled', 'in_progress'],
  
  // Worker permissions: can submit work, request adjustments
  worker: ['pending_final_approval', 'pending_quote_approval', 'in_progress'],
  
  // Agent permissions: can manage all statuses
  agent: [
    'pending_payment_approval',
    'awaiting_worker_assignment', 
    'in_progress',
    'needs_changes',
    'completed',
    'cancelled',
    'rejected_payment',
    'pending_quote_approval',
    'pending_final_approval',
    'refund'
  ],
};

/**
 * Validates if a status transition is allowed
 */
export const isValidStatusTransition = (
  currentStatus: ProjectStatus,
  newStatus: ProjectStatus
): boolean => {
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
  return allowedTransitions.includes(newStatus);
};

/**
 * Validates if a user role can set a specific status
 */
export const canUserSetStatus = (
  userRole: UserRole,
  status: ProjectStatus
): boolean => {
  const allowedStatuses = ROLE_STATUS_PERMISSIONS[userRole];
  return allowedStatuses.includes(status);
};

/**
 * Validates if a user can transition a project from one status to another
 */
export const canUserTransitionStatus = (
  userRole: UserRole,
  currentStatus: ProjectStatus,
  newStatus: ProjectStatus
): boolean => {
  return (
    isValidStatusTransition(currentStatus, newStatus) &&
    canUserSetStatus(userRole, newStatus)
  );
};

/**
 * Gets all valid next statuses for a given current status
 */
export const getValidNextStatuses = (currentStatus: ProjectStatus): ProjectStatus[] => {
  return STATUS_TRANSITIONS[currentStatus] || [];
};

/**
 * Gets all statuses that a user role can set
 */
export const getStatusesForRole = (userRole: UserRole): ProjectStatus[] => {
  return ROLE_STATUS_PERMISSIONS[userRole] || [];
};

/**
 * Checks if a status is terminal (no further transitions allowed)
 */
export const isTerminalStatus = (status: ProjectStatus): boolean => {
  return STATUS_TRANSITIONS[status].length === 0;
};

/**
 * Business rule: Check if a project can be cancelled
 */
export const canCancelProject = (
  currentStatus: ProjectStatus,
  userRole: UserRole
): boolean => {
  // Only workers can cancel projects
  if (userRole !== 'worker') {
    return false;
  }
  
  // Cannot cancel completed or already cancelled/refunded projects
  const nonCancellableStatuses: ProjectStatus[] = ['completed', 'cancelled', 'refund'];
  return !nonCancellableStatuses.includes(currentStatus);
};

/**
 * Business rule: Check if a deadline extension can be requested
 */
export const canRequestDeadlineExtension = (
  currentStatus: ProjectStatus,
  userRole: UserRole
): boolean => {
  // Only workers can request deadline extensions
  if (userRole !== 'worker') {
    return false;
  }
  
  // Can only request extensions for active projects
  const activeStatuses: ProjectStatus[] = ['in_progress', 'needs_changes', 'pending_final_approval'];
  return activeStatuses.includes(currentStatus);
};

/**
 * Business rule: Check if a refund can be processed
 */
export const canProcessRefund = (
  currentStatus: ProjectStatus,
  userRole: UserRole
): boolean => {
  // Only agents can process refunds
  if (userRole !== 'agent') {
    return false;
  }
  
  // Can only process refunds for projects in 'refund' status
  return currentStatus === 'refund';
};

/**
 * Get user-friendly status display name
 */
export const getStatusDisplayName = (status: ProjectStatus): string => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Get status description for users
 */
export const getStatusDescription = (status: ProjectStatus): string => {
  const descriptions: Record<ProjectStatus, string> = {
    pending_payment_approval: 'Waiting for client to approve payment',
    rejected_payment: 'Payment was rejected by client',
    awaiting_worker_assignment: 'Waiting for worker assignment',
    in_progress: 'Work is currently in progress',
    pending_quote_approval: 'Waiting for client to approve new quote',
    needs_changes: 'Client has requested changes',
    pending_final_approval: 'Waiting for final approval',
    completed: 'Project has been completed successfully',
    refund: 'Project cancelled, refund processing required',
    cancelled: 'Project has been cancelled and refunded',
  };
  
  return descriptions[status] || 'Unknown status';
};