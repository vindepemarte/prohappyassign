import express from 'express';
import { Pool } from 'pg';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import HierarchyService from '../services/hierarchyService.js';
import ReferenceCodeService from '../services/referenceCodeService.js';
import { 
    AppError, 
    ERROR_TYPES, 
    ERROR_MESSAGES, 
    handleApiError, 
    validateHierarchyOperation 
} from '../utils/errorHandling.js';

const router = express.Router();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Helper function to validate hierarchy moves
async function validateHierarchyMove(userRole, newParentRole, currentLevel, newParentLevel) {
    // Role hierarchy rules
    const roleHierarchy = {
        'super_agent': 1,
        'agent': 2,
        'super_worker': 3,
        'worker': 4,
        'client': 3  // Clients can be at level 3 under agents
    };
    
    const userRoleLevel = roleHierarchy[userRole];
    const parentRoleLevel = roleHierarchy[newParentRole];
    
    // Super agents cannot be moved
    if (userRole === 'super_agent') {
        return {
            valid: false,
            message: 'Super Agents cannot be moved in the hierarchy.'
        };
    }
    
    // Validate parent-child role relationships
    const validRelationships = {
        'agent': ['super_agent'],
        'super_worker': ['agent'],
        'worker': ['super_worker'],
        'client': ['agent']
    };
    
    const allowedParents = validRelationships[userRole];
    if (!allowedParents || !allowedParents.includes(newParentRole)) {
        return {
            valid: false,
            message: `A ${userRole} cannot be placed under a ${newParentRole}. Valid parent roles: ${allowedParents?.join(', ') || 'none'}.`
        };
    }
    
    // Validate hierarchy levels
    const expectedLevel = newParentLevel + 1;
    if (expectedLevel > 5) {
        return {
            valid: false,
            message: 'This move would exceed the maximum hierarchy depth of 5 levels.'
        };
    }
    
    return {
        valid: true,
        message: 'Move is valid',
        new_level: expectedLevel
    };
}

// Get complete hierarchy tree (Super Agent only)
router.get('/tree', authenticateToken, requirePermission('view_hierarchy_tree'), async (req, res) => {
    try {
        const { includeInactive = false } = req.query;
        
        // Validate query parameters
        if (includeInactive && !['true', 'false'].includes(includeInactive.toString())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid includeInactive parameter. Must be true or false.',
                code: 'VALIDATION_ERROR'
            });
        }
        
        const result = await pool.query(`
            WITH RECURSIVE hierarchy_tree AS (
                -- Root level (Super Agents)
                SELECT 
                    u.id, u.full_name, u.email, u.role, u.created_at,
                    uh.hierarchy_level, uh.parent_id, uh.super_agent_id,
                    0 as depth,
                    ARRAY[u.full_name] as path,
                    u.full_name as root_name
                FROM users u
                LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
                WHERE u.role = 'super_agent' ${includeInactive === 'true' ? '' : "AND u.is_active = true"}
                
                UNION ALL
                
                -- Recursive: children of current level
                SELECT 
                    u.id, u.full_name, u.email, u.role, u.created_at,
                    uh.hierarchy_level, uh.parent_id, uh.super_agent_id,
                    ht.depth + 1,
                    ht.path || u.full_name,
                    ht.root_name
                FROM users u
                JOIN user_hierarchy uh ON u.id = uh.user_id
                JOIN hierarchy_tree ht ON uh.parent_id = ht.id
                WHERE ${includeInactive === 'true' ? 'true' : 'u.is_active = true'}
            )
            SELECT 
                ht.*,
                COUNT(p.id) as total_projects,
                COUNT(CASE WHEN p.status = 'in_progress' THEN 1 END) as active_projects,
                COALESCE(SUM(p.cost_gbp), 0) as total_revenue
            FROM hierarchy_tree ht
            LEFT JOIN projects p ON (
                ht.id = p.client_id OR ht.id = p.agent_id OR ht.id = p.sub_agent_id OR
                ht.id = p.worker_id OR ht.id = p.sub_worker_id
            )
            GROUP BY ht.id, ht.full_name, ht.email, ht.role, ht.created_at,
                     ht.hierarchy_level, ht.parent_id, ht.super_agent_id, ht.depth, ht.path, ht.root_name
            ORDER BY ht.depth, ht.hierarchy_level, ht.full_name
        `);
        
        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: [],
                message: 'No hierarchy data found. This may indicate a system setup issue.'
            });
        }
        
        res.json({
            success: true,
            data: result.rows,
            meta: {
                total_users: result.rows.length,
                max_depth: Math.max(...result.rows.map(row => row.depth)),
                include_inactive: includeInactive === 'true'
            }
        });
    } catch (error) {
        console.error('Error getting hierarchy tree:', error);
        
        if (error.code === '42P01') { // Table doesn't exist
            return res.status(500).json({
                success: false,
                error: 'Database schema not properly initialized. Please contact system administrator.',
                code: 'DATABASE_SCHEMA_ERROR'
            });
        }
        
        res.status(500).json({
            success: false,
            error: ERROR_MESSAGES.DATABASE_CONNECTION_ERROR,
            code: 'DATABASE_ERROR'
        });
    }
});

// Get user's complete network with statistics
router.get('/network/:userId', authenticateToken, requirePermission('view_user_network'), async (req, res) => {
    try {
        const { userId } = req.params;
        const { depth = 3 } = req.query;
        
        // Validate parameters
        if (!userId || userId.length < 10) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID provided.',
                code: 'VALIDATION_ERROR'
            });
        }
        
        const depthNum = parseInt(depth);
        if (isNaN(depthNum) || depthNum < 1 || depthNum > 10) {
            return res.status(400).json({
                success: false,
                error: 'Depth must be a number between 1 and 10.',
                code: 'VALIDATION_ERROR'
            });
        }
        
        // Check if the requested user exists
        const userExists = await pool.query('SELECT id, full_name, is_active FROM users WHERE id = $1', [userId]);
        if (userExists.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: ERROR_MESSAGES.HIERARCHY_USER_NOT_FOUND,
                code: 'USER_NOT_FOUND'
            });
        }
        
        if (!userExists.rows[0].is_active) {
            return res.status(400).json({
                success: false,
                error: 'Cannot view network for inactive user.',
                code: 'USER_INACTIVE'
            });
        }
        
        // Check if user can view this network
        if (req.user.role !== 'super_agent' && req.user.id !== userId) {
            try {
                // Check if the requested user is in the requester's hierarchy
                const hierarchyCheck = await pool.query(
                    'SELECT 1 FROM get_user_subordinates($1) WHERE subordinate_id = $2',
                    [req.user.id, userId]
                );
                
                if (hierarchyCheck.rows.length === 0) {
                    return res.status(403).json({
                        success: false,
                        error: ERROR_MESSAGES.AUTH_INSUFFICIENT_PERMISSIONS,
                        code: 'PERMISSION_DENIED'
                    });
                }
            } catch (funcError) {
                // If function doesn't exist, fall back to basic hierarchy check
                const basicCheck = await pool.query(`
                    WITH RECURSIVE subordinates AS (
                        SELECT id FROM users WHERE id = $1
                        UNION ALL
                        SELECT u.id FROM users u
                        JOIN user_hierarchy uh ON u.id = uh.user_id
                        JOIN subordinates s ON uh.parent_id = s.id
                    )
                    SELECT 1 FROM subordinates WHERE id = $2
                `, [req.user.id, userId]);
                
                if (basicCheck.rows.length === 0) {
                    return res.status(403).json({
                        success: false,
                        error: ERROR_MESSAGES.AUTH_INSUFFICIENT_PERMISSIONS,
                        code: 'PERMISSION_DENIED'
                    });
                }
            }
        }
        
        const result = await pool.query(`
            WITH RECURSIVE user_network AS (
                -- Starting user
                SELECT 
                    u.id, u.full_name, u.email, u.role, u.created_at,
                    uh.hierarchy_level, uh.parent_id, uh.super_agent_id,
                    0 as depth,
                    'self' as relationship
                FROM users u
                LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
                WHERE u.id = $1
                
                UNION ALL
                
                -- Direct subordinates (limited by depth)
                SELECT 
                    u.id, u.full_name, u.email, u.role, u.created_at,
                    uh.hierarchy_level, uh.parent_id, uh.super_agent_id,
                    un.depth + 1,
                    'subordinate' as relationship
                FROM users u
                JOIN user_hierarchy uh ON u.id = uh.user_id
                JOIN user_network un ON uh.parent_id = un.id
                WHERE un.depth < $2 AND u.is_active = true
            )
            SELECT 
                un.*,
                COUNT(p.id) as total_projects,
                COUNT(CASE WHEN p.status = 'in_progress' THEN 1 END) as active_projects,
                COALESCE(SUM(p.cost_gbp), 0) as total_revenue,
                COUNT(rc.id) as reference_codes_count
            FROM user_network un
            LEFT JOIN projects p ON (
                un.id = p.client_id OR un.id = p.agent_id OR un.id = p.sub_agent_id OR
                un.id = p.worker_id OR un.id = p.sub_worker_id
            )
            LEFT JOIN reference_codes rc ON un.id = rc.owner_id AND rc.is_active = true
            GROUP BY un.id, un.full_name, un.email, un.role, un.created_at,
                     un.hierarchy_level, un.parent_id, un.super_agent_id, un.depth, un.relationship
            ORDER BY un.depth, un.hierarchy_level, un.full_name
        `, [userId, depthNum]);
        
        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: [],
                message: 'No network data found for this user.',
                meta: {
                    user_name: userExists.rows[0].full_name,
                    requested_depth: depthNum
                }
            });
        }
        
        res.json({
            success: true,
            data: result.rows,
            meta: {
                user_name: userExists.rows[0].full_name,
                network_size: result.rows.length,
                max_depth_found: Math.max(...result.rows.map(row => row.depth)),
                requested_depth: depthNum
            }
        });
    } catch (error) {
        console.error('Error getting user network:', error);
        
        if (error.code === '22P02') { // Invalid UUID format
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID format.',
                code: 'VALIDATION_ERROR'
            });
        }
        
        res.status(500).json({
            success: false,
            error: ERROR_MESSAGES.DATABASE_CONNECTION_ERROR,
            code: 'DATABASE_ERROR'
        });
    }
});

// Move user in hierarchy
router.put('/move-user', authenticateToken, requirePermission('manage_hierarchy'), async (req, res) => {
    try {
        const { userId, newParentId, reason } = req.body;
        
        // Validate input parameters
        const validationErrors = validateHierarchyOperation('move_user', { userId, newParentId, reason });
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: validationErrors[0].message,
                code: validationErrors[0].code,
                details: validationErrors.map(err => err.message)
            });
        }
        
        // Check for circular reference
        if (userId === newParentId) {
            return res.status(400).json({
                success: false,
                error: ERROR_MESSAGES.HIERARCHY_CIRCULAR_REFERENCE,
                code: 'HIERARCHY_CIRCULAR_REFERENCE'
            });
        }
        
        // Check if user would become their own ancestor
        const circularCheck = await pool.query(`
            WITH RECURSIVE ancestors AS (
                SELECT parent_id FROM user_hierarchy WHERE user_id = $1
                UNION ALL
                SELECT uh.parent_id 
                FROM user_hierarchy uh
                JOIN ancestors a ON uh.user_id = a.parent_id
                WHERE uh.parent_id IS NOT NULL
            )
            SELECT 1 FROM ancestors WHERE parent_id = $2
        `, [newParentId, userId]);
        
        if (circularCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: ERROR_MESSAGES.HIERARCHY_CIRCULAR_REFERENCE,
                code: 'HIERARCHY_CIRCULAR_REFERENCE'
            });
        }
        
        // Validate the move with detailed information
        const validation = await pool.query(`
            SELECT 
                u1.id as user_id, u1.full_name as user_name, u1.role as user_role, u1.is_active as user_active,
                u2.id as new_parent_id, u2.full_name as new_parent_name, u2.role as new_parent_role, u2.is_active as parent_active,
                uh1.hierarchy_level as current_level, uh1.parent_id as current_parent_id,
                uh2.hierarchy_level as new_parent_level,
                up.full_name as current_parent_name
            FROM users u1
            LEFT JOIN user_hierarchy uh1 ON u1.id = uh1.user_id
            LEFT JOIN users up ON uh1.parent_id = up.id
            CROSS JOIN users u2
            LEFT JOIN user_hierarchy uh2 ON u2.id = uh2.user_id
            WHERE u1.id = $1 AND u2.id = $2
        `, [userId, newParentId]);
        
        if (validation.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: ERROR_MESSAGES.HIERARCHY_USER_NOT_FOUND,
                code: 'USER_NOT_FOUND'
            });
        }
        
        const moveData = validation.rows[0];
        
        // Check if users are active
        if (!moveData.user_active) {
            return res.status(400).json({
                success: false,
                error: 'Cannot move inactive user.',
                code: 'USER_INACTIVE'
            });
        }
        
        if (!moveData.parent_active) {
            return res.status(400).json({
                success: false,
                error: 'Cannot move user under inactive parent.',
                code: 'PARENT_INACTIVE'
            });
        }
        
        // Business logic validation
        const isValidMove = await validateHierarchyMove(
            moveData.user_role, 
            moveData.new_parent_role, 
            moveData.current_level, 
            moveData.new_parent_level
        );
        
        if (!isValidMove.valid) {
            return res.status(400).json({
                success: false,
                error: isValidMove.message,
                code: 'HIERARCHY_VIOLATION',
                details: {
                    user_role: moveData.user_role,
                    new_parent_role: moveData.new_parent_role,
                    current_level: moveData.current_level,
                    new_parent_level: moveData.new_parent_level
                }
            });
        }
        
        // Check if this is actually a change
        if (moveData.current_parent_id === newParentId) {
            return res.status(400).json({
                success: false,
                error: `${moveData.user_name} is already under ${moveData.new_parent_name}.`,
                code: 'NO_CHANGE_NEEDED'
            });
        }
        
        // Perform the move with transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            const newHierarchyLevel = moveData.new_parent_level + 1;
            
            // Update user hierarchy
            const updateResult = await client.query(`
                UPDATE user_hierarchy 
                SET parent_id = $1, 
                    hierarchy_level = $2,
                    updated_at = NOW()
                WHERE user_id = $3
                RETURNING *
            `, [newParentId, newHierarchyLevel, userId]);
            
            if (updateResult.rows.length === 0) {
                throw new Error('Failed to update user hierarchy');
            }
            
            // Log the hierarchy change
            await client.query(`
                INSERT INTO hierarchy_change_log (
                    user_id, old_parent_id, new_parent_id, changed_by, change_reason, 
                    old_hierarchy_level, new_hierarchy_level, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            `, [
                userId, 
                moveData.current_parent_id, 
                newParentId, 
                req.user.id, 
                reason || 'Hierarchy restructure',
                moveData.current_level,
                newHierarchyLevel
            ]);
            
            await client.query('COMMIT');
            
            res.json({
                success: true,
                message: `Successfully moved ${moveData.user_name} from ${moveData.current_parent_name || 'no parent'} to ${moveData.new_parent_name}`,
                data: {
                    user_id: userId,
                    user_name: moveData.user_name,
                    old_parent_id: moveData.current_parent_id,
                    old_parent_name: moveData.current_parent_name,
                    new_parent_id: newParentId,
                    new_parent_name: moveData.new_parent_name,
                    old_hierarchy_level: moveData.current_level,
                    new_hierarchy_level: newHierarchyLevel,
                    reason: reason || 'Hierarchy restructure',
                    changed_by: req.user.full_name,
                    changed_at: new Date().toISOString()
                }
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Transaction error during hierarchy move:', error);
            throw new AppError(
                'HIERARCHY_MOVE_FAILED',
                'Failed to complete hierarchy move. Changes have been rolled back.',
                ERROR_TYPES.DATABASE_ERROR
            );
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error moving user in hierarchy:', error);
        
        if (error instanceof AppError) {
            return res.status(500).json({
                success: false,
                error: error.message,
                code: error.code
            });
        }
        
        if (error.code === '23503') { // Foreign key violation
            return res.status(400).json({
                success: false,
                error: 'Invalid parent user specified.',
                code: 'INVALID_PARENT'
            });
        }
        
        res.status(500).json({
            success: false,
            error: ERROR_MESSAGES.DATABASE_CONNECTION_ERROR,
            code: 'DATABASE_ERROR'
        });
    }
});

// Get hierarchy statistics
router.get('/statistics', authenticateToken, requirePermission('view_hierarchy_stats'), async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN role = 'super_agent' THEN 1 END) as super_agents,
                COUNT(CASE WHEN role = 'agent' THEN 1 END) as agents,
                COUNT(CASE WHEN role = 'super_worker' THEN 1 END) as super_workers,
                COUNT(CASE WHEN role = 'worker' THEN 1 END) as workers,
                COUNT(CASE WHEN role = 'client' THEN 1 END) as clients,
                AVG(uh.hierarchy_level) as avg_hierarchy_level,
                MAX(uh.hierarchy_level) as max_hierarchy_level,
                COUNT(CASE WHEN u.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as new_users_30_days,
                COUNT(CASE WHEN u.is_active = true THEN 1 END) as active_users
            FROM users u
            LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
        `);
        
        const hierarchyDepth = await pool.query(`
            WITH RECURSIVE hierarchy_depth AS (
                SELECT id, 0 as depth
                FROM users 
                WHERE role = 'super_agent'
                
                UNION ALL
                
                SELECT u.id, hd.depth + 1
                FROM users u
                JOIN user_hierarchy uh ON u.id = uh.user_id
                JOIN hierarchy_depth hd ON uh.parent_id = hd.id
            )
            SELECT MAX(depth) as max_depth, AVG(depth) as avg_depth
            FROM hierarchy_depth
        `);
        
        const referenceCodeStats = await pool.query(`
            SELECT 
                COUNT(*) as total_codes,
                COUNT(CASE WHEN is_active = true THEN 1 END) as active_codes,
                COUNT(CASE WHEN code_type = 'client_recruitment' THEN 1 END) as client_codes,
                COUNT(CASE WHEN code_type = 'agent_recruitment' THEN 1 END) as agent_codes,
                COUNT(CASE WHEN code_type = 'worker_recruitment' THEN 1 END) as worker_codes
            FROM reference_codes
        `);
        
        res.json({
            success: true,
            data: {
                user_statistics: stats.rows[0],
                hierarchy_depth: hierarchyDepth.rows[0],
                reference_code_statistics: referenceCodeStats.rows[0]
            }
        });
    } catch (error) {
        console.error('Error getting hierarchy statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get hierarchy statistics'
        });
    }
});

// Search users in hierarchy
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { query, role, hierarchy_level, limit = 20 } = req.query;
        
        if (!query || query.length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Search query must be at least 2 characters'
            });
        }
        
        let whereConditions = ['(u.full_name ILIKE $1 OR u.email ILIKE $1)'];
        let params = [`%${query}%`];
        let paramIndex = 2;
        
        if (role) {
            whereConditions.push(`u.role = $${paramIndex}`);
            params.push(role);
            paramIndex++;
        }
        
        if (hierarchy_level) {
            whereConditions.push(`uh.hierarchy_level = $${paramIndex}`);
            params.push(parseInt(hierarchy_level));
            paramIndex++;
        }
        
        // Role-based filtering
        if (req.user.role !== 'super_agent') {
            // Non-super agents can only search their subordinates
            whereConditions.push(`u.id IN (SELECT subordinate_id FROM get_user_subordinates($${paramIndex}))`);
            params.push(req.user.id);
            paramIndex++;
        }
        
        params.push(parseInt(limit));
        
        const result = await pool.query(`
            SELECT 
                u.id, u.full_name, u.email, u.role, u.created_at,
                uh.hierarchy_level, uh.parent_id,
                parent.full_name as parent_name,
                COUNT(p.id) as total_projects
            FROM users u
            LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
            LEFT JOIN users parent ON uh.parent_id = parent.id
            LEFT JOIN projects p ON (
                u.id = p.client_id OR u.id = p.agent_id OR u.id = p.sub_agent_id OR
                u.id = p.worker_id OR u.id = p.sub_worker_id
            )
            WHERE ${whereConditions.join(' AND ')} AND u.is_active = true
            GROUP BY u.id, u.full_name, u.email, u.role, u.created_at,
                     uh.hierarchy_level, uh.parent_id, parent.full_name
            ORDER BY u.full_name
            LIMIT $${paramIndex}
        `, params);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search users'
        });
    }
});

// Get hierarchy path for a user
router.get('/path/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const result = await pool.query(`
            WITH RECURSIVE hierarchy_path AS (
                -- Start with the target user
                SELECT 
                    u.id, u.full_name, u.role, 
                    uh.hierarchy_level, uh.parent_id,
                    0 as distance_from_target
                FROM users u
                LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
                WHERE u.id = $1
                
                UNION ALL
                
                -- Recursively get parents
                SELECT 
                    u.id, u.full_name, u.role,
                    uh.hierarchy_level, uh.parent_id,
                    hp.distance_from_target + 1
                FROM users u
                JOIN user_hierarchy uh ON u.id = uh.user_id
                JOIN hierarchy_path hp ON u.id = hp.parent_id
            )
            SELECT * FROM hierarchy_path
            ORDER BY distance_from_target DESC
        `, [userId]);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error getting hierarchy path:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get hierarchy path'
        });
    }
});

export default router;