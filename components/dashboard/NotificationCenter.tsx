import React, { useState, useEffect } from 'react';
import { 
  getUserNotificationHistory, 
  markNotificationAsRead,
  sendSuperAgentBroadcast,
  sendSuperWorkerNotification
} from '../../services/notificationService';

interface Notification {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  sender_name?: string;
  sender_role?: string;
  project_name?: string;
  is_read: boolean;
  created_at: string;
  hierarchy_level?: number;
}

interface NotificationCenterProps {
  userId: string;
  userRole: string;
  onNotificationUpdate?: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  userId, 
  userRole, 
  onNotificationUpdate 
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [subordinates, setSubordinates] = useState([]);
  const [selectedSubordinates, setSelectedSubordinates] = useState<string[]>([]);
  const [showSubordinateForm, setShowSubordinateForm] = useState(false);
  const [subordinateTitle, setSubordinateTitle] = useState('');
  const [subordinateMessage, setSubordinateMessage] = useState('');

  useEffect(() => {
    loadNotifications();
    if (userRole === 'super_worker') {
      loadSubordinates();
    }
  }, [userId]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const result = await getUserNotificationHistory(userId, 20);
      if (result.success) {
        setNotifications(result.data);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubordinates = async () => {
    try {
      const response = await fetch('/api/notifications/subordinates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSubordinates(data.data);
      }
    } catch (error) {
      console.error('Error loading subordinates:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const result = await markNotificationAsRead(notificationId);
      if (result.success) {
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId 
              ? { ...n, is_read: true }
              : n
          )
        );
        onNotificationUpdate?.();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      alert('Please fill in both title and message');
      return;
    }

    try {
      const result = await sendSuperAgentBroadcast(userId, broadcastTitle, broadcastMessage);
      if (result.success) {
        alert(`Broadcast sent successfully to ${result.data.successCount} users`);
        setBroadcastTitle('');
        setBroadcastMessage('');
        setShowBroadcastForm(false);
      } else {
        alert(`Failed to send broadcast: ${result.error}`);
      }
    } catch (error) {
      console.error('Error sending broadcast:', error);
      alert('Failed to send broadcast');
    }
  };

  const handleSendSubordinateNotification = async () => {
    if (!subordinateTitle.trim() || !subordinateMessage.trim() || selectedSubordinates.length === 0) {
      alert('Please fill in title, message, and select at least one subordinate');
      return;
    }

    try {
      const result = await sendSuperWorkerNotification(
        userId, 
        selectedSubordinates, 
        subordinateTitle, 
        subordinateMessage
      );
      
      if (result.success) {
        alert(`Notification sent successfully to ${result.data.successCount} subordinates`);
        setSubordinateTitle('');
        setSubordinateMessage('');
        setSelectedSubordinates([]);
        setShowSubordinateForm(false);
      } else {
        alert(`Failed to send notification: ${result.error}`);
      }
    } catch (error) {
      console.error('Error sending subordinate notification:', error);
      alert('Failed to send notification');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'broadcast': return '📢';
      case 'project_assignment': return '📋';
      case 'project_status_change': return '🔄';
      case 'hierarchy_notification': return '👥';
      case 'payment_notification': return '💰';
      case 'system_alert': return '⚠️';
      default: return '📧';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="notification-center">
      <div className="notification-header">
        <h3>
          Notifications 
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount}</span>
          )}
        </h3>
        
        <div className="notification-actions">
          {userRole === 'super_agent' && (
            <button 
              onClick={() => setShowBroadcastForm(!showBroadcastForm)}
              className="btn btn-primary btn-sm"
            >
              📢 Broadcast
            </button>
          )}
          
          {userRole === 'super_worker' && (
            <button 
              onClick={() => setShowSubordinateForm(!showSubordinateForm)}
              className="btn btn-secondary btn-sm"
            >
              👥 Notify Workers
            </button>
          )}
          
          <button 
            onClick={loadNotifications}
            className="btn btn-outline btn-sm"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Super Agent Broadcast Form */}
      {showBroadcastForm && userRole === 'super_agent' && (
        <div className="broadcast-form">
          <h4>Send System Broadcast</h4>
          <input
            type="text"
            placeholder="Broadcast title"
            value={broadcastTitle}
            onChange={(e) => setBroadcastTitle(e.target.value)}
            className="form-input"
          />
          <textarea
            placeholder="Broadcast message"
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            className="form-textarea"
            rows={3}
          />
          <div className="form-actions">
            <button onClick={handleSendBroadcast} className="btn btn-primary">
              Send Broadcast
            </button>
            <button 
              onClick={() => setShowBroadcastForm(false)} 
              className="btn btn-outline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Super Worker Subordinate Notification Form */}
      {showSubordinateForm && userRole === 'super_worker' && (
        <div className="subordinate-form">
          <h4>Notify Sub-Workers</h4>
          <input
            type="text"
            placeholder="Notification title"
            value={subordinateTitle}
            onChange={(e) => setSubordinateTitle(e.target.value)}
            className="form-input"
          />
          <textarea
            placeholder="Notification message"
            value={subordinateMessage}
            onChange={(e) => setSubordinateMessage(e.target.value)}
            className="form-textarea"
            rows={3}
          />
          
          <div className="subordinate-selection">
            <h5>Select Sub-Workers:</h5>
            {subordinates.map((sub: any) => (
              <label key={sub.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedSubordinates.includes(sub.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSubordinates([...selectedSubordinates, sub.id]);
                    } else {
                      setSelectedSubordinates(selectedSubordinates.filter(id => id !== sub.id));
                    }
                  }}
                />
                {sub.full_name} ({sub.role})
              </label>
            ))}
          </div>
          
          <div className="form-actions">
            <button onClick={handleSendSubordinateNotification} className="btn btn-primary">
              Send Notification
            </button>
            <button 
              onClick={() => setShowSubordinateForm(false)} 
              className="btn btn-outline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="notifications-list">
        {loading ? (
          <div className="loading">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="no-notifications">No notifications yet</div>
        ) : (
          notifications.map((notification) => (
            <div 
              key={notification.id}
              className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
              onClick={() => !notification.is_read && handleMarkAsRead(notification.id)}
            >
              <div className="notification-icon">
                {getNotificationIcon(notification.notification_type)}
              </div>
              
              <div className="notification-content">
                <div className="notification-title">
                  {notification.title}
                  {!notification.is_read && <span className="unread-dot">•</span>}
                </div>
                
                <div className="notification-body">
                  {notification.body}
                </div>
                
                <div className="notification-meta">
                  {notification.sender_name && (
                    <span className="sender">
                      From: {notification.sender_name} ({notification.sender_role})
                    </span>
                  )}
                  {notification.project_name && (
                    <span className="project">
                      Project: {notification.project_name}
                    </span>
                  )}
                  <span className="timestamp">
                    {formatDate(notification.created_at)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .notification-center {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }

        .notification-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .notification-header h3 {
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .unread-badge {
          background: #ef4444;
          color: white;
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 12px;
          font-weight: bold;
        }

        .notification-actions {
          display: flex;
          gap: 8px;
        }

        .broadcast-form, .subordinate-form {
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .broadcast-form h4, .subordinate-form h4 {
          margin: 0 0 12px 0;
          color: #374151;
        }

        .form-input, .form-textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          margin-bottom: 12px;
          font-size: 14px;
        }

        .form-textarea {
          resize: vertical;
          min-height: 80px;
        }

        .subordinate-selection {
          margin: 12px 0;
        }

        .subordinate-selection h5 {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #374151;
        }

        .checkbox-label {
          display: block;
          margin-bottom: 4px;
          font-size: 14px;
          cursor: pointer;
        }

        .checkbox-label input {
          margin-right: 8px;
        }

        .form-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .notifications-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .loading, .no-notifications {
          padding: 40px 20px;
          text-align: center;
          color: #6b7280;
        }

        .notification-item {
          display: flex;
          padding: 16px 20px;
          border-bottom: 1px solid #f3f4f6;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .notification-item:hover {
          background: #f9fafb;
        }

        .notification-item.unread {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
        }

        .notification-icon {
          font-size: 20px;
          margin-right: 12px;
          flex-shrink: 0;
        }

        .notification-content {
          flex: 1;
        }

        .notification-title {
          font-weight: 600;
          color: #111827;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .unread-dot {
          color: #ef4444;
          font-size: 16px;
        }

        .notification-body {
          color: #4b5563;
          font-size: 14px;
          margin-bottom: 8px;
          line-height: 1.4;
        }

        .notification-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          font-size: 12px;
          color: #6b7280;
        }

        .sender, .project, .timestamp {
          display: flex;
          align-items: center;
        }

        .btn {
          padding: 6px 12px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover {
          background: #2563eb;
        }

        .btn-secondary {
          background: #6b7280;
          color: white;
        }

        .btn-secondary:hover {
          background: #4b5563;
        }

        .btn-outline {
          background: transparent;
          color: #6b7280;
          border: 1px solid #d1d5db;
        }

        .btn-outline:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .btn-sm {
          padding: 4px 8px;
          font-size: 11px;
        }
      `}</style>
    </div>
  );
};

export default NotificationCenter;