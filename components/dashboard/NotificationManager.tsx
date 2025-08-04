import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { subscribeUser } from '../../services/notificationService';

const NotificationManager: React.FC = () => {
    const { user } = useAuth();
    const [showBanner, setShowBanner] = useState(false);
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const checkNotificationSupport = () => {
            if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
                console.log('Push notifications not supported.');
                return false;
            }
            return true;
        };

        const checkPermission = () => {
            if (!checkNotificationSupport()) return;

            if (Notification.permission === 'default') {
                const dismissed = sessionStorage.getItem('notificationBannerDismissed');
                if (!dismissed) {
                    setShowBanner(true);
                }
            }
        };

        // Delay check slightly to not be too intrusive on page load
        const timer = setTimeout(checkPermission, 3000);
        return () => clearTimeout(timer);
    }, []);

    const handleSubscribe = async () => {
        if (!user) return;
        
        setError('');
        setIsSubscribing(true);
        setShowBanner(false);

        try {
            await subscribeUser(user.id);
            // Optionally show a success message
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
                console.error("Subscription failed:", err.message);
            }
            // If permission was denied, don't show the banner again this session.
            if (Notification.permission !== 'default') {
                 sessionStorage.setItem('notificationBannerDismissed', 'true');
            }
        } finally {
            setIsSubscribing(false);
        }
    };

    const handleDismiss = () => {
        setShowBanner(false);
        sessionStorage.setItem('notificationBannerDismissed', 'true');
    };

    if (!showBanner) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 w-full max-w-sm p-4 bg-white rounded-xl shadow-2xl border z-50">
            <div className="flex items-start">
                <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-[#4A90E2]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                </div>
                <div className="ml-3 w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">Stay Updated!</p>
                    <p className="mt-1 text-sm text-gray-500">Enable push notifications to get real-time updates on your assignments.</p>
                    <div className="mt-4 flex space-x-3">
                        <button
                            onClick={handleSubscribe}
                            disabled={isSubscribing}
                            className="w-full bg-[#4A90E2] text-white px-3 py-2 rounded-md text-sm font-semibold hover:bg-[#4382ce] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4A90E2] disabled:opacity-50"
                        >
                            {isSubscribing ? 'Enabling...' : 'Enable'}
                        </button>
                        <button
                             onClick={handleDismiss}
                            className="w-full bg-gray-100 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none"
                        >
                            Maybe Later
                        </button>
                    </div>
                </div>
                 <div className="ml-4 flex-shrink-0 flex">
                    <button onClick={handleDismiss} className="inline-flex text-gray-400 hover:text-gray-500">
                        <span className="sr-only">Close</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
    );
};

export default NotificationManager;
