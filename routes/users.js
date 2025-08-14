import express from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { asyncHandler, createValidationError, createPermissionError } from '../middleware/errorHandler.js';
import HierarchyService from '../services/hierarchyService.js';

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
router.get('/by-role/:role', authenticateToken, asyncHandler(async (req, res) => {
  const { role } = req.params;

  const validRoles = ['client', 'worker', 'agent', 'super_worker', 'super_agent'];
  if (!role || !validRoles.includes(role)) {
    throw createValidationError(`Valid role is required (${validRoles.join(', ')})`);
  }

  const users = await HierarchyService.getUsersByRole(role);
  res.json({ data: users });
}));

// Get all users (Super Agent only)
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  // Check if user is Super Agent
  const userInfo = await HierarchyService.getUserInfo(req.userId);
  if (!userInfo || userInfo.role !== 'super_agent') {
    throw createPermissionError('Only Super Agents can access all users');
  }

  const users = await HierarchyService.getAllUsers();
  res.json({ data: users });
}));

// Get current user info
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  const userInfo = await HierarchyService.getUserHierarchyInfo(req.userId);
  if (!userInfo) {
    throw createNotFoundError('User');
  }
  
  res.json({ data: userInfo });
}));

export default router;