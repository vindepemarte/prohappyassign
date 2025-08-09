// PostgreSQL-based notification service
// Simplified version without push notifications

import { notificationsApi, usersApi } from './apiService';

export interface NotificationTarget {
  userIds?: string[];
  role?: 'client' | 'worker' | 'agent' | 'all';
}

export interface NotificationPayload {
  title: string;
  body: string;
}

/**
 * Sends a notification (database only - no push notifications)
 * Saves notification to database via API
 */
export const sendNotification = async ({ target, payload }: { 
  target: NotificationTarget; 
  payload: NotificationPayload 
}) => {
  try {
    console.log('📧 Notification sent (database only):', {
      target,
      payload,
      timestamp: new Date().toISOString()
    });

    // If specific user IDs are provided, send to each
    if (target.userIds && target.userIds.length > 0) {
      for (const userId of target.userIds) {
        await notificationsApi.create({
          user_id: userId,
          title: payload.title,
          body: payload.body,
          delivery_status: 'pending'
        });
      }
    }

    // If role-based targeting, get users with that role and send to each
    if (target.role && target.role !== 'all') {
      try {
        const response = await usersApi.getByRole(target.role);
        
        if (response.data && response.data.length > 0) {
          for (const user of response.data) {
            await notificationsApi.create({
              user_id: user.id,
              title: payload.title,
              body: payload.body,
              delivery_status: 'pending'
            });
          }
        } else {
          console.warn(`No users found with role: ${target.role}`);
        }
      } catch (error) {
        console.error('Error sending role-based notification:', error);
      }
    }

    return { 
      success: true,
      data: { message: 'Notification logged successfully' }
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
 * Queue notification for reliable delivery
 */
export const queueNotification = (target: NotificationTarget, payload: NotificationPayload, priority = false) => {
  // For now, just send immediately
  return sendNotification({ target, payload });
};

export default {
  sendNotification,
  queueNotification,
  getNotificationPermissionStatus,
  subscribeUser
};