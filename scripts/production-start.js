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

        // 2. Check if migrations are needed
        console.log('📋 Step 2: Setting up database schema...');
        try {
            // First, let's verify the database structure
            console.log('🔍 Checking database structure...');
            
            // Check if users table exists
            const usersTableCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = 'users'
                )
            `);
            console.log(`Users table exists: ${usersTableCheck.rows[0].exists}`);
            
            // Check if role column exists
            const roleColumnCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'role'
                )
            `);
            console.log(`Role column exists: ${roleColumnCheck.rows[0].exists}`);
            
            // Check migration count
            const migrationCheck = await pool.query('SELECT COUNT(*) FROM schema_migrations');
            const migrationCount = parseInt(migrationCheck.rows[0].count);
            console.log(`✅ Found ${migrationCount} migrations in database`);
            
            if (migrationCount < 10) {
                console.log('⚠️  Running database migrations...');
                const migrationProcess = spawn('node', ['scripts/run-migrations.js'], {
                    stdio: 'inherit',
                    env: process.env
                });
                
                await new Promise((resolve, reject) => {
                    migrationProcess.on('close', (code) => {
                        if (code === 0) {
                            console.log('✅ Migrations completed successfully');
                            resolve();
                        } else {
                            reject(new Error(`Migration process exited with code ${code}`));
                        }
                    });
                });
            } else {
                console.log('✅ All migrations already applied, skipping migration step');
            }
        } catch (error) {
            console.log('⚠️  Error checking database schema:', error.message);
            console.log('⚠️  Attempting to run migrations anyway...');
            const migrationProcess = spawn('node', ['scripts/run-migrations.js'], {
                stdio: 'inherit',
                env: process.env
            });
            
            await new Promise((resolve, reject) => {
                migrationProcess.on('close', (code) => {
                    if (code === 0) {
                        console.log('✅ Migrations completed successfully');
                        resolve();
                    } else {
                        reject(new Error(`Database setup failed: ${error.message}`));
                    }
                });
            });
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