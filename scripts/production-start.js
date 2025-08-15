#!/usr/bin/env node

/**
 * Production Startup Script
 * This script handles database migrations and setup before starting the server
 */

import { Pool } from 'pg';
import { spawn } from 'child_process';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function productionStart() {
    console.log('🚀 Starting production setup...');
    console.log('============================================================');

    try {
        // 1. Test database connection
        console.log('📋 Step 1: Testing database connection...');
        await pool.query('SELECT 1');
        console.log('✅ Database connection successful');

        // 2. Verify database schema is ready
        console.log('📋 Step 2: Verifying database schema...');
        try {
            // Check if users table exists with role column
            console.log('🔍 Checking database structure...');
            
            const usersTableCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = 'users'
                )
            `);
            console.log(`Users table exists: ${usersTableCheck.rows[0].exists}`);
            
            if (!usersTableCheck.rows[0].exists) {
                throw new Error('Users table does not exist - database not properly initialized');
            }
            
            const roleColumnCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'role'
                )
            `);
            console.log(`Role column exists: ${roleColumnCheck.rows[0].exists}`);
            
            if (!roleColumnCheck.rows[0].exists) {
                throw new Error('Role column does not exist in users table - database not properly initialized');
            }
            
            // Check if we have the schema_migrations table
            const migrationTableCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = 'schema_migrations'
                )
            `);
            console.log(`Schema migrations table exists: ${migrationTableCheck.rows[0].exists}`);
            
            if (migrationTableCheck.rows[0].exists) {
                const migrationCount = await pool.query('SELECT COUNT(*) FROM schema_migrations');
                console.log(`✅ Found ${migrationCount.rows[0].count} migrations in database`);
            }
            
            console.log('✅ Database schema verification completed successfully');
            
        } catch (error) {
            console.error('❌ Database schema verification failed:', error.message);
            console.log('🔧 Database appears to need initialization. This should be done manually.');
            console.log('📋 Required tables: users (with role column), projects, agent_pricing, etc.');
            throw new Error(`Database schema verification failed: ${error.message}`);
        }

        // 3. Check if we need to create initial data
        console.log('📋 Step 3: Checking for existing users...');
        const userCheck = await pool.query('SELECT COUNT(*) FROM users');
        const userCount = parseInt(userCheck.rows[0].count);
        
        if (userCount === 0) {
            console.log('⚠️  No users found, creating initial data...');
            const setupProcess = spawn('node', ['scripts/setup-production-data.js'], {
                stdio: 'inherit',
                env: process.env
            });
            
            await new Promise((resolve, reject) => {
                setupProcess.on('close', (code) => {
                    if (code === 0) {
                        console.log('✅ Production data setup completed');
                        resolve();
                    } else {
                        reject(new Error(`Setup process exited with code ${code}`));
                    }
                });
            });
        } else {
            console.log(`✅ Found ${userCount} existing users, skipping data setup`);
        }

        // 4. Start the main server
        console.log('📋 Step 4: Starting main server...');
        console.log('============================================================');
        
        // Import and start the server
        const serverModule = await import('../server.js');
        
    } catch (error) {
        console.error('❌ Production startup failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the production startup
productionStart().catch(console.error);