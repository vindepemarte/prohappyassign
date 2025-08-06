import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { subscribeUser, getNotificationPermissionStatus, sendNotification } from '../../services/notificationService';
import { supabase } from '../../services/supabase';
import Button from '../Button';

const PushNotificationTester: React.FC = () => {
  const { user } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<any>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('unknown');
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    checkPermissionStatus();
  }, []);

  const checkPermissionStatus = () => {
    const status = getNotificationPermissionStatus();
    setPermissionStatus(status);
    console.log('Permission status:', status);
  };

  const handleSubscribe = async () => {
    if (!user) {
      setTestResult('❌ No user logged in');
      return;
    }

    try {
      setSubscriptionStatus('subscribing...');
      const subscription = await subscribeUser(user.id);
      
      if (subscription) {
        setSubscriptionStatus('✅ Subscribed successfully');
        setTestResult('✅ Push notification subscription successful');
        console.log('Subscription:', subscription);
      } else {
        setSubscriptionStatus('❌ Subscription failed');
        setTestResult('❌ Failed to subscribe to push notifications');
      }
    } catch (error) {
      setSubscriptionStatus('❌ Error during subscription');
      setTestResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Subscription error:', error);
    }
  };

  const handleTestNotification = async () => {
    if (!user) {
      setTestResult('❌ No user logged in');
      return;
    }

    try {
      setTestResult('📤 Sending test notification...');
      
      const result = await sendNotification({
        target: { userIds: [user.id] },
        payload: {
          title: '🧪 Test Notification',
          body: 'This is a test push notification from ProHappy!'
        }
      });

      if (result.success) {
        setTestResult('✅ Test notification sent successfully');
        console.log('Notification result:', result);
        
        // Also manually add to notification_history to ensure it appears in the bell
        try {
          const { error: dbError } = await supabase
            .from('notification_history')
            .insert({
              user_id: user.id,
              title: '🧪 Test Notification',
              body: 'This is a test push notification from ProHappy!',
              delivery_status: 'sent',
              is_read: false
            });
            
          if (dbError) {
            console.error('Error logging test notification to database:', dbError);
          } else {
            console.log('Test notification logged to database successfully');
          }
        } catch (dbError) {
          console.error('Database logging error:', dbError);
        }
      } else {
        setTestResult(`❌ Failed to send notification: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      setTestResult(`❌ Error sending notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Send notification error:', error);
    }
  };

  const handleRequestPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setTestResult(`Permission result: ${permission}`);
      checkPermissionStatus();
    } catch (error) {
      setTestResult(`❌ Error requesting permission: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (!user) {
    return (
      <div className="bg-white rounded-lg shadow p-6 debug-component">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">🧪 Push Notification Tester</h3>
        <p className="text-gray-600">Please log in to test push notifications.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 debug-component">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">🧪 Push Notification Tester</h3>
      
      <div className="space-y-4">
        {/* Permission Status */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2 text-gray-800">Permission Status</h4>
          {permissionStatus ? (
            <div className="text-sm space-y-1 text-gray-700">
              <p><strong>Supported:</strong> {permissionStatus.supported ? '✅ Yes' : '❌ No'}</p>
              <p><strong>Permission:</strong> {permissionStatus.permission}</p>
              <p><strong>Can Request:</strong> {permissionStatus.canRequest ? '✅ Yes' : '❌ No'}</p>
              {permissionStatus.message && (
                <p className="text-gray-600"><strong>Message:</strong> {permissionStatus.message}</p>
              )}
            </div>
          ) : (
            <p className="text-gray-500">Loading...</p>
          )}
        </div>

        {/* Subscription Status */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-2 text-gray-800">Subscription Status</h4>
          <p className="text-sm text-gray-700">{subscriptionStatus}</p>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2 text-blue-800">Test Result</h4>
            <p className="text-sm text-blue-700">{testResult}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={handleRequestPermission}
            variant="secondary"
            className="!w-auto px-4 py-2 text-sm"
          >
            Request Permission
          </Button>
          
          <Button 
            onClick={handleSubscribe}
            variant="primary"
            className="!w-auto px-4 py-2 text-sm"
          >
            Subscribe to Notifications
          </Button>
          
          <Button 
            onClick={handleTestNotification}
            variant="secondary"
            className="!w-auto px-4 py-2 text-sm"
          >
            Send Test Notification
          </Button>
          
          <Button 
            onClick={checkPermissionStatus}
            variant="ghost"
            className="!w-auto px-4 py-2 text-sm"
          >
            Refresh Status
          </Button>
        </div>

        {/* Debug Info */}
        <details className="bg-gray-50 p-4 rounded-lg">
          <summary className="font-medium cursor-pointer text-gray-800">Debug Information</summary>
          <div className="mt-2 text-xs space-y-1 text-gray-600">
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>Browser:</strong> {navigator.userAgent}</p>
            <p><strong>Service Worker Support:</strong> {'serviceWorker' in navigator ? '✅' : '❌'}</p>
            <p><strong>Push Manager Support:</strong> {'PushManager' in window ? '✅' : '❌'}</p>
            <p><strong>Notification Support:</strong> {'Notification' in window ? '✅' : '❌'}</p>
          </div>
        </details>
      </div>
    </div>
  );
};

export default PushNotificationTester;