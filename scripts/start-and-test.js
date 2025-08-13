#!/usr/bin/env node

/**
 * Start Server and Test Login
 */

import { spawn } from 'child_process';
import fetch from 'node-fetch';

console.log('🚀 Starting server and testing login...');

// Start the server
const server = spawn('node', ['server.js'], {
    stdio: 'pipe',
    env: { ...process.env, PORT: '3001' }
});

let serverOutput = '';
server.stdout.on('data', (data) => {
    serverOutput += data.toString();
    console.log('Server:', data.toString().trim());
    
    // Check if server is ready
    if (serverOutput.includes('Server running on port') || serverOutput.includes('listening on')) {
        testLogin();
    }
});

server.stderr.on('data', (data) => {
    console.error('Server Error:', data.toString());
});

async function testLogin() {
    console.log('🧪 Testing login API...');
    
    try {
        // Wait a moment for server to be fully ready
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test login
        const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'superagent@test.com',
                password: '123456'
            })
        });
        
        console.log('Login response status:', loginResponse.status);
        
        if (loginResponse.ok) {
            const loginData = await loginResponse.json();
            console.log('✅ Login successful!');
            console.log('User:', loginData.user.email, '- Role:', loginData.user.role);
            
            // Test /me endpoint
            const meResponse = await fetch('http://localhost:3001/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${loginData.token}`
                }
            });
            
            console.log('/me response status:', meResponse.status);
            
            if (meResponse.ok) {
                const meData = await meResponse.json();
                console.log('✅ /me endpoint working!');
                console.log('User data:', meData.user.email);
            } else {
                console.log('❌ /me endpoint failed');
                const errorText = await meResponse.text();
                console.log('Error:', errorText);
            }
            
        } else {
            console.log('❌ Login failed');
            const errorText = await loginResponse.text();
            console.log('Error:', errorText);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
    
    // Kill server
    server.kill();
    process.exit(0);
}

// Handle cleanup
process.on('SIGINT', () => {
    server.kill();
    process.exit(0);
});