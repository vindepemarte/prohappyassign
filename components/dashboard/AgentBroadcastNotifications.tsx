import React, { useState } from 'react';
import { UserRole } from '../../types';
import WorkflowNotificationService from '../../services/workflowNotificationService';
import { useAuth } from '../../hooks/useAuth';
import Button from '../Button';

const AgentBroadcastNotifications: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const availableRoles: { value: UserRole; label: string; description: string }[] = [
    { value: 'client', label: 'Clients', description: 'All clients using the platform' },
    { value: 'worker', label: 'Workers', description: 'All workers assigned to projects' },
    { value: 'agent', label: 'Other Agents', description: 'All other agents (excluding yourself)' }
  ];

  const handleRoleToggle = (role: UserRole) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleSendBroadcast = async () => {
    if (!user || !title.trim() || !message.trim() || selectedRoles.length === 0) {
      setResult({ type: 'error', message: 'Please fill in all fields and select at least one role.' });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      await WorkflowNotificationService.sendBroadcastNotification(
        title.trim(),
        message.trim(),
        selectedRoles,
        user.id
      );

      setResult({ 
        type: 'success', 
        message: `Broadcast sent successfully to ${selectedRoles.length} role(s)!` 
      });
      
      // Reset form
      setTitle('');
      setMessage('');
      setSelectedRoles([]);
      
      // Auto-close after success
      setTimeout(() => {
        setIsOpen(false);
        setResult(null);
      }, 2000);

    } catch (error) {
      setResult({ 
        type: 'error', 
        message: 'Failed to send broadcast notification. Please try again.' 
      });
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Broadcast Notifications</h3>
            <p className="text-sm text-gray-600 mt-1">Send notifications to clients, workers, or other agents</p>
          </div>
          <Button 
            onClick={() => setIsOpen(true)}
            className="!w-auto px-6 py-3 text-sm"
          >
            📢 Send Broadcast
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Send Broadcast Notification</h3>
          <p className="text-sm text-gray-600 mt-1">Send a message to selected user groups</p>
        </div>
        <button
          onClick={() => {
            setIsOpen(false);
            setResult(null);
            setTitle('');
            setMessage('');
            setSelectedRoles([]);
          }}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Title Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Notification Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter notification title..."
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            maxLength={100}
          />
          <p className="text-xs text-gray-500 mt-1">{title.length}/100 characters</p>
        </div>

        {/* Message Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your message..."
            rows={4}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
            maxLength={500}
          />
          <p className="text-xs text-gray-500 mt-1">{message.length}/500 characters</p>
        </div>

        {/* Role Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Send to
          </label>
          <div className="space-y-3">
            {availableRoles.map((role) => (
              <div
                key={role.value}
                className={`
                  p-4 rounded-xl border-2 cursor-pointer transition-all
                  ${selectedRoles.includes(role.value)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
                onClick={() => handleRoleToggle(role.value)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${selectedRoles.includes(role.value) ? 'text-blue-900' : 'text-gray-900'}`}>
                      {role.label}
                    </p>
                    <p className={`text-sm ${selectedRoles.includes(role.value) ? 'text-blue-700' : 'text-gray-600'}`}>
                      {role.description}
                    </p>
                  </div>
                  {selectedRoles.includes(role.value) && (
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Result Message */}
        {result && (
          <div className={`p-4 rounded-xl ${result.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`text-sm font-medium ${result.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
              {result.message}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Button
            onClick={handleSendBroadcast}
            disabled={sending || !title.trim() || !message.trim() || selectedRoles.length === 0}
            className="flex-1"
          >
            {sending ? (
              <>
                <div className="loading-spinner loading-spinner--small mr-2"></div>
                Sending...
              </>
            ) : (
              '📢 Send Broadcast'
            )}
          </Button>
          <Button
            onClick={() => {
              setIsOpen(false);
              setResult(null);
              setTitle('');
              setMessage('');
              setSelectedRoles([]);
            }}
            variant="ghost"
            className="!w-auto px-6"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AgentBroadcastNotifications;