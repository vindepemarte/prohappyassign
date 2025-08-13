import PermissionService from '../services/permissionService.js';

/**
 * Middleware to check if user has required permission
 */
export const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      // Check if user info is already set by auth middleware
      let userRole = req.userRole;
      
      // If not set, try to get user role from database
      if (!userRole && req.userId) {
        const { Pool } = await import('pg');
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        });
        
        const result = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
        if (result.rows.length > 0) {
          userRole = result.rows[0].role;
          req.userRole = userRole;
        }
      }
      
      if (!userRole) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      PermissionService.validatePermission(userRole, permission);
      next();
    } catch (error) {
      if (error.code === 'INSUFFICIENT_PERMISSIONS') {
        return res.status(403).json({ 
          error: error.message,
          required_permission: permission,
          user_role: req.userRole
        });
      }
      
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

/**
 * Middleware to check if user has any of the required permissions
 */
export const requireAnyPermission = (permissions) => {
  return (req, res, next) => {
    try {
      if (!req.user || !req.userRole) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      PermissionService.validateAnyPermission(req.userRole, permissions);
      next();
    } catch (error) {
      if (error.code === 'INSUFFICIENT_PERMISSIONS') {
        return res.status(403).json({ 
          error: error.message,
          required_permissions: permissions,
          user_role: req.userRole
        });
      }
      
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

/**
 * Middleware to check if user can access a specific project
 */
export const requireProjectAccess = async (req, res, next) => {
  try {
    if (!req.user || !req.userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const projectId = req.params.projectId || req.params.id || req.body.projectId;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const canAccess = await PermissionService.canAccessProject(
      req.userId, 
      req.userRole, 
      parseInt(projectId)
    );

    if (!canAccess) {
      return res.status(403).json({ 
        error: 'Access denied to this project',
        project_id: projectId,
        user_role: req.userRole
      });
    }

    req.projectId = parseInt(projectId);
    next();
  } catch (error) {
    console.error('Project access check error:', error);
    return res.status(500).json({ error: 'Project access check failed' });
  }
};

/**
 * Middleware to check if user can access another user's data
 */
export const requireUserAccess = async (req, res, next) => {
  try {
    if (!req.user || !req.userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const targetUserId = req.params.userId || req.params.id || req.body.userId;
    
    if (!targetUserId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const canAccess = await PermissionService.canAccessUser(req.userId, targetUserId);

    if (!canAccess) {
      return res.status(403).json({ 
        error: 'Access denied to this user',
        target_user_id: targetUserId,
        user_role: req.userRole
      });
    }

    req.targetUserId = targetUserId;
    next();
  } catch (error) {
    console.error('User access check error:', error);
    return res.status(500).json({ error: 'User access check failed' });
  }
};

/**
 * Middleware to check role-based access
 */
export const requireRole = (roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req, res, next) => {
    if (!req.user || !req.userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ 
        error: 'Insufficient role permissions',
        required_roles: allowedRoles,
        user_role: req.userRole
      });
    }

    next();
  };
};

/**
 * Middleware to add permission context to request
 */
export const addPermissionContext = (req, res, next) => {
  if (req.user && req.userRole) {
    req.permissions = PermissionService.getPermissionSummary(req.userRole);
  }
  next();
};

export default {
  requirePermission,
  requireAnyPermission,
  requireProjectAccess,
  requireUserAccess,
  requireRole,
  addPermissionContext
};