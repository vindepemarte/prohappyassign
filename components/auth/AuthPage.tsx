import React, { useState } from 'react';
import Logo from '../Logo';
import Login from './Login';
import Register from './Register';

type AuthTab = 'login' | 'register';

const AuthPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AuthTab>('login');

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <Logo className="w-32 h-32 mx-auto mb-4" />
                    <h1 className="text-3xl font-extrabold text-[#4A90E2]">Welcome to ProHappyAssignments</h1>
                    <p className="text-gray-500 mt-2">Your trusted partner for academic success since 2017.</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-2">
                    <div className="flex mb-4 bg-gray-100 rounded-full">
                        <button
                            onClick={() => setActiveTab('login')}
                            className={`w-1/2 py-3 font-bold text-center rounded-full transition-all duration-300 ${activeTab === 'login' ? 'bg-[#4A90E2] text-white shadow-lg' : 'text-gray-500'}`}
                        >
                            Login
                        </button>
                        <button
                            onClick={() => setActiveTab('register')}
                            className={`w-1/2 py-3 font-bold text-center rounded-full transition-all duration-300 ${activeTab === 'register' ? 'bg-[#4A90E2] text-white shadow-lg' : 'text-gray-500'}`}
                        >
                            Register
                        </button>
                    </div>
                    <div className="p-6">
                        {activeTab === 'login' ? <Login /> : <Register />}
                    </div>
                </div>

                 <div className="text-center mt-6">
                    <h3 className="font-bold text-lg text-gray-700">Our Guarantees</h3>
                    <div className="flex justify-around text-center mt-4 text-gray-600">
                        <div className="w-1/3">
                            <div className="text-3xl font-bold text-[#4A90E2]">✓</div>
                            <p className="text-sm font-semibold">100% Pass Rate</p>
                        </div>
                         <div className="w-1/3">
                            <div className="text-3xl font-bold text-[#F5A623]">✓</div>
                            <p className="text-sm font-semibold">100% No AI</p>
                        </div>
                         <div className="w-1/3">
                            <div className="text-3xl font-bold text-[#D0021B]">✓</div>
                            <p className="text-sm font-semibold">0% Risk</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AuthPage;