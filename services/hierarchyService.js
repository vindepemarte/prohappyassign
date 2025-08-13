import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Database connection configured

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

// Helper function for transactions
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export class HierarchyService {
  /**
   * Assign user to hierarchy based on reference code
   */
  static async assignUserToHierarchy(userId, referenceCode) {
    try {
      return await transaction(async (client) => {
        // Get reference code owner information
        const codeResult = await client.query(
          `SELECT rc.*, u.id as owner_id, u.role as owner_role, u.super_agent_id as owner_super_agent_id
           FROM reference_codes rc
           JOIN users u ON rc.owner_id = u.id
           WHERE rc.code = $1 AND rc.is_active = true`,
          [referenceCode.trim().toUpperCase()]
        );

        if (codeResult.rows.length === 0) {
          throw new Error('Invalid or inactive reference code');
        }

        const codeInfo = codeResult.rows[0];
        
        // Determine hierarchy level and parent based on code type
        let hierarchyLevel;
        let parentId = codeInfo.owner_id;
        let superAgentId = codeInfo.owner_super_agent_id || codeInfo.owner_id;

        switch (codeInfo.code_type) {
          case 'agent_recruitment':
            hierarchyLevel = 2; // Agent level
            break;
          case 'client_recruitment':
            hierarchyLevel = 3; // Client level
            break;
          case 'worker_recruitment':
            hierarchyLevel = 4; // Worker level
            break;
          default:
            throw new Error('Unknown reference code type');
        }

        // Insert hierarchy record
        const hierarchyResult = await client.query(
          `INSERT INTO user_hierarchy (user_id, parent_id, hierarchy_level, super_agent_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) DO UPDATE SET
           parent_id = EXCLUDED.parent_id,
           hierarchy_level = EXCLUDED.hierarchy_level,
           super_agent_id = EXCLUDED.super_agent_id,
           updated_at = NOW()
           RETURNING *`,
          [userId, parentId, hierarchyLevel, superAgentId]
        );

        return hierarchyResult.rows[0];
      });
    } catch (error) {
      console.error('Error assigning user to hierarchy:', error);
      throw new Error('Failed to assign user to hierarchy');
    }
  }

  /**
   * Get user's network (subordinates)
   */
  static async getUserNetwork(userId) {
    try {
      const result = await query(
        `SELECT u.*, uh.hierarchy_level, uh.parent_id
         FROM users u
         JOIN user_hierarchy uh ON u.id = uh.user_id
         WHERE uh.parent_id = $1 OR uh.super_agent_id = $1
         ORDER BY uh.hierarchy_level, u.created_at`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      console.error('Error fetching user network:', error);
      throw new Error('Failed to fetch user network');
    }
  }

  /**
   * Get hierarchy path for user (from user up to super agent)
   */
  static async getHierarchyPath(userId) {
    try {
      const result = await query(
        `WITH RECURSIVE hierarchy_path AS (
           -- Base case: start with the user
           SELECT u.id, u.full_name, u.role, uh.parent_id, uh.hierarchy_level, 0 as depth
           FROM users u
           JOIN user_hierarchy uh ON u.id = uh.user_id
           WHERE u.id = $1
           
           UNION ALL
           
           -- Recursive case: get parent
           SELECT u.id, u.full_name, u.role, uh.parent_id, uh.hierarchy_level, hp.depth + 1
           FROM users u
           JOIN user_hierarchy uh ON u.id = uh.user_id
           JOIN hierarchy_path hp ON u.id = hp.parent_id
         )
         SELECT * FROM hierarchy_path ORDER BY depth DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      console.error('Error fetching hierarchy path:', error);
      throw new Error('Failed to fetch hierarchy path');
    }
  }

  /**
   * Check if user can access another user's data
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
   * Get user's hierarchy information
   */
  static async getUserHierarchyInfo(userId) {
    try {
      const result = await query(
        `SELECT uh.*, 
                parent.full_name as parent_name,
                parent.role as parent_role,
                super_agent.full_name as super_agent_name
         FROM user_hierarchy uh
         LEFT JOIN users parent ON uh.parent_id = parent.id
         LEFT JOIN users super_agent ON uh.super_agent_id = super_agent.id
         WHERE uh.user_id = $1`,
        [userId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching user hierarchy info:', error);
      throw new Error('Failed to fetch user hierarchy information');
    }
  }

  /**
   * Get all users under a specific super agent
   */
  static async getSuperAgentNetwork(superAgentId) {
    try {
      const result = await query(
        `SELECT u.*, uh.hierarchy_level, uh.parent_id,
                parent.full_name as parent_name,
                parent.role as parent_role
         FROM users u
         JOIN user_hierarchy uh ON u.id = uh.user_id
         LEFT JOIN users parent ON uh.parent_id = parent.id
         WHERE uh.super_agent_id = $1 AND u.id != $1
         ORDER BY uh.hierarchy_level, u.created_at`,
        [superAgentId]
      );

      return result.rows;
    } catch (error) {
      console.error('Error fetching super agent network:', error);
      throw new Error('Failed to fetch super agent network');
    }
  }

  /**
   * Update user's hierarchy (for reassignments)
   */
  static async updateUserHierarchy(userId, newParentId, requesterId) {
    try {
      return await transaction(async (client) => {
        // Verify requester has permission to make this change
        const canAccess = await this.canAccessUser(requesterId, userId);
        if (!canAccess) {
          throw new Error('Insufficient permissions to update user hierarchy');
        }

        // Prevent circular hierarchy
        if (userId === newParentId) {
          throw new Error('User cannot be their own parent');
        }

        // Check if new parent would create a circular reference
        const pathCheck = await client.query(
          `WITH RECURSIVE hierarchy_check AS (
             SELECT user_id, parent_id, 1 as depth
             FROM user_hierarchy
             WHERE user_id = $1
             
             UNION ALL
             
             SELECT uh.user_id, uh.parent_id, hc.depth + 1
             FROM user_hierarchy uh
             JOIN hierarchy_check hc ON uh.user_id = hc.parent_id
             WHERE hc.depth < 10
           )
           SELECT 1 FROM hierarchy_check WHERE parent_id = $2`,
          [newParentId, userId]
        );

        if (pathCheck.rows.length > 0) {
          throw new Error('Cannot create circular hierarchy relationship');
        }

        // Get new parent's hierarchy info
        const parentResult = await client.query(
          `SELECT uh.hierarchy_level, uh.super_agent_id
           FROM user_hierarchy uh
           WHERE uh.user_id = $1`,
          [newParentId]
        );

        if (parentResult.rows.length === 0) {
          throw new Error('New parent not found in hierarchy');
        }

        const parentInfo = parentResult.rows[0];
        const newHierarchyLevel = parentInfo.hierarchy_level + 1;

        // Update user's hierarchy
        const updateResult = await client.query(
          `UPDATE user_hierarchy 
           SET parent_id = $1, 
               hierarchy_level = $2, 
               super_agent_id = $3,
               updated_at = NOW()
           WHERE user_id = $4
           RETURNING *`,
          [newParentId, newHierarchyLevel, parentInfo.super_agent_id, userId]
        );

        return updateResult.rows[0];
      });
    } catch (error) {
      console.error('Error updating user hierarchy:', error);
      throw new Error('Failed to update user hierarchy');
    }
  }

  /**
   * Get hierarchy statistics for a user
   */
  static async getHierarchyStats(userId) {
    try {
      const result = await query(
        `SELECT 
           COUNT(CASE WHEN uh.parent_id = $1 THEN 1 END) as direct_subordinates,
           COUNT(CASE WHEN uh.super_agent_id = $1 AND uh.user_id != $1 THEN 1 END) as total_network_size,
           COUNT(CASE WHEN uh.parent_id = $1 AND u.role = 'agent' THEN 1 END) as agents_recruited,
           COUNT(CASE WHEN uh.parent_id = $1 AND u.role = 'client' THEN 1 END) as clients_recruited,
           COUNT(CASE WHEN uh.parent_id = $1 AND u.role = 'worker' THEN 1 END) as workers_recruited
         FROM user_hierarchy uh
         LEFT JOIN users u ON uh.user_id = u.id`,
        [userId]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error fetching hierarchy stats:', error);
      throw new Error('Failed to fetch hierarchy statistics');
    }
  }

  /**
   * Validate hierarchy integrity
   */
  static async validateHierarchyIntegrity() {
    try {
      const issues = [];

      // Check for circular references
      const circularResult = await query(`
        WITH RECURSIVE hierarchy_check AS (
          SELECT user_id, parent_id, ARRAY[user_id] as path, 1 as depth
          FROM user_hierarchy
          WHERE parent_id IS NOT NULL
          
          UNION ALL
          
          SELECT uh.user_id, uh.parent_id, hc.path || uh.user_id, hc.depth + 1
          FROM user_hierarchy uh
          JOIN hierarchy_check hc ON uh.user_id = hc.parent_id
          WHERE uh.user_id != ALL(hc.path) AND hc.depth < 10
        )
        SELECT user_id, path FROM hierarchy_check 
        WHERE user_id = ANY(path[1:array_length(path,1)-1])
      `);

      if (circularResult.rows.length > 0) {
        issues.push({
          type: 'circular_reference',
          count: circularResult.rows.length,
          details: circularResult.rows
        });
      }

      // Check for orphaned users (users without hierarchy records)
      const orphanedResult = await query(`
        SELECT u.id, u.full_name, u.role
        FROM users u
        LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
        WHERE uh.user_id IS NULL AND u.role != 'super_agent'
      `);

      if (orphanedResult.rows.length > 0) {
        issues.push({
          type: 'orphaned_users',
          count: orphanedResult.rows.length,
          details: orphanedResult.rows
        });
      }

      // Check for invalid hierarchy levels
      const invalidLevelResult = await query(`
        SELECT uh.user_id, u.role, uh.hierarchy_level
        FROM user_hierarchy uh
        JOIN users u ON uh.user_id = u.id
        WHERE (u.role = 'super_agent' AND uh.hierarchy_level != 1)
           OR (u.role = 'agent' AND uh.hierarchy_level != 2)
           OR (u.role = 'client' AND uh.hierarchy_level != 3)
           OR (u.role = 'super_worker' AND uh.hierarchy_level != 2)
           OR (u.role = 'worker' AND uh.hierarchy_level != 4)
      `);

      if (invalidLevelResult.rows.length > 0) {
        issues.push({
          type: 'invalid_hierarchy_levels',
          count: invalidLevelResult.rows.length,
          details: invalidLevelResult.rows
        });
      }

      return {
        isValid: issues.length === 0,
        issues
      };
    } catch (error) {
      console.error('Error validating hierarchy integrity:', error);
      throw new Error('Failed to validate hierarchy integrity');
    }
  }
}

export default HierarchyService;