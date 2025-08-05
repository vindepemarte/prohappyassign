/**
 * Notification Tracker Utility
 * Handles notification delivery tracking, retry logic, and history management
 */

import { supabase } from './supabase';
import type { NotificationData, DeliveryStatus } from '../types';

export interface NotificationResult {
  success: boolean;
  notificationId: number;
  deliveryStatus: DeliveryStatus;
  error?: string;
}

export interface NotificationTarget {
  userIds?: string[];
  role?: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
}

export class NotificationTracker {
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly RETRY_DELAYS = [2000, 8000, 32000]; // Exponential backoff: 2s, 8s, 32s
  private static retryQueue: Map<number, NodeJS.Timeout> = new Map();

  /**
   * Creates a notification record in the database
   * @param notificationData Notification data
   * @returns Promise<number> The notification ID
   */
  static async createNotificationRecord(notificationData: NotificationData): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('notification_history')
        .insert({
          user_id: notificationData.userId,
          project_id: notificationData.projectId || null,
          title: notificationData.title,
          body: notificationData.body,
          delivery_status: 'pending',
          retry_count: 0
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating notification record:', error);
        
        // If table doesn't exist, return a mock ID
        if (error.message?.includes('relation "notification_history" does not exist') || 
            error.message?.includes('table "notification_history" does not exist')) {
          console.warn('notification_history table does not exist. Using mock ID.');
          return Date.now(); // Return timestamp as mock ID
        }
        
        throw new Error('Failed to create notification record');
      }

      return data.id;
    } catch (error) {
      console.error('Error in createNotificationRecord:', error);
      return Date.now(); // Return timestamp as fallback
    }
  }

  /**
   * Updates notification delivery status
   * @param notificationId Notification ID
   * @param status Delivery status
   * @param errorMessage Optional error message
   */
  static async updateDeliveryStatus(
    notificationId: number, 
    status: DeliveryStatus, 
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      delivery_status: status
    };

    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await supabase
      .from('notification_history')
      .update(updateData)
      .eq('id', notificationId);

    if (error) {
      console.error('Error updating notification status:', error);
    }
  }

  /**
   * Increments retry count for a notification
   * @param notificationId Notification ID
   */
  static async incrementRetryCount(notificationId: number): Promise<void> {
    const { error } = await supabase
      .rpc('increment_notification_retry', { notification_id: notificationId });

    if (error) {
      console.error('Error incrementing retry count:', error);
    }
  }

  /**
   * Gets failed notifications that need retry
   * @returns Promise<Array> List of notifications to retry
   */
  static async getFailedNotifications(): Promise<any[]> {
    const { data, error } = await supabase
      .from('notification_history')
      .select('*')
      .eq('delivery_status', 'failed')
      .lt('retry_count', this.MAX_RETRY_ATTEMPTS)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching failed notifications:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Tracks notification delivery with retry logic
   * @param notificationData Notification data
   * @param sendFunction Function to send the notification
   * @returns Promise<NotificationResult>
   */
  static async trackNotificationDelivery(
    notificationData: NotificationData,
    sendFunction: () => Promise<{ success: boolean; error?: string }>
  ): Promise<NotificationResult> {
    let notificationId: number;

    try {
      // Create notification record
      notificationId = await this.createNotificationRecord(notificationData);

      // Update status to 'sent'
      await this.updateDeliveryStatus(notificationId, 'sent');

      // Attempt to send notification
      const result = await sendFunction();

      if (result.success) {
        await this.updateDeliveryStatus(notificationId, 'delivered');
        return {
          success: true,
          notificationId,
          deliveryStatus: 'delivered'
        };
      } else {
        const errorMessage = result.error || 'Send function returned false';
        await this.updateDeliveryStatus(notificationId, 'failed', errorMessage);
        
        // Schedule retry if within retry limits
        this.scheduleRetry(notificationId, notificationData, sendFunction);
        
        return {
          success: false,
          notificationId,
          deliveryStatus: 'failed',
          error: errorMessage
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (notificationId!) {
        await this.updateDeliveryStatus(notificationId, 'failed', errorMessage);
        // Schedule retry if within retry limits
        this.scheduleRetry(notificationId, notificationData, sendFunction);
      }

      return {
        success: false,
        notificationId: notificationId!,
        deliveryStatus: 'failed',
        error: errorMessage
      };
    }
  }

  /**
   * Schedules a retry for a failed notification
   * @param notificationId Notification ID
   * @param notificationData Original notification data
   * @param sendFunction Function to send the notification
   */
  private static async scheduleRetry(
    notificationId: number,
    notificationData: NotificationData,
    sendFunction: () => Promise<{ success: boolean; error?: string }>
  ): Promise<void> {
    try {
      // Get current retry count
      const { data: notification } = await supabase
        .from('notification_history')
        .select('retry_count')
        .eq('id', notificationId)
        .single();

      const currentRetryCount = notification?.retry_count || 0;

      if (currentRetryCount >= this.MAX_RETRY_ATTEMPTS) {
        console.log(`Max retry attempts reached for notification ${notificationId}`);
        return;
      }

      // Clear any existing retry timeout
      if (this.retryQueue.has(notificationId)) {
        clearTimeout(this.retryQueue.get(notificationId)!);
      }

      // Schedule retry with exponential backoff
      const delay = this.RETRY_DELAYS[currentRetryCount] || this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1];
      
      const timeoutId = setTimeout(async () => {
        try {
          console.log(`Retrying notification ${notificationId} (attempt ${currentRetryCount + 1})`);
          
          // Increment retry count
          await this.incrementRetryCount(notificationId);
          
          // Attempt to resend
          const result = await sendFunction();
          
          if (result.success) {
            await this.updateDeliveryStatus(notificationId, 'delivered');
            console.log(`Notification ${notificationId} delivered on retry ${currentRetryCount + 1}`);
            this.retryQueue.delete(notificationId);
          } else {
            const errorMessage = result.error || 'Retry failed';
            await this.updateDeliveryStatus(notificationId, 'failed', errorMessage);
            
            // Schedule another retry if within limits
            const newRetryCount = currentRetryCount + 1;
            if (newRetryCount < this.MAX_RETRY_ATTEMPTS) {
              this.scheduleRetry(notificationId, notificationData, sendFunction);
            } else {
              console.log(`Notification ${notificationId} failed after ${this.MAX_RETRY_ATTEMPTS} attempts`);
              this.retryQueue.delete(notificationId);
            }
          }
        } catch (error) {
          console.error(`Error during retry for notification ${notificationId}:`, error);
          this.retryQueue.delete(notificationId);
        }
      }, delay);

      this.retryQueue.set(notificationId, timeoutId);
      console.log(`Scheduled retry for notification ${notificationId} in ${delay}ms`);
      
    } catch (error) {
      console.error(`Error scheduling retry for notification ${notificationId}:`, error);
    }
  }

  /**
   * Retries failed notifications with exponential backoff
   * This method is used for batch retry of failed notifications on app startup
   */
  static async retryFailedNotifications(): Promise<void> {
    const failedNotifications = await this.getFailedNotifications();
    console.log(`Found ${failedNotifications.length} failed notifications to retry`);

    for (const notification of failedNotifications) {
      try {
        // Recreate notification data from stored record
        const notificationData: NotificationData = {
          userId: notification.user_id,
          projectId: notification.project_id,
          title: notification.title,
          body: notification.body
        };

        // Create a send function that uses the notification service
        const sendFunction = async () => {
          try {
            // Import the notification service dynamically to avoid circular dependencies
            const { sendNotification } = await import('./notificationService');
            
            const result = await sendNotification({
              target: { userIds: [notification.user_id] },
              payload: { title: notification.title, body: notification.body }
            });

            return { 
              success: !result.error, 
              error: result.error 
            };
          } catch (error) {
            return { 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            };
          }
        };

        // Schedule retry using the existing retry mechanism
        this.scheduleRetry(notification.id, notificationData, sendFunction);
        
      } catch (error) {
        console.error(`Error setting up retry for notification ${notification.id}:`, error);
      }
    }
  }

  /**
   * Clears all pending retries (useful for cleanup)
   */
  static clearAllRetries(): void {
    for (const [notificationId, timeoutId] of this.retryQueue.entries()) {
      clearTimeout(timeoutId);
    }
    this.retryQueue.clear();
    console.log('Cleared all pending notification retries');
  }

  /**
   * Gets the current retry queue status
   */
  static getRetryQueueStatus(): { notificationId: number; scheduled: boolean }[] {
    return Array.from(this.retryQueue.keys()).map(notificationId => ({
      notificationId,
      scheduled: true
    }));
  }

  /**
   * Gets notification history for a user
   * @param userId User ID
   * @param limit Number of notifications to retrieve
   * @returns Promise<Array> Notification history
   */
  static async getNotificationHistory(userId: string, limit: number = 50): Promise<any[]> {
    const { data, error } = await supabase
      .from('notification_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching notification history:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Gets notification statistics for analytics
   * @param startDate Start date for statistics
   * @param endDate End date for statistics
   * @returns Promise<Object> Notification statistics
   */
  static async getNotificationStats(startDate?: Date, endDate?: Date): Promise<{
    total: number;
    delivered: number;
    failed: number;
    pending: number;
    deliveryRate: number;
  }> {
    let query = supabase
      .from('notification_history')
      .select('delivery_status');

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching notification stats:', error);
      
      // If table doesn't exist, return empty stats
      if (error.message?.includes('relation "notification_history" does not exist') || 
          error.message?.includes('table "notification_history" does not exist')) {
        console.warn('notification_history table does not exist. Returning empty stats.');
        return { total: 0, delivered: 0, failed: 0, pending: 0, deliveryRate: 0 };
      }
      
      return { total: 0, delivered: 0, failed: 0, pending: 0, deliveryRate: 0 };
    }

    const stats = {
      total: data?.length || 0,
      delivered: data?.filter(n => n.delivery_status === 'delivered').length || 0,
      failed: data?.filter(n => n.delivery_status === 'failed').length || 0,
      pending: data?.filter(n => n.delivery_status === 'pending').length || 0,
      deliveryRate: 0
    };

    stats.deliveryRate = stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0;

    return stats;
  }
}

// Export utility functions for easier use
export const trackNotification = (data: NotificationData, sendFn: () => Promise<{ success: boolean; error?: string }>) =>
  NotificationTracker.trackNotificationDelivery(data, sendFn);

export const getNotificationHistory = (userId: string, limit?: number) =>
  NotificationTracker.getNotificationHistory(userId, limit);

export const retryFailedNotifications = () =>
  NotificationTracker.retryFailedNotifications();

export const clearAllRetries = () =>
  NotificationTracker.clearAllRetries();

export const getRetryQueueStatus = () =>
  NotificationTracker.getRetryQueueStatus();

/**
 * Initializes the notification system on app startup
 * This should be called when the app starts to retry any failed notifications
 */
export const initializeNotificationSystem = async () => {
  console.log('Initializing notification system...');
  
  try {
    // Retry any failed notifications from previous sessions
    await NotificationTracker.retryFailedNotifications();
    
    // Set up periodic cleanup of old notification records (optional)
    // This could be moved to a background job in production
    setInterval(async () => {
      try {
        // Clean up notification records older than 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { error } = await supabase
          .from('notification_history')
          .delete()
          .lt('created_at', thirtyDaysAgo.toISOString())
          .in('delivery_status', ['delivered', 'failed']);
        
        if (error) {
          console.error('Error cleaning up old notifications:', error);
        } else {
          console.log('Cleaned up old notification records');
        }
      } catch (error) {
        console.error('Error during notification cleanup:', error);
      }
    }, 24 * 60 * 60 * 1000); // Run once per day
    
    console.log('Notification system initialized successfully');
  } catch (error) {
    console.error('Error initializing notification system:', error);
  }
};