#!/usr/bin/env node

const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const checkProjectsSchema = async () => {
  try {
    const result = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default 
       FROM information_schema.columns 
       WHERE table_name = 'projects' 
       ORDER BY ordinal_position`
    );
    
    console.log('Projects table columns:');
    result.rows.forEach(col => {
      console.log(`- ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
};

checkProjectsSchema();