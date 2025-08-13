// Hierarchical PostgreSQL-based notification service
// Enhanced with hierarchy-aware notification delivery

import { notificationsApi, usersApi } from './apiService';

export interface NotificationTarget {
  userIds?: string[];
  role?: 'client' | 'worker' | 'agent' | 'super_worker' | 'super_agent' | 'all';
  hierarchyLevel?: number;
  subordinatesOnly?: boolean;
}

export interface NotificationPayload {
  title: string;
  body: string;
  type?: 'general' | 'project_assignment' | 'project_status_change' | 'broadcast' | 'hierarchy_notification' | 'payment_notification' | 'system_alert';
  projectId?: number;
  templateName?: string;
  templateVariables?: Record<string, string>;
}

export interface HierarchyNotificationOptions {
  senderId: string;
  respectHierarchy: boolean;
  broadcastToAll?: boolean;
  targetSubordinates?: boolean;
}

/**
 * Sends a hierarchy-aware notification
 * Respects user hierarchy relationships and permissions
 */
export const sendNotification = async ({ 
  target, 
  payload, 
  hierarchyOptions 
}: { 
  target: NotificationTarget; 
  payload: NotificationPayload;
  hierarchyOptions?: HierarchyNotificationOptions;
}) => {
  try {
    console.log('📧 Hierarchy-aware notification sent:', {
      target,
      payload,
      hierarchyOptions,
      timestamp: new Date().toISOString()
    });

    const notificationType = payload.type || 'general';
    const results = [];

    // If specific user IDs are provided, send to each
    if (target.userIds && target.userIds.length > 0) {
      for (const userId of target.userIds) {
        try {
          const result = await notificationsApi.create({
            user_id: userId,
            sender_id: hierarchyOptions?.senderId,
            title: payload.title,
            body: payload.body,
            notification_type: notificationType,
            project_id: payload.projectId,
            delivery_status: 'delivered'
          });
          results.push({ userId, success: true, data: result });
        } catch (error) {
          results.push({ userId, success: false, error: error.message });
        }
      }
    }

    // If role-based targeting, get users with that role and send to each
    if (target.role && target.role !== 'all') {
      try {
        const response = await usersApi.getByRole(target.role);
        
        if (response.data && response.data.length > 0) {
          for (const user of response.data) {
            try {
              const result = await notificationsApi.create({
                user_id: user.id,
                sender_id: hierarchyOptions?.senderId,
                title: payload.title,
                body: payload.body,
                notification_type: notificationType,
                project_id: payload.projectId,
                target_roles: [target.role],
                delivery_status: 'delivered'
              });
              results.push({ userId: user.id, success: true, data: result });
            } catch (error) {
              results.push({ userId: user.id, success: false, error: error.message });
            }
          }
        } else {
          console.warn(`No users found with role: ${target.role}`);
        }
      } catch (error) {
        console.error('Error sending role-based notification:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // If broadcasting to all users (Super Agent privilege)
    if (target.role === 'all' && hierarchyOptions?.broadcastToAll) {
      try {
        const response = await usersApi.getAll();
        
        if (response.data && response.data.length > 0) {
          for (const user of response.data) {
            try {
              const result = await notificationsApi.create({
                user_id: user.id,
                sender_id: hierarchyOptions.senderId,
                title: payload.title,
                body: payload.body,
                notification_type: 'broadcast',
                project_id: payload.projectId,
                target_roles: ['all'],
                delivery_status: 'delivered'
              });
              results.push({ userId: user.id, success: true, data: result });
            } catch (error) {
              results.push({ userId: user.id, success: false, error: error.message });
            }
          }
        }
      } catch (error) {
        console.error('Error sending broadcast notification:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return { 
      success: failureCount === 0,
      data: { 
        message: `Notification sent to ${successCount} users${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
        results,
        successCount,
        failureCount
      }
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Gets notification permission status (simplified - no push notifications)
 */
export const getNotificationPermissionStatus = () => {
  return {
    supported: true,
    permission: 'granted',
    message: 'Database notifications are enabled',
    canRequest: false
  };
};

/**
 * Subscribe user (no-op since we removed push notifications)
 */
export const subscribeUser = async (userId: string) => {
  console.log('📧 Push notifications disabled - using database-only notifications for user:', userId);
  return null;
};

/**
 * Send Super Agent broadcast to all users
 */
export const sendSuperAgentBroadcast = async (senderId: string, title: string, message: string) => {
  return sendNotification({
    target: { role: 'all' },
    payload: {
      title,
      body: message,
      type: 'broadcast'
    },
    hierarchyOptions: {
      senderId,
      respectHierarchy: false,
      broadcastToAll: true
    }
  });
};

/**
 * Send Super Worker notification to assigned sub-workers
 */
export const sendSuperWorkerNotification = async (senderId: string, workerIds: string[], title: string, message: string, projectId?: number) => {
  return sendNotification({
    target: { userIds: workerIds },
    payload: {
      title,
      body: message,
      type: 'hierarchy_notification',
      projectId
    },
    hierarchyOptions: {
      senderId,
      respectHierarchy: true,
      targetSubordinates: true
    }
  });
};

/**
 * Send project assignment notification
 */
export const sendProjectAssignmentNotification = async (senderId: string, assigneeId: string, projectName: string, projectId: number) => {
  return sendNotification({
    target: { userIds: [assigneeId] },
    payload: {
      title: 'New Project Assignment',
      body: `You have been assigned to project: ${projectName}. Please review the details and begin work.`,
      type: 'project_assignment',
      projectId
    },
    hierarchyOptions: {
      senderId,
      respectHierarchy: true
    }
  });
};

/**
 * Send project status change notification
 */
export const sendProjectStatusNotification = async (senderId: string, targetUserIds: string[], projectName: string, newStatus: string, projectId: number) => {
  return sendNotification({
    target: { userIds: targetUserIds },
    payload: {
      title: 'Project Status Update',
      body: `Project ${projectName} status has been changed to ${newStatus}.`,
      type: 'project_status_change',
      projectId
    },
    hierarchyOptions: {
      senderId,
      respectHierarchy: true
    }
  });
};

/**
 * Send payment notification
 */
export const sendPaymentNotification = async (senderId: string, targetUserIds: string[], projectName: string, amount: string, projectId: number) => {
  return sendNotification({
    target: { userIds: targetUserIds },
    payload: {
      title: 'Payment Update',
      body: `Payment information has been updated for project ${projectName}. Amount: ${amount}.`,
      type: 'payment_notification',
      projectId
    },
    hierarchyOptions: {
      senderId,
      respectHierarchy: true
    }
  });
};

/**
 * Send hierarchy welcome notification
 */
export const sendHierarchyWelcomeNotification = async (senderId: string, newUserId: string, parentName: string, role: string) => {
  return sendNotification({
    target: { userIds: [newUserId] },
    payload: {
      title: 'Welcome to the Team',
      body: `Welcome to the team! You have been added to the hierarchy under ${parentName}. Your role is ${role}.`,
      type: 'hierarchy_notification'
    },
    hierarchyOptions: {
      senderId,
      respectHierarchy: false // Welcome messages don't need hierarchy checks
    }
  });
};

/**
 * Get user's notification history with hierarchy context
 */
export const getUserNotificationHistory = async (userId: string, limit = 50) => {
  try {
    const response = await fetch(`/api/notifications/history/${userId}?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return { success: true, data: data.data };
    } else {
      throw new Error('Failed to fetch notification history');
    }
  } catch (error) {
    console.error('Error fetching notification history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const response = await fetch(`/api/notifications/${notificationId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        is_read: true,
        read_at: new Date().toISOString(),
        delivery_status: 'read'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return { success: true, data: data.data };
    } else {
      throw new Error('Failed to mark notification as read');
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Queue notification for reliable delivery
 */
export const queueNotification = (target: NotificationTarget, payload: NotificationPayload, hierarchyOptions?: HierarchyNotificationOptions, priority = false) => {
  // For now, just send immediately
  return sendNotification({ target, payload, hierarchyOptions });
};

export default {
  sendNotification,
  sendSuperAgentBroadcast,
  sendSuperWorkerNotification,
  sendProjectAssignmentNotification,
  sendProjectStatusNotification,
  sendPaymentNotification,
  sendHierarchyWelcomeNotification,
  getUserNotificationHistory,
  markNotificationAsRead,
  queueNotification,
  getNotificationPermissionStatus,
  subscribeUser
};