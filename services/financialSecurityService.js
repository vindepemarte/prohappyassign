/**
 * Financial Data Security Service
 * Handles role-based financial data filtering and access control
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Financial data access levels by role
const FINANCIAL_ACCESS_LEVELS = {
  super_agent: {
    canViewAllFinancials: true,
    canViewProfitData: true,
    canViewPaymentDistribution: true,
    canViewAgentFees: true,
    canViewWorkerPayments: true,
    canViewClientPricing: true,
    canModifyPricing: true,
    canViewSystemProfits: true
  },
  agent: {
    canViewAllFinancials: false,
    canViewProfitData: false, // Only their own fees
    canViewPaymentDistribution: false,
    canViewAgentFees: true, // Only their own
    canViewWorkerPayments: false,
    canViewClientPricing: true, // Only their clients
    canModifyPricing: true, // Only their own rates
    canViewSystemProfits: false
  },
  super_worker: {
    canViewAllFinancials: false,
    canViewProfitData: false,
    canViewPaymentDistribution: true, // For project assignments
    canViewAgentFees: false,
    canViewWorkerPayments: true, // For assignments
    canViewClientPricing: false,
    canModifyPricing: false,
    canViewSystemProfits: false
  },
  worker: {
    canViewAllFinancials: false,
    canViewProfitData: false,
    canViewPaymentDistribution: false,
    canViewAgentFees: false,
    canViewWorkerPayments: false,
    canViewClientPricing: false,
    canModifyPricing: false,
    canViewSystemProfits: false
  },
  client: {
    canViewAllFinancials: false,
    canViewProfitData: false,
    canViewPaymentDistribution: false,
    canViewAgentFees: false,
    canViewWorkerPayments: false,
    canViewClientPricing: true, // Only their own projects
    canModifyPricing: false,
    canViewSystemProfits: false
  }
};

/**
 * Get financial access permissions for a user role
 */
export const getFinancialPermissions = (userRole) => {
  return FINANCIAL_ACCESS_LEVELS[userRole] || FINANCIAL_ACCESS_LEVELS.worker;
};

/**
 * Check if user has permission to access specific financial data
 */
export const hasFinancialPermission = (userRole, permission) => {
  const permissions = getFinancialPermissions(userRole);
  return permissions[permission] || false;
};

/**
 * Filter project data based on user role and financial permissions
 */
export const filterProjectFinancialData = (projects, userRole, userId) => {
  const permissions = getFinancialPermissions(userRole);
  
  return projects.map(project => {
    const filteredProject = { ...project };
    
    // Remove all financial data for workers
    if (userRole === 'worker') {
      delete filteredProject.total_cost;
      delete filteredProject.agent_fee;
      delete filteredProject.worker_payment;
      delete filteredProject.profit_margin;
      delete filteredProject.pricing_breakdown;
      delete filteredProject.payment_status;
      delete filteredProject.amount_paid;
      delete filteredProject.amount_due;
    }
    
    // Filter financial data for agents (only their own projects)
    else if (userRole === 'agent') {
      if (project.agent_id !== userId && project.sub_agent_id !== userId) {
        // Not their project - remove all financial data
        delete filteredProject.total_cost;
        delete filteredProject.agent_fee;
        delete filteredProject.worker_payment;
        delete filteredProject.profit_margin;
        delete filteredProject.pricing_breakdown;
      }
      // Always remove system-level profit data
      delete filteredProject.system_profit;
      delete filteredProject.super_agent_share;
    }
    
    // Filter financial data for super workers
    else if (userRole === 'super_worker') {
      // Keep worker payment info for assignment purposes
      // Remove profit margins and agent fees
      delete filteredProject.agent_fee;
      delete filteredProject.profit_margin;
      delete filteredProject.system_profit;
      delete filteredProject.super_agent_share;
    }
    
    // Filter financial data for clients
    else if (userRole === 'client') {
      if (project.client_id !== userId) {
        // Not their project - remove all financial data
        delete filteredProject.total_cost;
        delete filteredProject.agent_fee;
        delete filteredProject.worker_payment;
        delete filteredProject.profit_margin;
        delete filteredProject.pricing_breakdown;
      } else {
        // Their project - keep pricing info but remove internal costs
        delete filteredProject.agent_fee;
        delete filteredProject.worker_payment;
        delete filteredProject.profit_margin;
        delete filteredProject.system_profit;
        delete filteredProject.super_agent_share;
      }
    }
    
    // Super agents see everything (no filtering)
    
    return filteredProject;
  });
};

/**
 * Filter user data based on financial permissions
 */
export const filterUserFinancialData = (users, viewerRole, viewerId) => {
  const permissions = getFinancialPermissions(viewerRole);
  
  return users.map(user => {
    const filteredUser = { ...user };
    
    // Remove financial data based on permissions
    if (!permissions.canViewAgentFees) {
      delete filteredUser.agent_fee_percentage;
      delete filteredUser.total_earnings;
      delete filteredUser.pending_payments;
    }
    
    if (!permissions.canViewWorkerPayments) {
      delete filteredUser.worker_payments;
      delete filteredUser.completed_projects_value;
    }
    
    // Agents can only see their own financial data
    if (viewerRole === 'agent' && user.id !== viewerId) {
      delete filteredUser.agent_fee_percentage;
      delete filteredUser.total_earnings;
      delete filteredUser.pending_payments;
    }
    
    return filteredUser;
  });
};

/**
 * Create audit log entry for financial data access
 */
export const logFinancialDataAccess = async (userId, userRole, accessType, resourceId, resourceType, success = true, errorMessage = null) => {
  try {
    await pool.query(
      `INSERT INTO financial_access_audit (
        user_id, user_role, access_type, resource_id, resource_type, 
        success, error_message, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [userId, userRole, accessType, resourceId, resourceType, success, errorMessage, null, null]
    );
  } catch (error) {
    console.error('Failed to log financial data access:', error);
  }
};

/**
 * Validate financial data access and log attempt
 */
export const validateFinancialAccess = async (userId, userRole, permission, resourceId = null, resourceType = null) => {
  const hasPermission = hasFinancialPermission(userRole, permission);
  
  // Log the access attempt
  await logFinancialDataAccess(
    userId, 
    userRole, 
    permission, 
    resourceId, 
    resourceType, 
    hasPermission,
    hasPermission ? null : 'Access denied - insufficient permissions'
  );
  
  return hasPermission;
};

/**
 * Get financial summary based on user role and permissions
 */
export const getFinancialSummary = async (userId, userRole) => {
  const permissions = getFinancialPermissions(userRole);
  
  try {
    let query = '';
    let params = [];
    
    if (userRole === 'super_agent') {
      // Super agents see everything
      query = `
        SELECT 
          COUNT(*) as total_projects,
          SUM(total_cost) as total_revenue,
          SUM(agent_fee) as total_agent_fees,
          SUM(worker_payment) as total_worker_payments,
          SUM(total_cost - agent_fee - worker_payment) as total_profit
        FROM projects 
        WHERE status != 'cancelled'
      `;
    } else if (userRole === 'agent') {
      // Agents see only their projects
      query = `
        SELECT 
          COUNT(*) as total_projects,
          SUM(total_cost) as total_revenue,
          SUM(agent_fee) as my_fees,
          0 as total_worker_payments,
          0 as total_profit
        FROM projects 
        WHERE (agent_id = $1 OR sub_agent_id = $1) AND status != 'cancelled'
      `;
      params = [userId];
    } else if (userRole === 'super_worker') {
      // Super workers see assignment-related data
      query = `
        SELECT 
          COUNT(*) as total_projects,
          0 as total_revenue,
          0 as my_fees,
          SUM(worker_payment) as worker_payments,
          0 as total_profit
        FROM projects 
        WHERE sub_worker_id = $1 AND status != 'cancelled'
      `;
      params = [userId];
    } else if (userRole === 'client') {
      // Clients see their project costs
      query = `
        SELECT 
          COUNT(*) as total_projects,
          SUM(total_cost) as my_total_cost,
          0 as my_fees,
          0 as worker_payments,
          0 as total_profit
        FROM projects 
        WHERE client_id = $1 AND status != 'cancelled'
      `;
      params = [userId];
    } else {
      // Workers see nothing
      return {
        total_projects: 0,
        message: 'Financial data not available for your role'
      };
    }
    
    const result = await pool.query(query, params);
    
    // Log the access
    await logFinancialDataAccess(userId, userRole, 'financial_summary', null, 'summary', true);
    
    return result.rows[0];
    
  } catch (error) {
    console.error('Error getting financial summary:', error);
    await logFinancialDataAccess(userId, userRole, 'financial_summary', null, 'summary', false, error.message);
    throw error;
  }
};

/**
 * Get financial access audit logs (Super Agent only)
 */
export const getFinancialAccessAudit = async (userId, userRole, limit = 100) => {
  if (userRole !== 'super_agent') {
    await logFinancialDataAccess(userId, userRole, 'audit_log_access', null, 'audit', false, 'Unauthorized access attempt');
    throw new Error('Unauthorized: Only Super Agents can access audit logs');
  }
  
  try {
    const result = await pool.query(
      `SELECT 
        faa.*,
        u.full_name,
        u.email
      FROM financial_access_audit faa
      JOIN users u ON faa.user_id = u.id
      ORDER BY faa.created_at DESC
      LIMIT $1`,
      [limit]
    );
    
    await logFinancialDataAccess(userId, userRole, 'audit_log_access', null, 'audit', true);
    
    return result.rows;
  } catch (error) {
    console.error('Error getting financial access audit:', error);
    await logFinancialDataAccess(userId, userRole, 'audit_log_access', null, 'audit', false, error.message);
    throw error;
  }
};

export default {
  getFinancialPermissions,
  hasFinancialPermission,
  filterProjectFinancialData,
  filterUserFinancialData,
  logFinancialDataAccess,
  validateFinancialAccess,
  getFinancialSummary,
  getFinancialAccessAudit
};