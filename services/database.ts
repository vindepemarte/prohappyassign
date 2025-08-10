import { Pool, PoolClient } from 'pg';

// Enhanced database connection pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Increased timeout for production
  acquireTimeoutMillis: 60000,
  createTimeoutMillis: 30000,
  destroyTimeoutMillis: 5000,
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 200,
});

// Test database connection
pool.on('connect', (client) => {
  console.log('✅ Connected to PostgreSQL database');
  console.log('🔍 Database connection info:', {
    host: client.host,
    port: client.port,
    database: client.database,
    user: client.user
  });
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  console.error('❌ Database connection details:', {
    host: err.host,
    port: err.port,
    database: err.database
  });
});

// Test initial connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connection test successful:', result.rows[0]);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
};

// Test connection on startup
testConnection();

// Helper function to execute queries
export const query = async (text: string, params?: any[]): Promise<any> => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text: text.substring(0, 50) + '...', duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Helper function to get a client from the pool for transactions
export const getClient = async (): Promise<PoolClient> => {
  return await pool.connect();
};

// Helper function for transactions
export const transaction = async (callback: (client: PoolClient) => Promise<any>) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export { pool };

export default {
  query,
  getClient,
  transaction,
  pool,
  testConnection
};