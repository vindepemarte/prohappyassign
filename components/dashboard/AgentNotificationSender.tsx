import React, { useState } from 'react';
import { sendNotification } from '../../services/notificationService';
import Button from '../Button';
import Input from '../Input';
import Select from '../common/Select';
import { UserRole } from '../../types';

type TargetAudience = 'all' | UserRole;

const AgentNotificationSender: React.FC = () => {
    const [target, setTarget] = useState<TargetAudience>('all');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !body) {
            setMessage('Title and message body are required.');
            setStatus('error');
            return;
        }

        setStatus('sending');
        setMessage('');

        try {
            const response = await sendNotification({
                target: { role: target },
                payload: { title, body },
            });
            setStatus('success');
            setMessage(`Notification sent successfully to ${response.sent} subscribers.`);
            setTitle('');
            setBody('');
        } catch (err) {
            setStatus('error');
            setMessage(err instanceof Error ? err.message : 'An unknown error occurred.');
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg p-6 border">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📢 Broadcast Notifications</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Select
                        label="Target Audience"
                        containerClassName="md:col-span-1"
                        value={target}
                        onChange={e => setTarget(e.target.value as TargetAudience)}
                    >
                        <option value="all">All Users</option>
                        <option value="client">Clients Only</option>
                        <option value="worker">Workers Only</option>
                        <option value="agent">Agents Only</option>
                    </Select>
                    <Input
                        label="Notification Title"
                        containerClassName="md:col-span-2"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="e.g., Important Update"
                        required
                    />
                </div>
                <div>
                    <label htmlFor="body" className="text-sm font-bold text-gray-600 mb-2 block">Message Body</label>
                    <textarea
                        id="body"
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        placeholder="Enter your notification message here..."
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-4 text-base text-gray-800 focus:outline-none focus:border-[#4A90E2] transition-colors h-24"
                        required
                    />
                </div>
                <div className="flex items-center justify-between pt-2">
                    <div className="flex-grow mr-4">
                        {status === 'success' && <p className="text-sm text-green-600">{message}</p>}
                        {(status === 'error' || (status === 'idle' && message)) && <p className="text-sm text-red-600">{message}</p>}
                    </div>
                    <Button type="submit" disabled={status === 'sending'} className="!w-auto">
                        {status === 'sending' ? 'Sending...' : 'Send Notification'}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default AgentNotificationSender;
