import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../Button';
import Input from '../Input';
import { COLORS } from '../../constants';
import { sendNotification } from '../../services/notificationService';

const Register: React.FC = () => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const { register } = useAuth();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            await register(email, password, fullName);
            setMessage('Registration successful! You can now log in.');

            // Notify agents about the new registration.
            sendNotification({
                target: { role: 'agent' },
                payload: {
                    title: 'New User Registered',
                    body: `A new user, ${fullName || email}, has just signed up.`,
                },
            }).catch(err => console.error("Failed to send new user notification:", err));
        } catch (error: any) {
            setError(error.message);
        }
        
        setLoading(false);
    };

    return (
        <form onSubmit={handleRegister} className="space-y-4">
             <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Your Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>}
            />
            <Input
                id="emailReg"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>}
            />
            <Input
                id="passwordReg"
                name="password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" /></svg>}
            />
            {error && <p className="text-center text-sm" style={{color: COLORS.red}}>{error}</p>}
            {message && <p className="text-center text-sm" style={{color: COLORS.success}}>{message}</p>}
            <div className="pt-2">
                <Button type="submit" disabled={loading}>
                    {loading ? 'Registering...' : 'Create Account'}
                </Button>
            </div>
        </form>
    );
};

export default Register;