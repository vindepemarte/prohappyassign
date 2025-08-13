import express from 'express';
import { Pool } from 'pg';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import ProjectAssignmentService from '../services/projectAssignmentService.js';

const router = express.Router();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Assign user to project
router.post('/assign', authenticateToken, requirePermission('assign_projects'), async (req, res) => {
    try {
        const { projectId, assigneeId, assignmentType, assignmentReason, assignmentNotes } = req.body;
        
        if (!projectId || !assigneeId || !assignmentType) {
            return res.status(400).json({
                success: false,
                error: 'Project ID, assignee ID, and assignment type are required'
            });
        }
        
        if (!['worker', 'sub_worker', 'agent', 'sub_agent'].includes(assignmentType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid assignment type. Must be: worker, sub_worker, agent, or sub_agent'
            });
        }
        
        const result = await ProjectAssignmentService.assignUserToProject(
            projectId, assigneeId, assignmentType, req.user.id,
            { assignmentReason, assignmentNotes }
        );
        
        res.json(result);
    } catch (error) {
        console.error('Error assigning user to project:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Bulk assign multiple users to project
router.post('/bulk-assign', authenticateToken, requirePermission('assign_projects'), async (req, res) => {
    try {
        const { projectId, assignments } = req.body;
        
        if (!projectId || !Array.isArray(assignments) || assignments.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Project ID and assignments array are required'
            });
        }
        
        const results = await ProjectAssignmentService.bulkAssignToProject(
            projectId, assignments, req.user.id
        );
        
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;
        
        res.json({
            success: true,
            data: results,
            summary: {
                total: results.length,
                successful: successCount,
                failed: failureCount
            }
        });
    } catch (error) {
        console.error('Error bulk assigning users to project:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get assignment history for a project
router.get('/history/:projectId', authenticateToken, requirePermission('view_project_assignments'), async (req, res) => {
    try {
        const { projectId } = req.params;
        
        const history = await ProjectAssignmentService.getProjectAssignmentHistory(projectId);
        
        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        console.error('Error getting assignment history:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get projects with hierarchy information
router.get('/projects-with-hierarchy', authenticateToken, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        
        const projects = await ProjectAssignmentService.getProjectsWithHierarchy(
            req.user.id, req.user.role, 
            { limit: parseInt(limit), offset: parseInt(offset) }
        );
        
        res.json({
            success: true,
            data: projects,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: projects.length
            }
        });
    } catch (error) {
        console.error('Error getting projects with hierarchy:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Validate assignment before making it
router.post('/validate', authenticateToken, async (req, res) => {
    try {
        const { assigneeId, assigneeRole, assignmentType } = req.body;
        
        if (!assigneeId || !assigneeRole || !assignmentType) {
            return res.status(400).json({
                success: false,
                error: 'Assignee ID, role, and assignment type are required'
            });
        }
        
        const validation = await ProjectAssignmentService.validateAssignment(
            req.user.id, req.user.role, assigneeId, assigneeRole, assignmentType
        );
        
        res.json({
            success: true,
            data: validation
        });
    } catch (error) {
        console.error('Error validating assignment:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get available users for assignment
router.get('/available-users/:assignmentType', authenticateToken, async (req, res) => {
    try {
        const { assignmentType } = req.params;
        
        if (!['worker', 'sub_worker', 'agent', 'sub_agent'].includes(assignmentType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid assignment type'
            });
        }
        
        const users = await ProjectAssignmentService.getAvailableUsersForAssignment(
            req.user.id, req.user.role, assignmentType
        );
        
        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('Error getting available users:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get assignment recommendations
router.get('/recommendations/:projectId/:assignmentType', authenticateToken, async (req, res) => {
    try {
        const { projectId, assignmentType } = req.params;
        
        const recommendations = await ProjectAssignmentService.getAssignmentRecommendations(
            projectId, assignmentType, req.user.id
        );
        
        res.json({
            success: true,
            data: recommendations
        });
    } catch (error) {
        console.error('Error getting assignment recommendations:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get assignment statistics
router.get('/statistics', authenticateToken, async (req, res) => {
    try {
        const statistics = await ProjectAssignmentService.getAssignmentStatistics(
            req.user.id, req.user.role
        );
        
        res.json({
            success: true,
            data: statistics
        });
    } catch (error) {
        console.error('Error getting assignment statistics:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update project numbers
router.put('/project-numbers/:projectId', authenticateToken, requirePermission('edit_projects'), async (req, res) => {
    try {
        const { projectId } = req.params;
        const { projectNumbers } = req.body;
        
        if (!Array.isArray(projectNumbers)) {
            return res.status(400).json({
                success: false,
                error: 'Project numbers must be an array'
            });
        }
        
        const updatedProject = await ProjectAssignmentService.updateProjectNumbers(
            projectId, projectNumbers, req.user.id
        );
        
        res.json({
            success: true,
            data: updatedProject
        });
    } catch (error) {
        console.error('Error updating project numbers:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get project assignment summary
router.get('/summary/:projectId', authenticateToken, requirePermission('view_project_assignments'), async (req, res) => {
    try {
        const { projectId } = req.params;
        
        // Get project with all assignment information
        const projectResult = await pool.query(`
            SELECT 
                p.*,
                client.full_name as client_name,
                agent.full_name as agent_name,
                sub_agent.full_name as sub_agent_name,
                worker.full_name as worker_name,
                sub_worker.full_name as sub_worker_name,
                assigned_by.full_name as assigned_by_name
            FROM projects p
            LEFT JOIN users client ON p.client_id = client.id
            LEFT JOIN users agent ON p.agent_id = agent.id
            LEFT JOIN users sub_agent ON p.sub_agent_id = sub_agent.id
            LEFT JOIN users worker ON p.worker_id = worker.id
            LEFT JOIN users sub_worker ON p.sub_worker_id = sub_worker.id
            LEFT JOIN users assigned_by ON p.assigned_by = assigned_by.id
            WHERE p.id = $1
        `, [projectId]);
        
        if (projectResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }
        
        const project = projectResult.rows[0];
        
        // Get assignment history
        const history = await ProjectAssignmentService.getProjectAssignmentHistory(projectId);
        
        // Get assignment statistics
        const statsResult = await pool.query(`
            SELECT 
                COUNT(*) as total_assignments,
                COUNT(CASE WHEN is_valid_hierarchy = true THEN 1 END) as valid_assignments,
                COUNT(CASE WHEN is_valid_hierarchy = false THEN 1 END) as invalid_assignments,
                COUNT(DISTINCT assigned_to_id) as unique_assignees,
                COUNT(DISTINCT assigned_by_id) as unique_assigners
            FROM project_assignment_history
            WHERE project_id = $1
        `, [projectId]);
        
        const stats = statsResult.rows[0];
        
        res.json({
            success: true,
            data: {
                project,
                assignment_history: history,
                assignment_statistics: stats
            }
        });
    } catch (error) {
        console.error('Error getting project assignment summary:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;