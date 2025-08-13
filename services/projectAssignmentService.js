/**
 * Project Assignment Service
 * Handles hierarchy-based project assignments with validation and tracking
 */

import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

export class ProjectAssignmentService {
    /**
     * Assign a user to a project with hierarchy validation
     */
    static async assignUserToProject(projectId, assigneeId, assignmentType, assignerId, options = {}) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            const { assignmentReason, assignmentNotes } = options;
            
            // Validate the assignment using the database function
            const validationResult = await client.query(
                'SELECT * FROM track_project_assignment($1, $2, $3, $4, $5, $6)',
                [projectId, assigneeId, assignmentType, assignerId, assignmentReason, assignmentNotes]
            );
            
            const isValid = validationResult.rows[0]?.track_project_assignment;
            
            if (!isValid) {
                // Get the validation details
                const detailsResult = await client.query(
                    `SELECT validation_notes FROM project_assignment_history 
                     WHERE project_id = $1 AND assignment_type = $2 
                     ORDER BY assigned_at DESC LIMIT 1`,
                    [projectId, assignmentType]
                );
                
                const validationMessage = detailsResult.rows[0]?.validation_notes || 'Assignment validation failed';
                throw new Error(`Assignment validation failed: ${validationMessage}`);
            }
            
            await client.query('COMMIT');
            
            // Return the updated project with assignment details
            const projectResult = await client.query(
                `SELECT p.*, 
                        assignee.full_name as assignee_name,
                        assignee.role as assignee_role,
                        assigner.full_name as assigner_name,
                        assigner.role as assigner_role
                 FROM projects p
                 LEFT JOIN users assignee ON (
                    CASE 
                        WHEN $2 = 'worker' THEN p.worker_id = assignee.id
                        WHEN $2 = 'sub_worker' THEN p.sub_worker_id = assignee.id
                        WHEN $2 = 'agent' THEN p.agent_id = assignee.id
                        WHEN $2 = 'sub_agent' THEN p.sub_agent_id = assignee.id
                    END
                 )
                 LEFT JOIN users assigner ON p.assigned_by = assigner.id
                 WHERE p.id = $1`,
                [projectId, assignmentType]
            );
            
            return {
                success: true,
                project: projectResult.rows[0],
                assignmentType,
                message: 'Project assignment completed successfully'
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * Get assignment history for a project
     */
    static async getProjectAssignmentHistory(projectId) {
        try {
            const result = await pool.query(
                'SELECT * FROM get_project_assignment_history($1)',
                [projectId]
            );
            
            return result.rows;
        } catch (error) {
            throw new Error(`Failed to get assignment history: ${error.message}`);
        }
    }
    
    /**
     * Get projects with hierarchy information
     */
    static async getProjectsWithHierarchy(userId, userRole, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;
            
            const result = await pool.query(
                'SELECT * FROM get_projects_with_hierarchy($1, $2::user_role, $3, $4)',
                [userId, userRole, limit, offset]
            );
            
            return result.rows;
        } catch (error) {
            throw new Error(`Failed to get projects with hierarchy: ${error.message}`);
        }
    }
    
    /**
     * Validate assignment before making it
     */
    static async validateAssignment(assignerId, assignerRole, assigneeId, assigneeRole, assignmentType) {
        try {
            const result = await pool.query(
                'SELECT * FROM validate_project_assignment($1, $2::user_role, $3, $4::user_role, $5)',
                [assignerId, assignerRole, assigneeId, assigneeRole, assignmentType]
            );
            
            return result.rows[0];
        } catch (error) {
            throw new Error(`Failed to validate assignment: ${error.message}`);
        }
    }
    
    /**
     * Get available users for assignment based on hierarchy
     */
    static async getAvailableUsersForAssignment(assignerId, assignerRole, assignmentType) {
        try {
            let query = '';
            let params = [];
            
            switch (assignerRole) {
                case 'super_agent':
                    // Super agents can assign to anyone of appropriate role
                    if (assignmentType === 'worker' || assignmentType === 'sub_worker') {
                        query = `
                            SELECT u.id, u.full_name, u.email, u.role, uh.hierarchy_level
                            FROM users u
                            LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
                            WHERE u.role IN ('worker', 'super_worker')
                            ORDER BY uh.hierarchy_level, u.full_name
                        `;
                    } else if (assignmentType === 'agent' || assignmentType === 'sub_agent') {
                        query = `
                            SELECT u.id, u.full_name, u.email, u.role, uh.hierarchy_level
                            FROM users u
                            LEFT JOIN user_hierarchy uh ON u.id = uh.user_id
                            WHERE u.role IN ('agent', 'super_agent')
                            ORDER BY uh.hierarchy_level, u.full_name
                        `;
                    }
                    break;
                    
                case 'agent':
                    // Agents can assign to their subordinates
                    query = `
                        SELECT u.id, u.full_name, u.email, u.role, uh.hierarchy_level
                        FROM users u
                        JOIN user_hierarchy uh ON u.id = uh.user_id
                        WHERE u.id IN (
                            SELECT subordinate_id FROM get_user_subordinates($1)
                            WHERE subordinate_role IN ('worker', 'client')
                        )
                        ORDER BY uh.hierarchy_level, u.full_name
                    `;
                    params = [assignerId];
                    break;
                    
                case 'super_worker':
                    // Super workers can assign to their subordinate workers
                    query = `
                        SELECT u.id, u.full_name, u.email, u.role, uh.hierarchy_level
                        FROM users u
                        JOIN user_hierarchy uh ON u.id = uh.user_id
                        WHERE u.id IN (
                            SELECT subordinate_id FROM get_user_subordinates($1)
                            WHERE subordinate_role = 'worker'
                        )
                        ORDER BY uh.hierarchy_level, u.full_name
                    `;
                    params = [assignerId];
                    break;
                    
                default:
                    return []; // Workers and clients cannot assign
            }
            
            if (query) {
                const result = await pool.query(query, params);
                return result.rows;
            }
            
            return [];
        } catch (error) {
            throw new Error(`Failed to get available users: ${error.message}`);
        }
    }
    
    /**
     * Update project with multiple project numbers
     */
    static async updateProjectNumbers(projectId, projectNumbers, updatedBy) {
        try {
            const result = await pool.query(
                `UPDATE projects 
                 SET project_numbers = $1, updated_at = NOW(), assigned_by = $3
                 WHERE id = $2
                 RETURNING *`,
                [projectNumbers, projectId, updatedBy]
            );
            
            if (result.rows.length === 0) {
                throw new Error('Project not found');
            }
            
            return result.rows[0];
        } catch (error) {
            throw new Error(`Failed to update project numbers: ${error.message}`);
        }
    }
    
    /**
     * Get assignment statistics for a user
     */
    static async getAssignmentStatistics(userId, userRole) {
        try {
            let query = '';
            let params = [userId];
            
            switch (userRole) {
                case 'super_agent':
                    query = `
                        SELECT 
                            COUNT(*) as total_projects,
                            COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_projects,
                            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
                            COUNT(DISTINCT worker_id) + COUNT(DISTINCT sub_worker_id) as assigned_workers,
                            COUNT(DISTINCT agent_id) + COUNT(DISTINCT sub_agent_id) as assigned_agents
                        FROM projects
                    `;
                    params = [];
                    break;
                    
                case 'agent':
                    query = `
                        SELECT 
                            COUNT(*) as total_projects,
                            COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_projects,
                            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
                            COUNT(DISTINCT worker_id) + COUNT(DISTINCT sub_worker_id) as assigned_workers,
                            0 as assigned_agents
                        FROM projects
                        WHERE agent_id = $1 OR sub_agent_id = $1
                    `;
                    break;
                    
                case 'super_worker':
                    query = `
                        SELECT 
                            COUNT(*) as total_projects,
                            COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_projects,
                            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
                            COUNT(DISTINCT worker_id) as assigned_workers,
                            0 as assigned_agents
                        FROM projects
                        WHERE sub_worker_id = $1
                    `;
                    break;
                    
                default:
                    query = `
                        SELECT 
                            COUNT(*) as total_projects,
                            COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_projects,
                            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
                            0 as assigned_workers,
                            0 as assigned_agents
                        FROM projects
                        WHERE client_id = $1 OR worker_id = $1 OR sub_worker_id = $1
                    `;
            }
            
            const result = await pool.query(query, params);
            return result.rows[0];
        } catch (error) {
            throw new Error(`Failed to get assignment statistics: ${error.message}`);
        }
    }
    
    /**
     * Bulk assign multiple users to a project
     */
    static async bulkAssignToProject(projectId, assignments, assignerId) {
        const client = await pool.connect();
        const results = [];
        
        try {
            await client.query('BEGIN');
            
            for (const assignment of assignments) {
                const { assigneeId, assignmentType, assignmentReason, assignmentNotes } = assignment;
                
                try {
                    const result = await this.assignUserToProject(
                        projectId, assigneeId, assignmentType, assignerId,
                        { assignmentReason, assignmentNotes }
                    );
                    results.push({ ...result, assigneeId, assignmentType });
                } catch (error) {
                    results.push({
                        success: false,
                        assigneeId,
                        assignmentType,
                        error: error.message
                    });
                }
            }
            
            await client.query('COMMIT');
            return results;
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    /**
     * Get project assignment recommendations based on hierarchy and workload
     */
    static async getAssignmentRecommendations(projectId, assignmentType, assignerId) {
        try {
            // Get available users
            const assignerResult = await pool.query('SELECT role FROM users WHERE id = $1', [assignerId]);
            const assignerRole = assignerResult.rows[0]?.role;
            
            if (!assignerRole) {
                throw new Error('Assigner not found');
            }
            
            const availableUsers = await this.getAvailableUsersForAssignment(assignerId, assignerRole, assignmentType);
            
            // Get workload for each user
            const recommendations = [];
            
            for (const user of availableUsers) {
                const workloadResult = await pool.query(
                    `SELECT COUNT(*) as current_projects
                     FROM projects 
                     WHERE (worker_id = $1 OR sub_worker_id = $1 OR agent_id = $1 OR sub_agent_id = $1)
                       AND status IN ('pending', 'in_progress')`,
                    [user.id]
                );
                
                const currentProjects = parseInt(workloadResult.rows[0].current_projects);
                
                recommendations.push({
                    ...user,
                    current_projects: currentProjects,
                    recommendation_score: this.calculateRecommendationScore(user, currentProjects),
                    workload_status: this.getWorkloadStatus(currentProjects)
                });
            }
            
            // Sort by recommendation score (higher is better)
            recommendations.sort((a, b) => b.recommendation_score - a.recommendation_score);
            
            return recommendations;
        } catch (error) {
            throw new Error(`Failed to get assignment recommendations: ${error.message}`);
        }
    }
    
    /**
     * Calculate recommendation score for user assignment
     */
    static calculateRecommendationScore(user, currentProjects) {
        let score = 100; // Base score
        
        // Reduce score based on current workload
        score -= currentProjects * 10;
        
        // Bonus for higher hierarchy level (more experienced)
        if (user.hierarchy_level) {
            score += (5 - user.hierarchy_level) * 5; // Lower level number = higher hierarchy
        }
        
        // Ensure score doesn't go below 0
        return Math.max(0, score);
    }
    
    /**
     * Get workload status description
     */
    static getWorkloadStatus(currentProjects) {
        if (currentProjects === 0) return 'available';
        if (currentProjects <= 2) return 'light';
        if (currentProjects <= 5) return 'moderate';
        if (currentProjects <= 8) return 'heavy';
        return 'overloaded';
    }
}

export default ProjectAssignmentService;