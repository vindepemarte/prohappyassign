import express from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import financialSecurityService from '../services/financialSecurityService.js';

const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to verify JWT token and get user info
const authenticateToken = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user details including role
    const userResult = await pool.query('SELECT id, role, full_name FROM users WHERE id = $1', [decoded.userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = userResult.rows[0];
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Get financial permissions for current user
router.get('/permissions', authenticateToken, async (req, res) => {
  try {
    const permissions = financialSecurityService.getFinancialPermissions(req.user.role);
    
    await financialSecurityService.logFinancialDataAccess(
      req.userId, 
      req.user.role, 
      'permissions_check', 
      null, 
      'permissions', 
      true
    );
    
    res.json({
      data: {
        role: req.user.role,
        permissions,
        accessLevel: permissions.canViewAllFinancials ? 'full' : 
                    permissions.canViewAgentFees ? 'limited' : 'none'
      }
    });
  } catch (error) {
    console.error('Get financial permissions error:', error);
    res.status(500).json({ error: 'Failed to get financial permissions' });
  }
});

// Get financial summary with role-based filtering
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const summary = await financialSecurityService.getFinancialSummary(req.userId, req.user.role);
    
    res.json({
      data: summary
    });
  } catch (error) {
    console.error('Get financial summary error:', error);
    res.status(500).json({ error: 'Failed to get financial summary' });
  }
});

// Get projects with financial data filtering
router.get('/projects', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    // Validate financial access
    const hasAccess = await financialSecurityService.validateFinancialAccess(
      req.userId, 
      req.user.role, 
      'canViewClientPricing', 
      null, 
      'projects'
    );
    
    if (!hasAccess && req.user.role === 'worker') {
      return res.status(403).json({ 
        error: 'Access denied: Workers cannot access financial project data' 
      });
    }
    
    let query = `
      SELECT 
        p.*,
        u.full_name as client_name,
        agent.full_name as agent_name,
        worker.full_name as worker_name
      FROM projects p
      LEFT JOIN users u ON p.client_id = u.id
      LEFT JOIN users agent ON p.agent_id = agent.id
      LEFT JOIN users worker ON p.worker_id = worker.id
    `;
    
    const params = [];
    let whereConditions = [];
    
    // Apply role-based filtering
    if (req.user.role === 'agent') {
      whereConditions.push('(p.agent_id = $1 OR p.sub_agent_id = $1)');
      params.push(req.userId);
    } else if (req.user.role === 'super_worker') {
      whereConditions.push('p.sub_worker_id = $1');
      params.push(req.userId);
    } else if (req.user.role === 'client') {
      whereConditions.push('p.client_id = $1');
      params.push(req.userId);
    } else if (req.user.role === 'worker') {
      whereConditions.push('(p.worker_id = $1 OR p.sub_worker_id = $1)');
      params.push(req.userId);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' ORDER BY p.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Filter financial data based on role
    const filteredProjects = financialSecurityService.filterProjectFinancialData(
      result.rows, 
      req.user.role, 
      req.userId
    );
    
    res.json({
      data: filteredProjects,
      pagination: {
        limit,
        offset,
        total: result.rows.length
      }
    });
  } catch (error) {
    console.error('Get financial projects error:', error);
    res.status(500).json({ error: 'Failed to get financial project data' });
  }
});

// Get users with financial data filtering
router.get('/users', authenticateToken, async (req, res) => {
  try {
    // Only Super Agents and Agents can access user financial data
    if (!['super_agent', 'agent'].includes(req.user.role)) {
      await financialSecurityService.logFinancialDataAccess(
        req.userId, 
        req.user.role, 
        'user_financial_data', 
        null, 
        'users', 
        false, 
        'Unauthorized role'
      );
      return res.status(403).json({ 
        error: 'Access denied: Insufficient permissions to view user financial data' 
      });
    }
    
    const limit = parseInt(req.query.limit) || 50;
    
    let query = `
      SELECT 
        u.id, u.full_name, u.email, u.role,
        COUNT(p.id) as project_count,
        SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed_projects,
        SUM(p.total_cost) as total_revenue,
        SUM(p.agent_fee) as total_agent_fees,
        SUM(p.worker_payment) as total_worker_payments
      FROM users u
      LEFT JOIN projects p ON (
        u.role = 'client' AND p.client_id = u.id OR
        u.role IN ('agent', 'super_agent') AND (p.agent_id = u.id OR p.sub_agent_id = u.id) OR
        u.role IN ('worker', 'super_worker') AND (p.worker_id = u.id OR p.sub_worker_id = u.id)
      )
    `;
    
    const params = [];
    
    // Agents can only see their own clients and subordinates
    if (req.user.role === 'agent') {
      query += ` WHERE u.id IN (
        SELECT DISTINCT client_id FROM projects WHERE agent_id = $1 OR sub_agent_id = $1
        UNION
        SELECT $1
      )`;
      params.push(req.userId);
    }
    
    query += ` GROUP BY u.id, u.full_name, u.email, u.role ORDER BY u.full_name LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const result = await pool.query(query, params);
    
    // Filter financial data based on role
    const filteredUsers = financialSecurityService.filterUserFinancialData(
      result.rows, 
      req.user.role, 
      req.userId
    );
    
    await financialSecurityService.logFinancialDataAccess(
      req.userId, 
      req.user.role, 
      'user_financial_data', 
      null, 
      'users', 
      true
    );
    
    res.json({
      data: filteredUsers
    });
  } catch (error) {
    console.error('Get users financial data error:', error);
    res.status(500).json({ error: 'Failed to get user financial data' });
  }
});

// Get financial access audit logs (Super Agent only)
router.get('/audit', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const auditLogs = await financialSecurityService.getFinancialAccessAudit(req.userId, req.user.role, limit);
    
    res.json({
      data: auditLogs
    });
  } catch (error) {
    console.error('Get financial audit error:', error);
    if (error.message.includes('Unauthorized')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to get financial audit logs' });
    }
  }
});

// Validate specific financial access
router.post('/validate-access', authenticateToken, async (req, res) => {
  try {
    const { permission, resourceId, resourceType } = req.body;
    
    const hasAccess = await financialSecurityService.validateFinancialAccess(
      req.userId, 
      req.user.role, 
      permission, 
      resourceId, 
      resourceType
    );
    
    res.json({
      data: {
        hasAccess,
        permission,
        role: req.user.role,
        resourceId,
        resourceType
      }
    });
  } catch (error) {
    console.error('Validate financial access error:', error);
    res.status(500).json({ error: 'Failed to validate financial access' });
  }
});

// Get financial data for specific project (with role-based filtering)
router.get('/projects/:projectId', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const result = await pool.query(
      `SELECT 
        p.*,
        u.full_name as client_name,
        agent.full_name as agent_name,
        worker.full_name as worker_name
      FROM projects p
      LEFT JOIN users u ON p.client_id = u.id
      LEFT JOIN users agent ON p.agent_id = agent.id
      LEFT JOIN users worker ON p.worker_id = worker.id
      WHERE p.id = $1`,
      [projectId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = result.rows[0];
    
    // Check if user has access to this project
    let hasAccess = false;
    
    if (req.user.role === 'super_agent') {
      hasAccess = true;
    } else if (req.user.role === 'agent') {
      hasAccess = project.agent_id === req.userId || project.sub_agent_id === req.userId;
    } else if (req.user.role === 'super_worker') {
      hasAccess = project.sub_worker_id === req.userId;
    } else if (req.user.role === 'worker') {
      hasAccess = project.worker_id === req.userId || project.sub_worker_id === req.userId;
    } else if (req.user.role === 'client') {
      hasAccess = project.client_id === req.userId;
    }
    
    if (!hasAccess) {
      await financialSecurityService.logFinancialDataAccess(
        req.userId, 
        req.user.role, 
        'project_financial_data', 
        projectId, 
        'project', 
        false, 
        'Access denied - not authorized for this project'
      );
      return res.status(403).json({ error: 'Access denied: Not authorized to view this project' });
    }
    
    // Filter financial data based on role
    const filteredProjects = financialSecurityService.filterProjectFinancialData(
      [project], 
      req.user.role, 
      req.userId
    );
    
    await financialSecurityService.logFinancialDataAccess(
      req.userId, 
      req.user.role, 
      'project_financial_data', 
      projectId, 
      'project', 
      true
    );
    
    res.json({
      data: filteredProjects[0]
    });
  } catch (error) {
    console.error('Get project financial data error:', error);
    res.status(500).json({ error: 'Failed to get project financial data' });
  }
});

export default router;