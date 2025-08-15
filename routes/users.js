import express from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Get users by IDs
router.post('/by-ids', authenticateToken, async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds array is required' });
    }

    const placeholders = userIds.map((_, index) => `$${index + 1}`).join(', ');
    const result = await pool.query(
      `SELECT id, full_name, email, role FROM users WHERE id IN (${placeholders})`,
      userIds
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get users by IDs error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get users by role
router.get('/by-role/:role', authenticateToken, async (req, res) => {
  try {
    const { role } = req.params;

    if (!role || !['client', 'worker', 'agent', 'super_agent', 'super_worker'].includes(role)) {
      return res.status(400).json({ error: 'Valid role is required (client, worker, agent, super_agent, super_worker)' });
    }

    const result = await pool.query(
      'SELECT id, full_name, email, role FROM users WHERE role = $1',
      [role]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get users by role error:', error);
    res.status(500).json({ error: 'Failed to fetch users by role' });
  }
});

// Get all users (for super_agent broadcast notifications)
router.get('/all', authenticateToken, async (req, res) => {
  try {
    // Check if user has permission to get all users (super_agent only)
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [req.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userRole = userResult.rows[0].role;
    if (userRole !== 'super_agent') {
      return res.status(403).json({ error: 'Only super agents can access all users' });
    }

    const result = await pool.query(
      'SELECT id, full_name, email, role FROM users ORDER BY created_at DESC'
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to fetch all users' });
  }
});

export default router;