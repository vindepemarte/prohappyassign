/**
 * Hierarchy Service
 * Replaces missing PostgreSQL functions with JavaScript implementations
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

export class HierarchyService {
  /**
   * Get all subordinates for a user (replaces get_user_subordinates function)
   */
  static async getUserSubordinates(userId) {
    try {
      // Get direct subordinates from user_hierarchy table
      const directSubordinates = await pool.query(`
        SELECT 
          uh.subordinate_id,
          u.role as subordinate_role,
          1 as hierarchy_level,
          u.full_name,
          u.email
        FROM user_hierarchy uh
        JOIN users u ON uh.subordinate_id = u.id
        WHERE uh.parent_id = $1
      `, [userId]);

      // For now, return direct subordinates only
      // In a full implementation, you might want to recursively get all levels
      return directSubordinates.rows;
    } catch (error) {
      console.error('Error getting user subordinates:', error);
      throw new Error('Failed to get user subordinates');
    }
  }

  /**
   * Check if a user can send notifications to another user
   */
  static async canSendNotification(senderId, targetUserId) {
    try {
      // Super Agent can send to anyone
      const senderResult = await pool.query('SELECT role FROM users WHERE id = $1', [senderId]);
      if (senderResult.rows.length === 0) {
        return false;
      }

      const senderRole = senderResult.rows[0].role;
      if (senderRole === 'super_agent') {
        return true;
      }

      // Check if target is a subordinate
      const subordinates = await this.getUserSubordinates(senderId);
      const canSend = subordinates.some(sub => sub.subordinate_id === targetUserId);
      
      // Also allow sending to self
      return canSend || senderId === targetUserId;
    } catch (error) {
      console.error('Error checking notification permission:', error);
      return false;
    }
  }

  /**
   * Send hierarchy-aware notifications (replaces send_hierarchy_notification function)
   */
  static async sendHierarchyNotification(senderId, targetUserIds, title, body, notificationType = 'general', projectId = null) {
    const results = [];
    
    try {
      for (const targetUserId of targetUserIds) {
        try {
          // Check permission
          const canSend = await this.canSendNotification(senderId, targetUserId);
          
          if (!canSend) {
            results.push({
              user_id: targetUserId,
              success: false,
              error: 'Permission denied'
            });
            continue;
          }

          // Insert notification
          const result = await pool.query(`
            INSERT INTO notification_history (
              user_id, sender_id, title, body, notification_type, 
              project_id, delivery_status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'delivered', NOW())
            RETURNING *
          `, [targetUserId, senderId, title, body, notificationType, projectId]);

          results.push({
            user_id: targetUserId,
            success: true,
            data: result.rows[0]
          });
        } catch (error) {
          results.push({
            user_id: targetUserId,
            success: false,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error sending hierarchy notifications:', error);
      throw new Error('Failed to send notifications');
    }
  }

  /**
   * Get user's role and hierarchy information
   */
  static async getUserHierarchyInfo(userId) {
    try {
      const result = await pool.query(`
        SELECT 
          u.id,
          u.role,
          u.full_name,
          u.email,
          uh.parent_id,
          parent.full_name as parent_name,
          parent.role as parent_role
        FROM users u
        LEFT JOIN user_hierarchy uh ON u.id = uh.subordinate_id
        LEFT JOIN users parent ON uh.parent_id = parent.id
        WHERE u.id = $1
      `, [userId]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting user hierarchy info:', error);
      throw new Error('Failed to get user hierarchy information');
    }
  }

  /**
   * Check if user exists and get basic info
   */
  static async getUserInfo(userId) {
    try {
      const result = await pool.query(
        'SELECT id, role, full_name, email FROM users WHERE id = $1',
        [userId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting user info:', error);
      throw new Error('Failed to get user information');
    }
  }

  /**
   * Get all users with a specific role
   */
  static async getUsersByRole(role) {
    try {
      const result = await pool.query(
        'SELECT id, full_name, email, role FROM users WHERE role = $1',
        [role]
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting users by role:', error);
      throw new Error('Failed to get users by role');
    }
  }

  /**
   * Get all users (for Super Agent broadcasts)
   */
  static async getAllUsers() {
    try {
      const result = await pool.query(
        'SELECT id, full_name, email, role FROM users ORDER BY full_name'
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting all users:', error);
      throw new Error('Failed to get all users');
    }
  }
}

export default HierarchyService;