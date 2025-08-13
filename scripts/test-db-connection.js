#!/usr/bin/env node

/**
 * Database Connection Test
 * Tests database connectivity and readiness for migrations
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else if (fs.existsSync('.env')) {
  dotenv.config({ path: '.env' });
}

console.log('🔧 Using DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const testConnection = async () => {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Query execution successful');
    console.log('📅 Current time:', result.rows[0].current_time);
    console.log('🐘 PostgreSQL version:', result.rows[0].pg_version.split(' ')[0]);
    
    // Check if users table exists (should exist in current system)
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ Users table exists');
      
      // Check current user roles
      const roleCheck = await client.query('SELECT role, COUNT(*) as count FROM users GROUP BY role');
      console.log('👥 Current user roles:');
      roleCheck.rows.forEach(row => {
        console.log(`   - ${row.role}: ${row.count} users`);
      });
    } else {
      console.log('⚠️  Users table does not exist - this might be a fresh database');
    }
    
    // Check if migration tracking table exists
    const migrationTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_migrations'
      );
    `);
    
    if (migrationTableCheck.rows[0].exists) {
      const migrationCount = await client.query('SELECT COUNT(*) as count FROM schema_migrations');
      console.log(`📋 Migration tracking table exists with ${migrationCount.rows[0].count} recorded migrations`);
    } else {
      console.log('📋 Migration tracking table does not exist (will be created during migration)');
    }
    
    client.release();
    console.log('🎉 Database is ready for migrations!');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.error('💡 Hint: Check if DATABASE_URL is set correctly');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('💡 Hint: Check if PostgreSQL server is running');
    } else if (error.code === '28P01') {
      console.error('💡 Hint: Check database credentials');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  testConnection();
}

export { testConnection };