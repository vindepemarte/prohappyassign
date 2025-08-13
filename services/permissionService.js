import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Helper function to execute queries
const query = async (text, params) => {
  const res = await pool.query(text, params);
  return res;
};

// Permission definitions
export const PERMISSIONS = {
  // Project permissions
  VIEW_ALL_PROJECTS: 'view_all_projects',
  VIEW_OWN_PROJECTS: 'view_own_projects',
  VIEW_ASSIGNED_PROJECTS: 'view_assigned_projects',
  CHANGE_PROJECT_STATUS: 'change_project_status',
  CREATE_PROJECTS: 'create_projects',
  ASSIGN_PROJECTS: 'assign_projects',
  
  // User management permissions
  MANAGE_AGENTS: 'manage_agents',
  ASSIGN_WORKERS: 'assign_workers',
  VIEW_FINANCIAL_DATA: 'view_financial_data',
  MANAGE_USERS: 'manage_users',
  VIEW_USER_DETAILS: 'view_user_details',
  
  // Pricing permissions
  SET_GLOBAL_PRICING: 'set_global_pricing',
  SET_OWN_PRICING: 'set_own_pricing',
  VIEW_PRICING: 'view_pricing',
  VIEW_AGENT_PRICING: 'view_agent_pricing',
  MANAGE_AGENT_PRICING: 'manage_agent_pricing',
  VIEW_ALL_AGENT_PRICING: 'view_all_agent_pricing',
  MANAGE_ALL_AGENT_PRICING: 'manage_all_agent_pricing',
  
  // Notification permissions
  BROADCAST_NOTIFICATIONS: 'broadcast_notifications',
  SEND_WORKER_NOTIFICATIONS: 'send_worker_notifications',
  SEND_NOTIFICATIONS: 'send_notifications',
  
  // Reference code permissions
  MANAGE_REFERENCE_CODES: 'manage_reference_codes',
  VIEW_REFERENCE_CODES: 'view_reference_codes',
  GENERATE_REFERENCE_CODES: 'generate_reference_codes',
  
  // Hierarchy permissions
  VIEW_HIERARCHY: 'view_hierarchy',
  MANAGE_HIERARCHY: 'manage_hierarchy',
  REASSIGN_USERS: 'reassign_users',
  
  // System permissions
  SYSTEM_ADMIN: 'system_admin',
  VIEW_ANALYTICS: 'view_analytics',
  EXPORT_DATA: 'export_data'
};

// Role-based permission mappings
export const ROLE_PERMISSIONS = {
  super_agent: [
    PERMISSIONS.VIEW_ALL_PROJECTS,
    PERMISSIONS.CHANGE_PROJECT_STATUS,
    PERMISSIONS.CREATE_PROJECTS,
    PERMISSIONS.ASSIGN_PROJECTS,
    PERMISSIONS.MANAGE_AGENTS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_USER_DETAILS,
    PERMISSIONS.VIEW_FINANCIAL_DATA,
    PERMISSIONS.SET_GLOBAL_PRICING,
    PERMISSIONS.SET_OWN_PRICING,
    PERMISSIONS.VIEW_PRICING,
    PERMISSIONS.VIEW_ALL_AGENT_PRICING,
    PERMISSIONS.MANAGE_ALL_AGENT_PRICING,
    PERMISSIONS.BROADCAST_NOTIFICATIONS,
    PERMISSIONS.SEND_NOTIFICATIONS,
    PERMISSIONS.MANAGE_REFERENCE_CODES,
    PERMISSIONS.VIEW_REFERENCE_CODES,
    PERMISSIONS.GENERATE_REFERENCE_CODES,
    PERMISSIONS.VIEW_HIERARCHY,
    PERMISSIONS.MANAGE_HIERARCHY,
    PERMISSIONS.REASSIGN_USERS,
    PERMISSIONS.SYSTEM_ADMIN,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.EXPORT_DATA
  ],
  agent: [
    PERMISSIONS.VIEW_OWN_PROJECTS,
    PERMISSIONS.CREATE_PROJECTS,
    PERMISSIONS.VIEW_USER_DETAILS,
    PERMISSIONS.VIEW_FINANCIAL_DATA,
    PERMISSIONS.SET_OWN_PRICING,
    PERMISSIONS.VIEW_PRICING,
    PERMISSIONS.VIEW_AGENT_PRICING,
    PERMISSIONS.MANAGE_AGENT_PRICING,
    PERMISSIONS.SEND_NOTIFICATIONS,
    PERMISSIONS.VIEW_REFERENCE_CODES,
    PERMISSIONS.GENERATE_REFERENCE_CODES,
    PERMISSIONS.VIEW_HIERARCHY,
    PERMISSIONS.VIEW_ANALYTICS
  ],
  client: [
    PERMISSIONS.VIEW_OWN_PROJECTS,
    PERMISSIONS.CREATE_PROJECTS,
    PERMISSIONS.VIEW_PRICING,
    PERMISSIONS.VIEW_HIERARCHY
  ],
  super_worker: [
    PERMISSIONS.VIEW_ALL_PROJECTS,
    PERMISSIONS.VIEW_ASSIGNED_PROJECTS,
    PERMISSIONS.ASSIGN_WORKERS,
    PERMISSIONS.ASSIGN_PROJECTS,
    PERMISSIONS.VIEW_USER_DETAILS,
    PERMISSIONS.VIEW_FINANCIAL_DATA,
    PERMISSIONS.SEND_WORKER_NOTIFICATIONS,
    PERMISSIONS.SEND_NOTIFICATIONS,
    PERMISSIONS.VIEW_REFERENCE_CODES,
    PERMISSIONS.GENERATE_REFERENCE_CODES,
    PERMISSIONS.VIEW_HIERARCHY,
    PERMISSIONS.REASSIGN_USERS,
    PERMISSIONS.VIEW_ANALYTICS
  ],
  worker: [
    PERMISSIONS.VIEW_ASSIGNED_PROJECTS,
    PERMISSIONS.VIEW_HIERARCHY
  ]
};

export class PermissionService {
  /**
   * Check if a user has a specific permission
   */
  static hasPermission(userRole, permission) {
    const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
    return rolePermissions.includes(permission);
  }

  /**
   * Check if a user has any of the specified permissions
   */
  static hasAnyPermission(userRole, permissions) {
    return permissions.some(permission => this.hasPermission(userRole, permission));
  }

  /**
   * Check if a user has all of the specified permissions
   */
  static hasAllPermissions(userRole, permissions) {
    return permissions.every(permission => this.hasPermission(userRole, permission));
  }

  /**
   * Get all permissions for a user role
   */
  static getRolePermissions(userRole) {
    return ROLE_PERMISSIONS[userRole] || [];
  }

  /**
   * Check if user can access another user's data based on hierarchy
   */
  static async canAccessUser(requesterId, targetUserId) {
    try {
      // Same user can always access their own data
      if (requesterId === targetUserId) {
        return true;
      }

      // Get requester's role and hierarchy info
      const requesterResult = await query(
        `SELECT u.role, uh.hierarchy_level, uh.super_agent_id
         FROM users u
         LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
         WHERE u.id = $1`,
        [requesterId]
      );

      if (requesterResult.rows.length === 0) {
        return false;
      }

      const requester = requesterResult.rows[0];

      // Super agents can access all users in their network
      if (requester.role === 'super_agent') {
        const targetResult = await query(
          `SELECT uh.super_agent_id
           FROM user_hierarchy uh
           WHERE uh.user_id = $1`,
          [targetUserId]
        );

        if (targetResult.rows.length > 0) {
          return targetResult.rows[0].super_agent_id === requesterId;
        }
      }

      // Check if target user is in requester's direct network
      const networkResult = await query(
        `SELECT 1
         FROM user_hierarchy uh
         WHERE uh.user_id = $1 AND uh.parent_id = $2`,
        [targetUserId, requesterId]
      );

      return networkResult.rows.length > 0;
    } catch (error) {
      console.error('Error checking user access:', error);
      return false;
    }
  }

  /**
   * Check if user can access a specific project
   */
  static async canAccessProject(userId, userRole, projectId) {
    try {
      // Get project details
      const projectResult = await query(
        `SELECT client_id, worker_id, agent_id, sub_worker_id, sub_agent_id
         FROM projects WHERE id = $1`,
        [projectId]
      );

      if (projectResult.rows.length === 0) {
        return false;
      }

      const project = projectResult.rows[0];

      // Super agents can access all projects in their network
      if (userRole === 'super_agent') {
        // Check if any project participant is in super agent's network
        const participantIds = [
          project.client_id,
          project.worker_id,
          project.agent_id,
          project.sub_worker_id,
          project.sub_agent_id
        ].filter(Boolean);

        if (participantIds.length === 0) return false;

        const networkResult = await query(
          `SELECT COUNT(*) as count
           FROM user_hierarchy uh
           WHERE uh.user_id = ANY($1) AND uh.super_agent_id = $2`,
          [participantIds, userId]
        );

        return parseInt(networkResult.rows[0].count) > 0;
      }

      // Check direct involvement in project
      const isDirectlyInvolved = [
        project.client_id,
        project.worker_id,
        project.agent_id,
        project.sub_worker_id,
        project.sub_agent_id
      ].includes(userId);

      if (isDirectlyInvolved) {
        return true;
      }

      // Agents can access projects from their clients
      if (userRole === 'agent') {
        const clientAccessResult = await query(
          `SELECT 1
           FROM user_hierarchy uh
           WHERE uh.user_id = $1 AND uh.parent_id = $2`,
          [project.client_id, userId]
        );

        return clientAccessResult.rows.length > 0;
      }

      // Super workers can access projects assigned to their workers
      if (userRole === 'super_worker') {
        const workerAccessResult = await query(
          `SELECT 1
           FROM user_hierarchy uh
           WHERE (uh.user_id = $1 OR uh.user_id = $2) AND uh.parent_id = $3`,
          [project.worker_id, project.sub_worker_id, userId]
        );

        return workerAccessResult.rows.length > 0;
      }

      return false;
    } catch (error) {
      console.error('Error checking project access:', error);
      return false;
    }
  }

  /**
   * Get filtered projects based on user permissions
   */
  static async getAccessibleProjects(userId, userRole) {
    try {
      let query_text = '';
      let params = [userId];

      switch (userRole) {
        case 'super_agent':
          // Super agents can see all projects in their network
          query_text = `
            SELECT DISTINCT p.*
            FROM projects p
            JOIN user_hierarchy uh ON (
              uh.user_id = p.client_id OR 
              uh.user_id = p.worker_id OR 
              uh.user_id = p.agent_id OR
              uh.user_id = p.sub_worker_id OR
              uh.user_id = p.sub_agent_id
            )
            WHERE uh.super_agent_id = $1
            ORDER BY p.created_at DESC
          `;
          break;

        case 'agent':
          // Agents can see projects from their clients
          query_text = `
            SELECT p.*
            FROM projects p
            WHERE p.agent_id = $1 OR p.sub_agent_id = $1
               OR p.client_id IN (
                 SELECT uh.user_id 
                 FROM user_hierarchy uh 
                 WHERE uh.parent_id = $1
               )
            ORDER BY p.created_at DESC
          `;
          break;

        case 'super_worker':
          // Super workers can see all projects and those assigned to their workers
          query_text = `
            SELECT p.*
            FROM projects p
            WHERE p.worker_id = $1 OR p.sub_worker_id = $1
               OR p.worker_id IN (
                 SELECT uh.user_id 
                 FROM user_hierarchy uh 
                 WHERE uh.parent_id = $1
               )
               OR p.sub_worker_id IN (
                 SELECT uh.user_id 
                 FROM user_hierarchy uh 
                 WHERE uh.parent_id = $1
               )
            ORDER BY p.created_at DESC
          `;
          break;

        case 'worker':
          // Workers can only see projects assigned to them
          query_text = `
            SELECT p.*
            FROM projects p
            WHERE p.worker_id = $1 OR p.sub_worker_id = $1
            ORDER BY p.created_at DESC
          `;
          break;

        case 'client':
          // Clients can only see their own projects
          query_text = `
            SELECT p.*
            FROM projects p
            WHERE p.client_id = $1
            ORDER BY p.created_at DESC
          `;
          break;

        default:
          return [];
      }

      const result = await query(query_text, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting accessible projects:', error);
      return [];
    }
  }

  /**
   * Check if user can modify project status
   */
  static canModifyProjectStatus(userRole) {
    return this.hasPermission(userRole, PERMISSIONS.CHANGE_PROJECT_STATUS);
  }

  /**
   * Check if user can assign workers to projects
   */
  static canAssignWorkers(userRole) {
    return this.hasPermission(userRole, PERMISSIONS.ASSIGN_WORKERS);
  }

  /**
   * Check if user can view financial data
   */
  static canViewFinancialData(userRole) {
    return this.hasPermission(userRole, PERMISSIONS.VIEW_FINANCIAL_DATA);
  }

  /**
   * Check if user can manage reference codes
   */
  static canManageReferenceCodes(userRole) {
    return this.hasPermission(userRole, PERMISSIONS.MANAGE_REFERENCE_CODES);
  }

  /**
   * Check if user can broadcast notifications
   */
  static canBroadcastNotifications(userRole) {
    return this.hasPermission(userRole, PERMISSIONS.BROADCAST_NOTIFICATIONS);
  }

  /**
   * Get permission summary for a user
   */
  static getPermissionSummary(userRole) {
    const permissions = this.getRolePermissions(userRole);
    
    return {
      role: userRole,
      permissions,
      can: {
        viewAllProjects: this.hasPermission(userRole, PERMISSIONS.VIEW_ALL_PROJECTS),
        changeProjectStatus: this.hasPermission(userRole, PERMISSIONS.CHANGE_PROJECT_STATUS),
        manageUsers: this.hasPermission(userRole, PERMISSIONS.MANAGE_USERS),
        viewFinancialData: this.hasPermission(userRole, PERMISSIONS.VIEW_FINANCIAL_DATA),
        setPricing: this.hasPermission(userRole, PERMISSIONS.SET_GLOBAL_PRICING) || 
                   this.hasPermission(userRole, PERMISSIONS.SET_OWN_PRICING),
        broadcastNotifications: this.hasPermission(userRole, PERMISSIONS.BROADCAST_NOTIFICATIONS),
        manageHierarchy: this.hasPermission(userRole, PERMISSIONS.MANAGE_HIERARCHY),
        systemAdmin: this.hasPermission(userRole, PERMISSIONS.SYSTEM_ADMIN)
      }
    };
  }

  /**
   * Validate permission for API endpoint
   */
  static validatePermission(userRole, requiredPermission) {
    if (!this.hasPermission(userRole, requiredPermission)) {
      const error = new Error(`Insufficient permissions. Required: ${requiredPermission}`);
      error.code = 'INSUFFICIENT_PERMISSIONS';
      error.statusCode = 403;
      throw error;
    }
    return true;
  }

  /**
   * Validate any of multiple permissions for API endpoint
   */
  static validateAnyPermission(userRole, requiredPermissions) {
    if (!this.hasAnyPermission(userRole, requiredPermissions)) {
      const error = new Error(`Insufficient permissions. Required one of: ${requiredPermissions.join(', ')}`);
      error.code = 'INSUFFICIENT_PERMISSIONS';
      error.statusCode = 403;
      throw error;
    }
    return true;
  }
}

export default PermissionService;