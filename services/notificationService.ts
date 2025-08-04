import { supabase } from './supabase';
import { UserRole } from '../types';

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
const VAPID_PUBLIC_KEY = 'BCKRNmBrJ2jvnezsPHWIuczhmP3bhxH6BCfzoeGGk39I2UObWJ4QeqULDW7M_iHA03xJD-XMh8lEvZYjdl8Sge0'; 

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
        const { data, error } = await supabase.functions.invoke('send-push-notification', {
            body: { target, payload },
        });

        if (error) {
            console.error('Error invoking send-push-notification function:', error);
            throw new Error(`Failed to send notification: ${error.message}`);
        }

        console.log('Notification function invoked successfully:', data);
        return data;
    } catch (error) {
        console.error('Network error sending notification:', error);
        // Don't throw for network errors, just log them
        return { error: 'Network error' };
    }
};
