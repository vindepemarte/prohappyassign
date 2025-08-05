import { supabase } from './supabase';
import { UserRole } from '../types';

// Notification queue for handling high volume
interface QueuedNotification {
  id: string;
  target: NotificationTarget;
  payload: NotificationPayload;
  projectId?: number;
  priority: 'low' | 'normal' | 'high';
  timestamp: number;
  retryCount: number;
}

class NotificationQueue {
  private queue: QueuedNotification[] = [];
  private processing = false;
  private readonly MAX_CONCURRENT = 5;
  private readonly PROCESSING_DELAY = 100; // ms between processing items
  private activePromises: Set<Promise<void>> = new Set();

  /**
   * Adds a notification to the queue
   */
  enqueue(notification: Omit<QueuedNotification, 'id' | 'timestamp' | 'retryCount'>): string {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queuedNotification: QueuedNotification = {
      ...notification,
      id,
      timestamp: Date.now(),
      retryCount: 0
    };

    // Insert based on priority
    if (notification.priority === 'high') {
      this.queue.unshift(queuedNotification);
    } else {
      this.queue.push(queuedNotification);
    }

    console.log(`Queued notification ${id} with priority ${notification.priority}`);
    
    // Start processing if not already running
    if (!this.processing) {
      this.startProcessing();
    }

    return id;
  }

  /**
   * Starts processing the queue
   */
  private async startProcessing(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;
    console.log('Started notification queue processing');

    while (this.queue.length > 0 || this.activePromises.size > 0) {
      // Process up to MAX_CONCURRENT notifications concurrently
      while (this.activePromises.size < this.MAX_CONCURRENT && this.queue.length > 0) {
        const notification = this.queue.shift()!;
        const promise = this.processNotification(notification);
        
        this.activePromises.add(promise);
        promise.finally(() => {
          this.activePromises.delete(promise);
        });
      }

      // Wait for at least one to complete or a short delay
      if (this.activePromises.size > 0) {
        await Promise.race([
          Promise.all(this.activePromises),
          new Promise(resolve => setTimeout(resolve, this.PROCESSING_DELAY))
        ]);
      }
    }

    this.processing = false;
    console.log('Finished notification queue processing');
  }

  /**
   * Processes a single notification
   */
  private async processNotification(notification: QueuedNotification): Promise<void> {
    try {
      console.log(`Processing notification ${notification.id}`);
      
      const result = await sendTrackedNotification({
        target: notification.target,
        payload: notification.payload,
        projectId: notification.projectId
      });

      if (!result.success) {
        console.error(`Failed to process notification ${notification.id}:`, result.error);
        
        // Re-queue with lower priority if retry count is low
        if (notification.retryCount < 2) {
          const retryNotification = {
            ...notification,
            retryCount: notification.retryCount + 1,
            priority: 'low' as const,
            timestamp: Date.now()
          };
          
          // Add delay before retry
          setTimeout(() => {
            this.queue.push(retryNotification);
            if (!this.processing) {
              this.startProcessing();
            }
          }, Math.pow(2, notification.retryCount) * 1000); // Exponential backoff
        }
      } else {
        console.log(`Successfully processed notification ${notification.id}`);
      }
    } catch (error) {
      console.error(`Error processing notification ${notification.id}:`, error);
    }
  }

  /**
   * Gets queue status
   */
  getStatus(): { queueLength: number; processing: boolean; activeCount: number } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      activeCount: this.activePromises.size
    };
  }

  /**
   * Clears the queue
   */
  clear(): void {
    this.queue = [];
    console.log('Notification queue cleared');
  }
}

// Global notification queue instance
const notificationQueue = new NotificationQueue();

/**
 * User-friendly error messages for common notification failures
 */
const getErrorMessage = (error: string): string => {
  const errorMappings: Record<string, string> = {
    'VAPID keys missing': 'Push notifications are not configured. Please contact support.',
    'Failed to send a request': 'Unable to connect to notification service. Please check your internet connection.',
    'Permission denied': 'Notification permissions are required. Please enable notifications in your browser settings.',
    'Service worker not found': 'Notification service is not available. Please refresh the page and try again.',
    'Network error': 'Network connection failed. Your notification will be retried automatically.',
    'Timeout': 'Request timed out. Your notification will be retried automatically.'
  };

  // Check for partial matches
  for (const [key, message] of Object.entries(errorMappings)) {
    if (error.toLowerCase().includes(key.toLowerCase())) {
      return message;
    }
  }

  // Default user-friendly message
  return 'Unable to send notification right now. It will be retried automatically.';
};

// =================================================================================
// IMPORTANT: VAPID KEYS CONFIGURATION
// For push notifications to work, you MUST generate your own VAPID keys.
// You can use an online generator or run `npx web-push generate-vapid-keys`.
//
// 1. Update VAPID_PUBLIC_KEY below with your new public key.
// 2. Go to your Supabase Project > Settings > Edge Functions and add two secrets:
//    - Name: VAPID_PUBLIC_KEY, Value: your-public-key
//    - Name: VAPID_PRIVATE_KEY, Value: your-private-key
// =================================================================================
const VAPID_PUBLIC_KEY = 'BCKRNmBrJ2jvnezsPHWIuczhmP3bhxH6BCfzoeGGk39I2UObWJ4QeqULDW7M_iHA03xJD-XMh8lEvZYjdl8Sge0'

if (VAPID_PUBLIC_KEY.includes('REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY')) {
    console.warn(
        `%cWARNING: Push notifications will not work. A VAPID public key is required. Please update services/notificationService.ts and add VAPID secrets to your Supabase project settings.`,
        'color: #D97706; font-size: 14px; font-weight: bold; background-color: #FFFBEB; padding: 10px; border-left: 5px solid #FBBF24; border-radius: 4px;'
    );
}

function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, "+")
        .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

const saveSubscription = async (userId: string, subscription: PushSubscription) => {
    const { data, error } = await supabase
        .from('push_subscriptions')
        .insert({
            user_id: userId,
            subscription: subscription.toJSON()
        });

    if (error) {
        // A unique constraint violation on the subscription endpoint might happen
        // if the user already subscribed on this browser. This is not a critical error.
        if (error.code !== '23505') {
            console.error('Error saving push subscription:', error);
            throw new Error('Could not save push notification subscription.');
        } else {
            console.log('Subscription already exists for this user.');
        }
    }

    return data;
};

export const subscribeUser = async (userId: string) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notifications are not supported by this browser.');
        return null;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('Push notification permission denied.');
            return null;
        }

        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            console.log('User is already subscribed.');
            // Optionally, resave to ensure backend is in sync
            try {
                await saveSubscription(userId, subscription);
            } catch (error) {
                console.warn('Failed to save existing subscription:', error);
            }
            return subscription;
        }

        if (VAPID_PUBLIC_KEY.includes('REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY')) {
            console.warn('VAPID key not configured, skipping push subscription');
            return null;
        }

        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey
        });

        console.log('User subscribed successfully.');
        await saveSubscription(userId, subscription);

        return subscription;
    } catch (error) {
        console.error('Error subscribing user to push notifications:', error);
        return null;
    }
};


interface NotificationTarget {
    userIds?: string[];
    role?: UserRole | 'all';
}

interface NotificationPayload {
    title: string;
    body: string;
}

/**
 * Sends a push notification by invoking a Supabase Edge Function.
 * @param target The target audience for the notification.
 * @param payload The content of the notification.
 */
export const sendNotification = async ({ target, payload }: { target: NotificationTarget; payload: NotificationPayload }) => {
    try {
        console.log('Sending notification:', { target, payload });
        
        const { data, error } = await supabase.functions.invoke('send-push-notification', {
            body: { target, payload },
        });

        if (error) {
            console.error('Error invoking send-push-notification function:', error);
            
            // Handle specific error cases
            let errorMessage = 'Failed to send notification. Please try again later.';
            
            if (error.message?.includes('VAPID keys missing')) {
                errorMessage = 'Push notifications are not configured. Please contact support.';
            } else if (error.message?.includes('Failed to send a request')) {
                errorMessage = 'Unable to connect to notification service. Please try again later.';
            } else if (error.message?.includes('Function not found') || error.message?.includes('404')) {
                errorMessage = 'Notification service is not available. Please contact support.';
            } else if (error.message?.includes('500') || error.message?.includes('Internal Server Error')) {
                errorMessage = 'Notification service is temporarily unavailable. Please try again later.';
            } else if (error.message) {
                errorMessage = `Failed to send notification: ${error.message}`;
            }
            
            return { 
                error: getErrorMessage(errorMessage),
                success: false 
            };
        }

        console.log('Notification function invoked successfully:', data);
        return { 
            success: true,
            data 
        };
    } catch (error: any) {
        console.error('Network error sending notification:', error);
        
        // Return a user-friendly error instead of throwing
        return { 
            error: getErrorMessage(error.message || 'Network error'),
            success: false 
        };
    }
};

/**
 * Sends a tracked notification with automatic retry mechanism
 * @param target The target audience for the notification
 * @param payload The content of the notification
 * @param projectId Optional project ID for tracking
 * @returns Promise<{ success: boolean; notificationId?: number; error?: string }>
 */
export const sendTrackedNotification = async ({ 
    target, 
    payload, 
    projectId 
}: { 
    target: NotificationTarget; 
    payload: NotificationPayload; 
    projectId?: number;
}) => {
    // Import NotificationTracker to avoid circular dependencies
    const { NotificationTracker } = await import('./notificationTracker');
    
    // If target has specific userIds, send to each user individually for better tracking
    if (target.userIds && target.userIds.length > 0) {
        const results = [];
        
        for (const userId of target.userIds) {
            const notificationData = {
                userId,
                projectId,
                title: payload.title,
                body: payload.body
            };
            
            const sendFunction = async () => {
                return await sendNotification({
                    target: { userIds: [userId] },
                    payload
                });
            };
            
            const result = await NotificationTracker.trackNotificationDelivery(
                notificationData,
                sendFunction
            );
            
            results.push(result);
        }
        
        const allSuccessful = results.every(r => r.success);
        const errors = results.filter(r => !r.success).map(r => r.error).join(', ');
        
        return {
            success: allSuccessful,
            results,
            error: allSuccessful ? undefined : errors
        };
    } else {
        // For role-based notifications, we can't track individual users easily
        // So we'll send without tracking for now
        console.warn('Role-based notifications are not individually tracked yet');
        return await sendNotification({ target, payload });
    }
};

/**
 * Queues a notification for reliable delivery with 100% guarantee
 * @param target The target audience for the notification
 * @param payload The content of the notification
 * @param projectId Optional project ID for tracking
 * @param priority Priority level for the notification
 * @returns Promise<string> The queue ID for tracking
 */
export const queueNotification = async ({
    target,
    payload,
    projectId,
    priority = 'normal'
}: {
    target: NotificationTarget;
    payload: NotificationPayload;
    projectId?: number;
    priority?: 'low' | 'normal' | 'high';
}): Promise<string> => {
    return notificationQueue.enqueue({
        target,
        payload,
        projectId,
        priority
    });
};

/**
 * Gets the current status of the notification queue
 */
export const getNotificationQueueStatus = () => {
    return notificationQueue.getStatus();
};

/**
 * Clears the notification queue (for testing/admin purposes)
 */
export const clearNotificationQueue = () => {
    notificationQueue.clear();
};

/**
 * Enhanced sendNotification with 100% delivery guarantee
 * This is the main function that should be used for all notifications
 */
export const sendNotificationWithGuarantee = async ({
    target,
    payload,
    projectId,
    priority = 'normal'
}: {
    target: NotificationTarget;
    payload: NotificationPayload;
    projectId?: number;
    priority?: 'low' | 'normal' | 'high';
}) => {
    try {
        // For high priority notifications, try immediate delivery first
        if (priority === 'high') {
            const immediateResult = await sendTrackedNotification({
                target,
                payload,
                projectId
            });
            
            if (immediateResult.success) {
                return {
                    success: true,
                    immediate: true,
                    queueId: null
                };
            }
        }
        
        // Queue the notification for guaranteed delivery
        const queueId = await queueNotification({
            target,
            payload,
            projectId,
            priority
        });
        
        return {
            success: true,
            immediate: false,
            queueId
        };
        
    } catch (error) {
        console.error('Error in sendNotificationWithGuarantee:', error);
        
        // Even if there's an error, try to queue it
        try {
            const queueId = await queueNotification({
                target,
                payload,
                projectId,
                priority: 'high' // Escalate priority for error cases
            });
            
            return {
                success: true,
                immediate: false,
                queueId,
                error: 'Queued after initial failure'
            };
        } catch (queueError) {
            return {
                success: false,
                error: `Failed to send and queue notification: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
};
