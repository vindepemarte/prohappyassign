import express from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import PermissionService, { PERMISSIONS, ROLE_PERMISSIONS } from '../services/permissionService.js';
import { requirePermission, requireRole, addPermissionContext } from '../middleware/permissions.js';

const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

const JWT_SECRET = process.env.JWT_SECRET;

// Verify session token with database check
const verifySession = async (token) => {
  try {
    // First verify JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded) {
      return null;
    }

    // Check if session exists in database and is valid
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const sessionResult = await pool.query(
      `SELECT s.user_id, s.expires_at, u.id, u.email, u.full_name, u.role, 
              u.avatar_url, u.email_verified, u.reference_code_used, u.recruited_by, 
              u.super_agent_id, u.created_at, u.updated_at,
              uh.hierarchy_level, uh.parent_id
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [tokenHash]
    );

    if (sessionResult.rows.length === 0) {
      return null;
    }

    // Update last_used_at
    await pool.query(
      'UPDATE user_sessions SET last_used_at = NOW() WHERE token_hash = $1',
      [tokenHash]
    );

    const row = sessionResult.rows[0];
    return {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      role: row.role,
      avatar_url: row.avatar_url,
      email_verified: row.email_verified,
      reference_code_used: row.reference_code_used,
      recruited_by: row.recruited_by,
      super_agent_id: row.super_agent_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      hierarchy: {
        level: row.hierarchy_level,
        parent_id: row.parent_id
      }
    };
  } catch (error) {
    console.error('Error verifying session:', error);
    return null;
  }
};

// Enhanced middleware to verify JWT token with session validation
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Use async function inside middleware
  (async () => {
    try {
      // Verify session with database check
      const user = await verifySession(token);
      if (!user) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }

      // Add user info to request
      req.userId = user.id;
      req.userRole = user.role;
      req.userHierarchy = user.hierarchy;
      req.user = user;
      
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(403).json({ error: 'Authentication failed' });
    }
  })();
};

// Get current user's permissions
router.get('/my-permissions', authenticateToken, addPermissionContext, (req, res) => {
  try {
    res.json({ data: req.permissions });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Check if user has specific permission
router.post('/check', authenticateToken, (req, res) => {
  try {
    const { permission, permissions } = req.body;

    if (!permission && !permissions) {
      return res.status(400).json({ error: 'Permission or permissions array is required' });
    }

    let result;
    if (permission) {
      result = {
        permission,
        hasPermission: PermissionService.hasPermission(req.userRole, permission)
      };
    } else {
      result = {
        permissions,
        hasAnyPermission: PermissionService.hasAnyPermission(req.userRole, permissions),
        hasAllPermissions: PermissionService.hasAllPermissions(req.userRole, permissions),
        individual: permissions.map(p => ({
          permission: p,
          hasPermission: PermissionService.hasPermission(req.userRole, p)
        }))
      };
    }

    res.json({ data: result });
  } catch (error) {
    console.error('Permission check error:', error);
    res.status(500).json({ error: 'Failed to check permissions' });
  }
});

// Get all available permissions (system info)
router.get('/available', authenticateToken, requireRole(['super_agent']), (req, res) => {
  try {
    const permissionCategories = {
      project: Object.entries(PERMISSIONS)
        .filter(([key]) => key.includes('PROJECT'))
        .map(([key, value]) => ({ key, value, description: key.toLowerCase().replace(/_/g, ' ') })),
      
      user: Object.entries(PERMISSIONS)
        .filter(([key]) => key.includes('USER') || key.includes('MANAGE'))
        .map(([key, value]) => ({ key, value, description: key.toLowerCase().replace(/_/g, ' ') })),
      
      financial: Object.entries(PERMISSIONS)
        .filter(([key]) => key.includes('FINANCIAL') || key.includes('PRICING'))
        .map(([key, value]) => ({ key, value, description: key.toLowerCase().replace(/_/g, ' ') })),
      
      notification: Object.entries(PERMISSIONS)
        .filter(([key]) => key.includes('NOTIFICATION'))
        .map(([key, value]) => ({ key, value, description: key.toLowerCase().replace(/_/g, ' ') })),
      
      system: Object.entries(PERMISSIONS)
        .filter(([key]) => key.includes('SYSTEM') || key.includes('ADMIN') || key.includes('HIERARCHY'))
        .map(([key, value]) => ({ key, value, description: key.toLowerCase().replace(/_/g, ' ') }))
    };

    res.json({ 
      data: {
        categories: permissionCategories,
        all_permissions: PERMISSIONS,
        role_permissions: ROLE_PERMISSIONS
      }
    });
  } catch (error) {
    console.error('Get available permissions error:', error);
    res.status(500).json({ error: 'Failed to fetch available permissions' });
  }
});

// Check project access
router.post('/check-project-access', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const canAccess = await PermissionService.canAccessProject(
      req.userId, 
      req.userRole, 
      parseInt(projectId)
    );

    res.json({ 
      data: {
        projectId: parseInt(projectId),
        canAccess,
        userRole: req.userRole,
        userId: req.userId
      }
    });
  } catch (error) {
    console.error('Check project access error:', error);
    res.status(500).json({ error: 'Failed to check project access' });
  }
});

// Check user access
router.post('/check-user-access', authenticateToken, async (req, res) => {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    const canAccess = await PermissionService.canAccessUser(req.userId, targetUserId);

    res.json({ 
      data: {
        targetUserId,
        canAccess,
        userRole: req.userRole,
        userId: req.userId
      }
    });
  } catch (error) {
    console.error('Check user access error:', error);
    res.status(500).json({ error: 'Failed to check user access' });
  }
});

// Get accessible projects for current user
router.get('/accessible-projects', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const projects = await PermissionService.getAccessibleProjects(req.userId, req.userRole);
    
    // Apply pagination
    const paginatedProjects = projects.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({ 
      data: paginatedProjects,
      pagination: {
        total: projects.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < projects.length
      }
    });
  } catch (error) {
    console.error('Get accessible projects error:', error);
    res.status(500).json({ error: 'Failed to fetch accessible projects' });
  }
});

// Get permission matrix for all roles (super agents only)
router.get('/matrix', authenticateToken, requireRole(['super_agent']), (req, res) => {
  try {
    const matrix = {};
    
    Object.keys(ROLE_PERMISSIONS).forEach(role => {
      matrix[role] = {
        permissions: ROLE_PERMISSIONS[role],
        summary: PermissionService.getPermissionSummary(role)
      };
    });

    res.json({ data: matrix });
  } catch (error) {
    console.error('Get permission matrix error:', error);
    res.status(500).json({ error: 'Failed to fetch permission matrix' });
  }
});

// Test permission endpoint (for debugging)
router.post('/test', authenticateToken, (req, res) => {
  try {
    const { permission, targetUserId, projectId } = req.body;

    const result = {
      user: {
        id: req.userId,
        role: req.userRole,
        hierarchy: req.userHierarchy
      },
      tests: {}
    };

    // Test specific permission
    if (permission) {
      result.tests.permission = {
        permission,
        hasPermission: PermissionService.hasPermission(req.userRole, permission)
      };
    }

    // Test user access
    if (targetUserId) {
      result.tests.userAccess = {
        targetUserId,
        canAccess: 'async_check_required'
      };
    }

    // Test project access
    if (projectId) {
      result.tests.projectAccess = {
        projectId,
        canAccess: 'async_check_required'
      };
    }

    res.json({ data: result });
  } catch (error) {
    console.error('Permission test error:', error);
    res.status(500).json({ error: 'Failed to test permissions' });
  }
});

// Get role hierarchy and permissions overview
router.get('/hierarchy-overview', authenticateToken, requirePermission(PERMISSIONS.VIEW_HIERARCHY), async (req, res) => {
  try {
    // Get hierarchy statistics
    const hierarchyStats = await pool.query(`
      SELECT 
        u.role,
        COUNT(*) as count,
        AVG(uh.hierarchy_level) as avg_level
      FROM users u
      LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
      GROUP BY u.role
      ORDER BY AVG(uh.hierarchy_level)
    `);

    // Get permission distribution
    const permissionDistribution = Object.keys(ROLE_PERMISSIONS).map(role => ({
      role,
      permission_count: ROLE_PERMISSIONS[role].length,
      permissions: ROLE_PERMISSIONS[role]
    }));

    res.json({ 
      data: {
        hierarchy_stats: hierarchyStats.rows,
        permission_distribution: permissionDistribution,
        total_permissions: Object.keys(PERMISSIONS).length,
        total_roles: Object.keys(ROLE_PERMISSIONS).length
      }
    });
  } catch (error) {
    console.error('Get hierarchy overview error:', error);
    res.status(500).json({ error: 'Failed to fetch hierarchy overview' });
  }
});

export default router;