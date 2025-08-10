import express from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

// Debug environment variables (remove in production)
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET environment variable is not set!');
}
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set!');
}

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Helper functions
const hashPassword = async (password) => {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
};

const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, role = 'client' } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ 
        error: 'Email, password, and full name are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters long' 
      });
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert user
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, email_verified) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, full_name, role, avatar_url, email_verified, created_at, updated_at`,
      [email.toLowerCase(), passwordHash, full_name, role, true]
    );

    const user = userResult.rows[0];

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Registration failed' 
    });
  }
});

// Test route to verify auth routing is working
router.get('/test', (req, res) => {
  console.log('🧪 Auth test route hit');
  res.json({ message: 'Auth routes are working', timestamp: new Date().toISOString() });
});

// Login user
router.post('/login', async (req, res) => {
  try {
    console.log('🔐 Login attempt for:', req.body.email);
    console.log('🔍 Request method:', req.method);
    console.log('🔍 Request headers:', req.headers);
    
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Get user by email
    const userResult = await pool.query(
      'SELECT id, email, password_hash, full_name, role, avatar_url, email_verified, created_at, updated_at FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user.id);

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Login failed' 
    });
  }
});

// Get current user profile
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    // Verify JWT token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user from database
    const userResult = await pool.query(
      'SELECT id, email, full_name, role, avatar_url, email_verified, created_at, updated_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({ user: userResult.rows[0] });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(401).json({ 
      error: 'Invalid or expired token' 
    });
  }
});

// Logout user (optional - mainly clears server-side sessions if implemented)
router.post('/logout', async (req, res) => {
  try {
    // For now, just return success since we're using stateless JWT
    // In the future, we could implement token blacklisting
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Search users endpoint
router.get('/users/search', authenticateToken, async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    
    if (!searchTerm || searchTerm.length < 2) {
      return res.json({ data: [] });
    }

    const result = await pool.query(
      `SELECT id, full_name, email, role 
       FROM users 
       WHERE full_name ILIKE $1 OR email ILIKE $1 OR id::text ILIKE $1
       ORDER BY full_name
       LIMIT 10`,
      [`%${searchTerm}%`]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Catch-all handler for unmatched auth routes
router.use('*', (req, res) => {
  console.log(`❌ Unmatched auth route: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Auth endpoint not found',
    method: req.method,
    path: req.originalUrl
  });
});

export default router;