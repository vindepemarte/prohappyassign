#!/usr/bin/env node

/**
 * Production Startup Script
 * This script handles database setup before starting the server
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function setupDatabase() {
    console.log('📋 Setting up database schema...');
    
    try {
        // Read and execute the complete setup SQL
        const setupSqlPath = path.join(__dirname, '..', 'database', 'complete-setup.sql');
        const setupSql = fs.readFileSync(setupSqlPath, 'utf8');
        
        await pool.query(setupSql);
        console.log('✅ Database setup completed successfully');
        return true;
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        return false;
    }
}

async function productionStart() {
    console.log('🚀 Starting production setup...');
    console.log('============================================================');

    try {
        // 1. Test database connection
        console.log('📋 Step 1: Testing database connection...');
        await pool.query('SELECT 1');
        console.log('✅ Database connection successful');

        // 2. Setup database schema
        console.log('📋 Step 2: Setting up database schema...');
        const setupSuccess = await setupDatabase();
        if (!setupSuccess) {
            throw new Error('Database setup failed');
        }

        // 3. Verify Super Agent pricing table
        console.log('📋 Step 3: Verifying pricing data...');
        const pricingCheck = await pool.query('SELECT COUNT(*) FROM super_agent_pricing');
        const pricingCount = parseInt(pricingCheck.rows[0].count);
        
        if (pricingCount >= 40) {
            console.log(`✅ Super Agent pricing table ready (${pricingCount} tiers)`);
        } else {
            console.log(`⚠️  Only ${pricingCount} pricing tiers found, but continuing...`);
        }

        // 4. Check if we need to create initial data
        console.log('📋 Step 4: Checking for existing users...');
        try {
            const userCheck = await pool.query('SELECT COUNT(*) FROM users');
            const userCount = parseInt(userCheck.rows[0].count);
            
            if (userCount === 0) {
                console.log('⚠️  No users found - users will be created when needed');
            } else {
                console.log(`✅ Found ${userCount} existing users`);
            }
        } catch (error) {
            console.log('⚠️  Users table not found - will be created by application');
        }

        // 5. Start the main server
        console.log('📋 Step 5: Starting main server...');
        console.log('============================================================');
        
        // Import and start the server
        await import('../server.js');
        
    } catch (error) {
        console.error('❌ Production startup failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the production startup
productionStart().catch(console.error);