/**
 * Quick Test Script
 * Tests with manually specified database connection
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}
if (fs.existsSync('.env')) {
  dotenv.config();
}

const quickTest = async () => {
  console.log('🚀 Quick Database Test');
  console.log('=' .repeat(30));
  
  // Show current environment
  console.log('Current DATABASE_URL:', process.env.DATABASE_URL || 'NOT SET');
  
  // If DATABASE_URL is not set or wrong, let's try common defaults
  const possibleUrls = [
    process.env.DATABASE_URL,
    'postgresql://postgres:@localhost:5432/postgres',
    'postgresql://postgres:postgres@localhost:5432/postgres',
    'postgresql://vdpm:@localhost:5432/postgres',
    'postgresql://vdpm:vdpm@localhost:5432/postgres'
  ].filter(Boolean);
  
  console.log('\n🔍 Trying database connections...');
  
  for (const url of possibleUrls) {
    try {
      console.log(`\n🔄 Testing: ${url.replace(/:([^:@]+)@/, ':***@')}`);
      
      const pool = new Pool({
        connectionString: url,
        ssl: false,
        connectionTimeoutMillis: 5000
      });
      
      const result = await pool.query('SELECT current_database(), current_user');
      await pool.end();
      
      console.log('✅ SUCCESS!');
      console.log(`   Database: ${result.rows[0].current_database}`);
      console.log(`   User: ${result.rows[0].current_user}`);
      
      // Update .env.local with working URL
      const envContent = `DATABASE_URL=${url}
JWT_SECRET=your-secret-key-for-testing
PORT=3000
NODE_ENV=development
`;
      
      fs.writeFileSync('.env.local', envContent);
      console.log('\n✅ Updated .env.local with working database URL');
      console.log('\n🧪 Now run: node scripts/setup-and-test-local.js');
      
      return true;
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
  
  console.log('\n❌ Could not connect to any database');
  console.log('\n💡 Manual setup required:');
  console.log('1. Make sure PostgreSQL is running');
  console.log('2. Create a database (or use existing "postgres" database)');
  console.log('3. Run: node scripts/setup-env.js');
  
  return false;
};

quickTest();