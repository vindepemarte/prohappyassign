import express from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
// Use local authenticateTokenLocal function
const authenticateTokenLocal = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
import { requirePermission, requireRole, requireUserAccess } from '../middleware/permissions.js';
import { PERMISSIONS } from '../services/permissionService.js';

const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

const JWT_SECRET = process.env.JWT_SECRET;

// Using local authenticateTokenLocal function

// Get current user's role and hierarchy info
const getUserInfo = async (userId) => {
  const result = await pool.query(
    `SELECT u.role, uh.hierarchy_level, uh.parent_id, uh.super_agent_id
     FROM users u
     LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
     WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] || null;
};

// Get user's hierarchy information
router.get('/my-hierarchy', authenticateTokenLocal, async (req, res) => {
  try {
    const { default: HierarchyService } = await import('../services/hierarchyService.js');
    const hierarchyInfo = await HierarchyService.getUserHierarchyInfo(req.userId);

    if (!hierarchyInfo) {
      return res.status(404).json({ error: 'Hierarchy information not found' });
    }

    res.json({ data: hierarchyInfo });
  } catch (error) {
    console.error('Get hierarchy info error:', error);
    res.status(500).json({ error: 'Failed to fetch hierarchy information' });
  }
});

// Get user's network (subordinates)
router.get('/my-network', authenticateTokenLocal, async (req, res) => {
  try {
    const { default: HierarchyService } = await import('../services/hierarchyService.js');
    const network = await HierarchyService.getUserNetwork(req.userId);

    res.json({ data: network });
  } catch (error) {
    console.error('Get network error:', error);
    res.status(500).json({ error: 'Failed to fetch user network' });
  }
});

// Get hierarchy path (from user up to super agent)
router.get('/my-path', authenticateTokenLocal, async (req, res) => {
  try {
    const { default: HierarchyService } = await import('../services/hierarchyService.js');
    const path = await HierarchyService.getHierarchyPath(req.userId);

    res.json({ data: path });
  } catch (error) {
    console.error('Get hierarchy path error:', error);
    res.status(500).json({ error: 'Failed to fetch hierarchy path' });
  }
});

// Get hierarchy statistics
router.get('/my-stats', authenticateTokenLocal, async (req, res) => {
  try {
    const { default: HierarchyService } = await import('../services/hierarchyService.js');
    const stats = await HierarchyService.getHierarchyStats(req.userId);

    res.json({ data: stats });
  } catch (error) {
    console.error('Get hierarchy stats error:', error);
    res.status(500).json({ error: 'Failed to fetch hierarchy statistics' });
  }
});

// Get super agent's full network (super agents only)
router.get('/super-agent-network', authenticateTokenLocal, requireRole(['super_agent']), async (req, res) => {
  try {
    // Get all users in the super agent's network
    const networkResult = await pool.query(`
      SELECT 
        u.id, u.full_name, u.email, u.role, u.created_at,
        uh.hierarchy_level, uh.parent_id,
        parent.full_name as parent_name
      FROM users u
      LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
      LEFT JOIN users parent ON uh.parent_id = parent.id
      WHERE uh.super_agent_id = $1 OR u.id = $1
      ORDER BY uh.hierarchy_level, u.full_name
    `, [req.userId]);

    res.json({ data: networkResult.rows });
  } catch (error) {
    console.error('Get super agent network error:', error);
    res.status(500).json({ error: 'Failed to fetch super agent network' });
  }
});

// Update user hierarchy (reassign user to new parent)
router.patch('/reassign-user', authenticateTokenLocal, requirePermission(PERMISSIONS.REASSIGN_USERS), async (req, res) => {
  try {
    const { userId, newParentId } = req.body;

    if (!userId || !newParentId) {
      return res.status(400).json({ error: 'User ID and new parent ID are required' });
    }

    const { default: HierarchyService } = await import('../services/hierarchyService.js');
    const updatedHierarchy = await HierarchyService.updateUserHierarchy(userId, newParentId, req.userId);

    res.json({
      message: 'User hierarchy updated successfully',
      data: updatedHierarchy
    });
  } catch (error) {
    console.error('Update hierarchy error:', error);
    
    if (error.message.includes('Insufficient permissions')) {
      return res.status(403).json({ error: error.message });
    }
    
    if (error.message.includes('circular') || error.message.includes('parent')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to update user hierarchy' });
  }
});

// Check if user can access another user's data
router.post('/check-access', authenticateTokenLocal, async (req, res) => {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    const { default: HierarchyService } = await import('../services/hierarchyService.js');
    const canAccess = await HierarchyService.canAccessUser(req.userId, targetUserId);

    res.json({ canAccess });
  } catch (error) {
    console.error('Check access error:', error);
    res.status(500).json({ error: 'Failed to check user access' });
  }
});

// Get user details by ID (with access control)
router.get('/user/:userId', authenticateTokenLocal, requireUserAccess, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user details with hierarchy info
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.avatar_url, 
              u.email_verified, u.created_at, u.updated_at,
              uh.hierarchy_level, uh.parent_id, uh.super_agent_id,
              parent.full_name as parent_name,
              super_agent.full_name as super_agent_name
       FROM users u
       LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
       LEFT JOIN users parent ON uh.parent_id = parent.id
       LEFT JOIN users super_agent ON uh.super_agent_id = super_agent.id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Search users in hierarchy (with access control)
router.get('/search-users', authenticateTokenLocal, async (req, res) => {
  try {
    const { q: searchTerm, role, limit = 10 } = req.query;

    if (!searchTerm || searchTerm.length < 2) {
      return res.json({ data: [] });
    }

    const userInfo = await getUserInfo(req.userId);
    
    let whereClause = '';
    let params = [`%${searchTerm}%`, parseInt(limit)];

    // Apply access control based on user role
    if (userInfo.role === 'super_agent') {
      // Super agents can search their entire network
      whereClause = 'AND (uh.super_agent_id = $3 OR u.id = $3)';
      params.push(req.userId);
    } else if (['agent', 'super_worker'].includes(userInfo.role)) {
      // Agents and super workers can search their direct subordinates
      whereClause = 'AND uh.parent_id = $3';
      params.push(req.userId);
    } else {
      // Other roles can only search themselves
      whereClause = 'AND u.id = $3';
      params.push(req.userId);
    }

    // Add role filter if specified
    if (role && ['client', 'worker', 'agent', 'super_agent', 'super_worker'].includes(role)) {
      whereClause += ' AND u.role = $' + (params.length + 1);
      params.push(role);
    }

    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role, uh.hierarchy_level,
              parent.full_name as parent_name
       FROM users u
       LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
       LEFT JOIN users parent ON uh.parent_id = parent.id
       WHERE (u.full_name ILIKE $1 OR u.email ILIKE $1 OR u.id::text ILIKE $1)
       ${whereClause}
       ORDER BY u.full_name
       LIMIT $2`,
      params
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Validate hierarchy integrity (super agents only)
router.get('/validate-integrity', authenticateTokenLocal, requirePermission(PERMISSIONS.SYSTEM_ADMIN), async (req, res) => {
  try {

    const { default: HierarchyService } = await import('../services/hierarchyService.js');
    const validation = await HierarchyService.validateHierarchyIntegrity();

    res.json({ data: validation });
  } catch (error) {
    console.error('Validate hierarchy integrity error:', error);
    res.status(500).json({ error: 'Failed to validate hierarchy integrity' });
  }
});

// Get hierarchy overview (super agents only)
router.get('/overview', authenticateTokenLocal, requirePermission(PERMISSIONS.VIEW_ANALYTICS), async (req, res) => {
  try {

    // Get hierarchy overview statistics
    const result = await pool.query(
      `SELECT 
         u.role,
         COUNT(*) as count,
         COUNT(CASE WHEN u.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_count
       FROM users u
       JOIN user_hierarchy uh ON u.id = uh.user_id
       WHERE uh.super_agent_id = $1
       GROUP BY u.role
       ORDER BY 
         CASE u.role 
           WHEN 'super_agent' THEN 1
           WHEN 'agent' THEN 2
           WHEN 'super_worker' THEN 3
           WHEN 'client' THEN 4
           WHEN 'worker' THEN 5
         END`,
      [req.userId]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get hierarchy overview error:', error);
    res.status(500).json({ error: 'Failed to fetch hierarchy overview' });
  }
});

// Get user's direct subordinates
router.get('/my-subordinates', authenticateTokenLocal, requirePermission(PERMISSIONS.VIEW_HIERARCHY), async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.avatar_url, u.created_at,
              uh.hierarchy_level, uh.parent_id
       FROM users u
       JOIN user_hierarchy uh ON u.id = uh.user_id
       WHERE uh.parent_id = $1
       ORDER BY u.full_name ASC`,
      [userId]
    );

    const subordinates = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      role: row.role,
      avatar_url: row.avatar_url,
      created_at: row.created_at,
      hierarchy_level: row.hierarchy_level,
      parent_id: row.parent_id
    }));

    res.json({
      success: true,
      data: subordinates
    });
  } catch (error) {
    console.error('Error fetching subordinates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subordinates'
    });
  }
});

export default router;