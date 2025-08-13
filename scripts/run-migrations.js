#!/usr/bin/env node

/**
 * Database Migration Runner
 * Runs SQL migration files in order
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else if (fs.existsSync('.env')) {
  dotenv.config({ path: '.env' });
}

// Database connection - NO SSL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

// Migration tracking table
const createMigrationsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT NOW()
    );
  `;
  
  try {
    await pool.query(query);
    console.log('✅ Migration tracking table ready');
  } catch (error) {
    console.error('❌ Failed to create migrations table:', error);
    throw error;
  }
};

// Check if migration has been run
const isMigrationExecuted = async (filename) => {
  const query = 'SELECT COUNT(*) FROM schema_migrations WHERE filename = $1';
  const result = await pool.query(query, [filename]);
  return parseInt(result.rows[0].count) > 0;
};

// Record migration execution
const recordMigration = async (filename) => {
  const query = 'INSERT INTO schema_migrations (filename) VALUES ($1)';
  await pool.query(query, [filename]);
};

// Run a single migration file
const runMigration = async (filepath, filename) => {
  console.log(`🔄 Running migration: ${filename}`);
  
  try {
    // Check if already executed
    if (await isMigrationExecuted(filename)) {
      console.log(`⏭️  Skipping ${filename} (already executed)`);
      return;
    }
    
    // Read and execute migration
    const sql = fs.readFileSync(filepath, 'utf8');
    await pool.query(sql);
    
    // Record successful execution
    await recordMigration(filename);
    console.log(`✅ Completed migration: ${filename}`);
    
  } catch (error) {
    console.error(`❌ Failed to run migration ${filename}:`, error);
    throw error;
  }
};

// Main migration runner
const runMigrations = async () => {
  try {
    console.log('🚀 Starting database migrations...');
    
    // Ensure migrations table exists
    await createMigrationsTable();
    
    // Get migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('📁 No migrations directory found');
      return;
    }
    
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Run in alphabetical order
    
    if (files.length === 0) {
      console.log('📄 No migration files found');
      return;
    }
    
    console.log(`📋 Found ${files.length} migration file(s)`);
    
    // Run each migration
    for (const file of files) {
      const filepath = path.join(migrationsDir, file);
      await runMigration(filepath, file);
    }
    
    console.log('🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}

export { runMigrations };