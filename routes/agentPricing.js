import express from 'express';
import { Pool } from 'pg';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';

const router = express.Router();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Get current agent's pricing configuration
router.get('/current', authenticateToken, requirePermission('view_agent_pricing'), async (req, res) => {
    try {
        const agentId = req.user.id;

        const result = await pool.query(
            'SELECT * FROM agent_pricing WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 1',
            [agentId]
        );

        if (result.rows.length === 0) {
            // Return default pricing if none configured
            return res.json({
                success: true,
                data: {
                    min_word_count: 500,
                    max_word_count: 20000,
                    base_rate_per_500_words: 6.25,
                    agent_fee_percentage: 15.0
                }
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching agent pricing:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch agent pricing configuration'
        });
    }
});

// Update current agent's pricing configuration
router.put('/current', authenticateToken, requirePermission('manage_agent_pricing'), async (req, res) => {
    try {
        const agentId = req.user.id;
        const { min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage, change_reason } = req.body;

        // Validate input
        if (min_word_count < 500 || max_word_count > 20000 || min_word_count >= max_word_count) {
            return res.status(400).json({
                success: false,
                error: 'Invalid word count range. Must be between 500-20,000 words with min < max.'
            });
        }

        if (base_rate_per_500_words <= 0 || agent_fee_percentage < 0 || agent_fee_percentage > 100) {
            return res.status(400).json({
                success: false,
                error: 'Invalid pricing values. Base rate must be positive and fee percentage between 0-100.'
            });
        }

        // Check if pricing configuration already exists
        const existingResult = await pool.query(
            'SELECT id FROM agent_pricing WHERE agent_id = $1',
            [agentId]
        );

        let result;
        if (existingResult.rows.length > 0) {
            // Update existing configuration with change tracking
            result = await pool.query(
                `UPDATE agent_pricing 
                 SET min_word_count = $1, max_word_count = $2, base_rate_per_500_words = $3, 
                     agent_fee_percentage = $4, updated_at = CURRENT_TIMESTAMP, updated_by = $6
                 WHERE agent_id = $5
                 RETURNING *`,
                [min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage, agentId, req.user.id]
            );
        } else {
            // Create new configuration
            result = await pool.query(
                `INSERT INTO agent_pricing (agent_id, min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage, updated_by)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [agentId, min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage, req.user.id]
            );
        }

        // If change reason provided, update the latest history record
        if (change_reason) {
            await pool.query(
                `UPDATE agent_pricing_history 
                 SET change_reason = $1 
                 WHERE agent_id = $2 AND effective_until IS NULL`,
                [change_reason, agentId]
            );
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Pricing configuration updated successfully'
        });
    } catch (error) {
        console.error('Error updating agent pricing:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update agent pricing configuration'
        });
    }
});

// Get specific agent's pricing configuration (for Super Agent)
router.get('/:agentId', authenticateToken, requirePermission('view_all_agent_pricing'), async (req, res) => {
    try {
        const { agentId } = req.params;

        const result = await pool.query(
            'SELECT * FROM agent_pricing WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 1',
            [agentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No pricing configuration found for this agent'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching agent pricing:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch agent pricing configuration'
        });
    }
});

// Set pricing for specific agent (for Super Agent)
router.put('/:agentId', authenticateToken, requirePermission('manage_all_agent_pricing'), async (req, res) => {
    try {
        const { agentId } = req.params;
        const { min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage } = req.body;

        // Validate input
        if (min_word_count < 500 || max_word_count > 20000 || min_word_count >= max_word_count) {
            return res.status(400).json({
                success: false,
                error: 'Invalid word count range. Must be between 500-20,000 words with min < max.'
            });
        }

        if (base_rate_per_500_words <= 0 || agent_fee_percentage < 0 || agent_fee_percentage > 100) {
            return res.status(400).json({
                success: false,
                error: 'Invalid pricing values. Base rate must be positive and fee percentage between 0-100.'
            });
        }

        // Check if pricing configuration already exists
        const existingResult = await pool.query(
            'SELECT id FROM agent_pricing WHERE agent_id = $1',
            [agentId]
        );

        let result;
        if (existingResult.rows.length > 0) {
            // Update existing configuration
            result = await pool.query(
                `UPDATE agent_pricing 
                 SET min_word_count = $1, max_word_count = $2, base_rate_per_500_words = $3, 
                     agent_fee_percentage = $4, updated_at = CURRENT_TIMESTAMP
                 WHERE agent_id = $5
                 RETURNING *`,
                [min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage, agentId]
            );
        } else {
            // Create new configuration
            result = await pool.query(
                `INSERT INTO agent_pricing (agent_id, min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [agentId, min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage]
            );
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating agent pricing:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update agent pricing configuration'
        });
    }
});

// Get agent statistics including fees owed to Super Agent
router.get('/stats/current', authenticateToken, requirePermission('view_agent_pricing'), async (req, res) => {
    try {
        const agentId = req.user.id;

        // Get agent's completed projects
        const projectsResult = await pool.query(
            `SELECT p.*, ap.base_rate_per_500_words, ap.agent_fee_percentage
             FROM projects p
             LEFT JOIN agent_pricing ap ON ap.agent_id = p.agent_id
             WHERE (p.agent_id = $1 OR p.sub_agent_id = $1) AND p.status = 'completed'`,
            [agentId]
        );

        const projects = projectsResult.rows;
        let totalRevenue = 0;
        let totalFeesOwed = 0;
        let totalAgentProfit = 0;

        projects.forEach(project => {
            const wordCount = project.adjusted_word_count || project.initial_word_count;
            const baseRate = project.base_rate_per_500_words || 6.25;
            const feePercentage = project.agent_fee_percentage || 15.0;

            const baseCost = (wordCount / 500) * baseRate;
            const agentFee = baseCost * (feePercentage / 100);
            const agentProfit = project.cost_gbp - baseCost - agentFee;

            totalRevenue += project.cost_gbp;
            totalFeesOwed += agentFee;
            totalAgentProfit += agentProfit;
        });

        res.json({
            success: true,
            data: {
                total_projects: projects.length,
                total_revenue: totalRevenue,
                total_fees_owed_to_super_agent: totalFeesOwed,
                total_agent_profit: totalAgentProfit,
                projects_this_month: projects.filter(p => {
                    const projectDate = new Date(p.created_at);
                    const now = new Date();
                    return projectDate.getMonth() === now.getMonth() && 
                           projectDate.getFullYear() === now.getFullYear();
                }).length
            }
        });
    } catch (error) {
        console.error('Error fetching agent stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch agent statistics'
        });
    }
});

// Get pricing history for current agent
router.get('/history/current', authenticateToken, requirePermission('view_agent_pricing'), async (req, res) => {
    try {
        const agentId = req.user.id;
        const { limit = 10, offset = 0 } = req.query;

        const result = await pool.query(
            `SELECT aph.*, u.full_name as changed_by_name
             FROM agent_pricing_history aph
             LEFT JOIN users u ON aph.changed_by = u.id
             WHERE aph.agent_id = $1
             ORDER BY aph.created_at DESC
             LIMIT $2 OFFSET $3`,
            [agentId, parseInt(limit), parseInt(offset)]
        );

        const countResult = await pool.query(
            'SELECT COUNT(*) as total FROM agent_pricing_history WHERE agent_id = $1',
            [agentId]
        );

        res.json({
            success: true,
            data: {
                history: result.rows,
                total: parseInt(countResult.rows[0].total),
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    } catch (error) {
        console.error('Error fetching pricing history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch pricing history'
        });
    }
});

// Get pricing history for specific agent (Super Agent only)
router.get('/history/:agentId', authenticateToken, requirePermission('view_all_agent_pricing'), async (req, res) => {
    try {
        const { agentId } = req.params;
        const { limit = 10, offset = 0 } = req.query;

        const result = await pool.query(
            `SELECT aph.*, u.full_name as changed_by_name
             FROM agent_pricing_history aph
             LEFT JOIN users u ON aph.changed_by = u.id
             WHERE aph.agent_id = $1
             ORDER BY aph.created_at DESC
             LIMIT $2 OFFSET $3`,
            [agentId, parseInt(limit), parseInt(offset)]
        );

        const countResult = await pool.query(
            'SELECT COUNT(*) as total FROM agent_pricing_history WHERE agent_id = $1',
            [agentId]
        );

        res.json({
            success: true,
            data: {
                history: result.rows,
                total: parseInt(countResult.rows[0].total),
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    } catch (error) {
        console.error('Error fetching pricing history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch pricing history'
        });
    }
});

// Dynamic pricing calculator
router.post('/calculate', authenticateToken, async (req, res) => {
    try {
        const { word_count, agent_id } = req.body;

        if (!word_count || word_count <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid word count is required'
            });
        }

        // Use provided agent_id or current user's id
        const targetAgentId = agent_id || req.user.id;

        // Get agent's pricing configuration
        const pricingResult = await pool.query(
            'SELECT * FROM agent_pricing WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 1',
            [targetAgentId]
        );

        let pricing;
        if (pricingResult.rows.length === 0) {
            // Use default pricing
            pricing = {
                min_word_count: 500,
                max_word_count: 20000,
                base_rate_per_500_words: 6.25,
                agent_fee_percentage: 15.0
            };
        } else {
            pricing = pricingResult.rows[0];
        }

        // Validate word count against agent's range
        if (word_count < pricing.min_word_count || word_count > pricing.max_word_count) {
            return res.status(400).json({
                success: false,
                error: `Word count must be between ${pricing.min_word_count} and ${pricing.max_word_count} for this agent`
            });
        }

        // Calculate pricing breakdown
        const baseUnits = Math.ceil(word_count / 500); // Round up to nearest 500-word unit
        const baseCost = baseUnits * pricing.base_rate_per_500_words;
        const agentFee = baseCost * (pricing.agent_fee_percentage / 100);
        const totalCost = baseCost + agentFee;

        // Calculate Super Worker and Worker fees (standard structure)
        const superWorkerFee = baseCost; // Super Worker gets the base cost
        const workerFee = baseCost; // Worker also gets the base cost
        const totalWithWorkerFees = totalCost + superWorkerFee + workerFee;

        res.json({
            success: true,
            data: {
                word_count: word_count,
                base_units: baseUnits,
                pricing_breakdown: {
                    base_cost: parseFloat(baseCost.toFixed(2)),
                    agent_fee: parseFloat(agentFee.toFixed(2)),
                    super_worker_fee: parseFloat(superWorkerFee.toFixed(2)),
                    worker_fee: parseFloat(workerFee.toFixed(2)),
                    client_total: parseFloat(totalCost.toFixed(2)),
                    system_total: parseFloat(totalWithWorkerFees.toFixed(2))
                },
                pricing_config: {
                    base_rate_per_500_words: pricing.base_rate_per_500_words,
                    agent_fee_percentage: pricing.agent_fee_percentage,
                    min_word_count: pricing.min_word_count,
                    max_word_count: pricing.max_word_count
                }
            }
        });
    } catch (error) {
        console.error('Error calculating pricing:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to calculate pricing'
        });
    }
});

// Validate pricing configuration
router.post('/validate', authenticateToken, async (req, res) => {
    try {
        const { min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage } = req.body;

        const validation = {
            valid: true,
            errors: [],
            warnings: []
        };

        // Validate word count range
        if (min_word_count < 500) {
            validation.valid = false;
            validation.errors.push('Minimum word count must be at least 500');
        }

        if (max_word_count > 20000) {
            validation.valid = false;
            validation.errors.push('Maximum word count cannot exceed 20,000');
        }

        if (min_word_count >= max_word_count) {
            validation.valid = false;
            validation.errors.push('Minimum word count must be less than maximum word count');
        }

        // Validate rates
        if (base_rate_per_500_words <= 0) {
            validation.valid = false;
            validation.errors.push('Base rate must be positive');
        }

        if (agent_fee_percentage < 0 || agent_fee_percentage > 100) {
            validation.valid = false;
            validation.errors.push('Agent fee percentage must be between 0 and 100');
        }

        // Add warnings for unusual values
        if (base_rate_per_500_words < 5.0) {
            validation.warnings.push('Base rate is unusually low (below £5.00 per 500 words)');
        }

        if (base_rate_per_500_words > 15.0) {
            validation.warnings.push('Base rate is unusually high (above £15.00 per 500 words)');
        }

        if (agent_fee_percentage > 25.0) {
            validation.warnings.push('Agent fee percentage is unusually high (above 25%)');
        }

        res.json({
            success: true,
            data: validation
        });
    } catch (error) {
        console.error('Error validating pricing:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate pricing configuration'
        });
    }
});

// Get all agents' pricing overview (Super Agent only)
router.get('/overview', authenticateToken, requirePermission('view_all_agent_pricing'), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                u.id, u.full_name, u.email, u.role,
                ap.min_word_count, ap.max_word_count, 
                ap.base_rate_per_500_words, ap.agent_fee_percentage,
                ap.created_at as pricing_created_at,
                ap.updated_at as pricing_updated_at,
                COUNT(p.id) as total_projects,
                COALESCE(SUM(p.cost_gbp), 0) as total_revenue
             FROM users u
             LEFT JOIN agent_pricing ap ON u.id = ap.agent_id
             LEFT JOIN projects p ON (u.id = p.agent_id OR u.id = p.sub_agent_id)
             WHERE u.role IN ('agent', 'super_agent')
             GROUP BY u.id, u.full_name, u.email, u.role, ap.min_word_count, 
                      ap.max_word_count, ap.base_rate_per_500_words, 
                      ap.agent_fee_percentage, ap.created_at, ap.updated_at
             ORDER BY u.full_name`
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching pricing overview:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch pricing overview'
        });
    }
});

export default router;