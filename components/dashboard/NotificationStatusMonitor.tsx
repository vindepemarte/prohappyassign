/**
 * Notification Status Monitoring Dashboard Component
 * Displays real-time notification delivery status and queue information
 */

import React, { useState, useEffect } from 'react';
import { getNotificationQueueStatus } from '../../services/notificationService';
import { NotificationTracker, getRetryQueueStatus } from '../../services/notificationTracker';

interface NotificationStats {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  deliveryRate: number;
}

interface QueueStatus {
  queueLength: number;
  processing: boolean;
  activeCount: number;
}

interface RetryStatus {
  notificationId: number;
  scheduled: boolean;
}

export const NotificationStatusMonitor: React.FC = () => {
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    delivered: 0,
    failed: 0,
    pending: 0,
    deliveryRate: 0
  });
  
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    queueLength: 0,
    processing: false,
    activeCount: 0
  });
  
  const [retryStatus, setRetryStatus] = useState<RetryStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  // Refresh data every 5 seconds
  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        
        // Calculate date range
        const now = new Date();
        const startDate = new Date();
        switch (timeRange) {
          case '1h':
            startDate.setHours(now.getHours() - 1);
            break;
          case '24h':
            startDate.setDate(now.getDate() - 1);
            break;
          case '7d':
            startDate.setDate(now.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(now.getDate() - 30);
            break;
        }

        // Fetch notification statistics
        const notificationStats = await NotificationTracker.getNotificationStats(startDate, now);
        setStats(notificationStats);

        // Get queue status
        const currentQueueStatus = getNotificationQueueStatus();
        setQueueStatus(currentQueueStatus);

        // Get retry status
        const currentRetryStatus = getRetryQueueStatus();
        setRetryStatus(currentRetryStatus);

        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching notification status:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch notification status');
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [timeRange]);

  const getStatusColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQueueStatusColor = (processing: boolean, queueLength: number) => {
    if (!processing && queueLength === 0) return 'text-green-600';
    if (processing && queueLength < 10) return 'text-blue-600';
    if (queueLength >= 10) return 'text-yellow-600';
    return 'text-gray-600';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-600">
          <h3 className="text-lg font-medium mb-2">Error Loading Notification Status</h3>
          <p className="text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Notification Status Monitor</h3>
          <div className="flex space-x-2">
            {(['1h', '24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm rounded ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Delivery Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Notifications</div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
            <div className="text-sm text-gray-600">Delivered</div>
          </div>
          
          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
        </div>

        {/* Delivery Rate */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Delivery Rate</span>
            <span className={`text-sm font-bold ${getStatusColor(stats.deliveryRate)}`}>
              {stats.deliveryRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                stats.deliveryRate >= 95 ? 'bg-green-600' :
                stats.deliveryRate >= 85 ? 'bg-yellow-600' : 'bg-red-600'
              }`}
              style={{ width: `${Math.min(stats.deliveryRate, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Queue Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-lg font-bold text-gray-900">{queueStatus.queueLength}</div>
            <div className="text-sm text-gray-600">Queue Length</div>
          </div>
          
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-lg font-bold text-blue-600">{queueStatus.activeCount}</div>
            <div className="text-sm text-gray-600">Processing</div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className={`text-lg font-bold ${getQueueStatusColor(queueStatus.processing, queueStatus.queueLength)}`}>
              {queueStatus.processing ? 'Active' : 'Idle'}
            </div>
            <div className="text-sm text-gray-600">Queue Status</div>
          </div>
        </div>

        {/* Retry Status */}
        {retryStatus.length > 0 && (
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">Scheduled Retries</h4>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-sm text-gray-700">
                {retryStatus.length} notification{retryStatus.length !== 1 ? 's' : ''} scheduled for retry
              </div>
              <div className="mt-2 space-y-1">
                {retryStatus.slice(0, 5).map((retry) => (
                  <div key={retry.notificationId} className="text-xs text-gray-600">
                    Notification ID: {retry.notificationId}
                  </div>
                ))}
                {retryStatus.length > 5 && (
                  <div className="text-xs text-gray-500">
                    ... and {retryStatus.length - 5} more
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Status Indicators */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span>Healthy (≥95%)</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
              <span>Warning (85-94%)</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
              <span>Critical (&lt;85%)</span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationStatusMonitor;