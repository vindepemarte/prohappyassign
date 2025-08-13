#!/usr/bin/env node

/**
 * Test Login Functionality
 * This script tests the login process step by step
 */

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const JWT_SECRET = process.env.JWT_SECRET;

async function testLogin() {
    console.log('🧪 Testing Login Process...');
    console.log('============================================================');

    try {
        const email = 'superagent@test.com';
        const password = '123456';

        // Step 1: Check if user exists
        console.log('📋 Step 1: Finding user...');
        const userResult = await pool.query(
            'SELECT id, email, password_hash, full_name, role, avatar_url, email_verified, created_at, updated_at FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            console.log('❌ User not found');
            return;
        }

        const user = userResult.rows[0];
        console.log('✅ User found:', user.email, '- Role:', user.role);

        // Step 2: Verify password
        console.log('🔐 Step 2: Verifying password...');
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            console.log('❌ Invalid password');
            return;
        }
        console.log('✅ Password verified');

        // Step 3: Get hierarchy information
        console.log('🏗️ Step 3: Getting hierarchy information...');
        const hierarchyResult = await pool.query(
            `SELECT hierarchy_level, parent_id, super_agent_id
             FROM user_hierarchy WHERE user_id = $1`,
            [user.id]
        );

        const hierarchyInfo = hierarchyResult.rows[0] || null;
        if (hierarchyInfo) {
            console.log('✅ Hierarchy found - Level:', hierarchyInfo.hierarchy_level);
        } else {
            console.log('⚠️ No hierarchy information found');
        }

        // Step 4: Generate token
        console.log('🎫 Step 4: Generating JWT token...');
        const payload = { 
            userId: user.id, 
            role: user.role,
            iat: Math.floor(Date.now() / 1000)
        };
        
        if (hierarchyInfo) {
            payload.hierarchy = {
                level: hierarchyInfo.hierarchy_level,
                superAgentId: hierarchyInfo.super_agent_id,
                parentId: hierarchyInfo.parent_id
            };
        }
        
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
        console.log('✅ Token generated:', token.substring(0, 50) + '...');

        // Step 5: Create session
        console.log('💾 Step 5: Creating session...');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        try {
            const sessionResult = await pool.query(
                `INSERT INTO user_sessions (user_id, token_hash, expires_at, user_agent, ip_address) 
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [user.id, tokenHash, expiresAt, 'Test Script', '127.0.0.1']
            );
            console.log('✅ Session created with ID:', sessionResult.rows[0].id);
        } catch (sessionError) {
            console.log('❌ Session creation failed:', sessionError.message);
        }

        // Step 6: Test token verification
        console.log('🔍 Step 6: Testing token verification...');
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            console.log('✅ Token verification successful');
            console.log('   - User ID:', decoded.userId);
            console.log('   - Role:', decoded.role);
            console.log('   - Hierarchy Level:', decoded.hierarchy?.level);
        } catch (tokenError) {
            console.log('❌ Token verification failed:', tokenError.message);
        }

        // Step 7: Test session lookup
        console.log('🔎 Step 7: Testing session lookup...');
        const sessionLookup = await pool.query(
            `SELECT s.user_id, s.expires_at, u.id, u.email, u.full_name, u.role, 
                    u.avatar_url, u.email_verified, u.reference_code_used, u.recruited_by, 
                    u.super_agent_id, u.created_at, u.updated_at,
                    uh.hierarchy_level, uh.parent_id
             FROM user_sessions s
             JOIN users u ON s.user_id = u.id
             LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
             WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
            [tokenHash]
        );

        if (sessionLookup.rows.length > 0) {
            console.log('✅ Session lookup successful');
            const sessionUser = sessionLookup.rows[0];
            console.log('   - User:', sessionUser.email);
            console.log('   - Role:', sessionUser.role);
            console.log('   - Hierarchy Level:', sessionUser.hierarchy_level);
        } else {
            console.log('❌ Session lookup failed');
        }

        // Step 8: Test complete login response
        console.log('📤 Step 8: Complete login response...');
        const { password_hash, ...userWithoutPassword } = user;
        const loginResponse = {
            message: 'Login successful',
            user: {
                ...userWithoutPassword,
                hierarchy: hierarchyInfo
            },
            token,
            expires_at: expiresAt.toISOString()
        };

        console.log('✅ Login response structure complete');
        console.log('   - User ID:', loginResponse.user.id);
        console.log('   - Email:', loginResponse.user.email);
        console.log('   - Role:', loginResponse.user.role);
        console.log('   - Token length:', loginResponse.token.length);

        console.log('');
        console.log('🎉 LOGIN TEST COMPLETED SUCCESSFULLY!');
        console.log('============================================================');
        console.log('');
        console.log('🔑 Test Token (for manual testing):');
        console.log(token);
        console.log('');
        console.log('📋 Test this token with:');
        console.log('curl -H "Authorization: Bearer ' + token + '" http://localhost:3000/api/auth/me');

    } catch (error) {
        console.error('❌ Login test failed:', error);
    } finally {
        await pool.end();
    }
}

// Run the test
testLogin().catch(console.error);