/**
 * Agent Pricing Service
 * Handles all agent pricing-related business logic
 */

import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

export class AgentPricingService {
    /**
     * Get agent's current pricing configuration
     */
    static async getAgentPricing(agentId) {
        try {
            const result = await pool.query(
                'SELECT * FROM agent_pricing WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 1',
                [agentId]
            );

            if (result.rows.length === 0) {
                // Return default pricing
                return {
                    agent_id: agentId,
                    min_word_count: 500,
                    max_word_count: 20000,
                    base_rate_per_500_words: 6.25,
                    agent_fee_percentage: 15.0,
                    is_default: true
                };
            }

            return {
                ...result.rows[0],
                is_default: false
            };
        } catch (error) {
            throw new Error(`Failed to get agent pricing: ${error.message}`);
        }
    }

    /**
     * Calculate pricing for a given word count and agent
     */
    static async calculatePricing(wordCount, agentId) {
        try {
            const pricing = await this.getAgentPricing(agentId);

            // Validate word count
            if (wordCount < pricing.min_word_count || wordCount > pricing.max_word_count) {
                throw new Error(`Word count must be between ${pricing.min_word_count} and ${pricing.max_word_count}`);
            }

            // Calculate base units (round up to nearest 500-word unit)
            const baseUnits = Math.ceil(wordCount / 500);
            
            // Calculate costs
            const baseCost = baseUnits * pricing.base_rate_per_500_words;
            const agentFee = baseCost * (pricing.agent_fee_percentage / 100);
            const clientTotal = baseCost + agentFee;

            // Standard worker fees (as per system design)
            const superWorkerFee = baseCost;
            const workerFee = baseCost;
            const systemTotal = clientTotal + superWorkerFee + workerFee;

            return {
                word_count: wordCount,
                base_units: baseUnits,
                breakdown: {
                    base_cost: parseFloat(baseCost.toFixed(2)),
                    agent_fee: parseFloat(agentFee.toFixed(2)),
                    super_worker_fee: parseFloat(superWorkerFee.toFixed(2)),
                    worker_fee: parseFloat(workerFee.toFixed(2)),
                    client_total: parseFloat(clientTotal.toFixed(2)),
                    system_total: parseFloat(systemTotal.toFixed(2))
                },
                pricing_config: {
                    base_rate_per_500_words: pricing.base_rate_per_500_words,
                    agent_fee_percentage: pricing.agent_fee_percentage,
                    is_default: pricing.is_default
                }
            };
        } catch (error) {
            throw new Error(`Failed to calculate pricing: ${error.message}`);
        }
    }

    /**
     * Update agent pricing configuration
     */
    static async updateAgentPricing(agentId, pricingData, updatedBy, changeReason = null) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const { min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage } = pricingData;

            // Validate pricing data
            const validation = this.validatePricingData(pricingData);
            if (!validation.valid) {
                throw new Error(`Invalid pricing data: ${validation.errors.join(', ')}`);
            }

            // Check if pricing configuration exists
            const existingResult = await client.query(
                'SELECT id FROM agent_pricing WHERE agent_id = $1',
                [agentId]
            );

            let result;
            if (existingResult.rows.length > 0) {
                // Update existing configuration
                result = await client.query(
                    `UPDATE agent_pricing 
                     SET min_word_count = $1, max_word_count = $2, base_rate_per_500_words = $3, 
                         agent_fee_percentage = $4, updated_at = CURRENT_TIMESTAMP, updated_by = $6
                     WHERE agent_id = $5
                     RETURNING *`,
                    [min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage, agentId, updatedBy]
                );
            } else {
                // Create new configuration
                result = await client.query(
                    `INSERT INTO agent_pricing (agent_id, min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage, updated_by)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING *`,
                    [agentId, min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage, updatedBy]
                );
            }

            // Update change reason in history if provided
            if (changeReason) {
                await client.query(
                    `UPDATE agent_pricing_history 
                     SET change_reason = $1 
                     WHERE agent_id = $2 AND effective_until IS NULL`,
                    [changeReason, agentId]
                );
            }

            await client.query('COMMIT');
            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get pricing history for an agent
     */
    static async getPricingHistory(agentId, limit = 10, offset = 0) {
        try {
            const result = await pool.query(
                `SELECT aph.*, u.full_name as changed_by_name
                 FROM agent_pricing_history aph
                 LEFT JOIN users u ON aph.changed_by = u.id
                 WHERE aph.agent_id = $1
                 ORDER BY aph.created_at DESC
                 LIMIT $2 OFFSET $3`,
                [agentId, limit, offset]
            );

            const countResult = await pool.query(
                'SELECT COUNT(*) as total FROM agent_pricing_history WHERE agent_id = $1',
                [agentId]
            );

            return {
                history: result.rows,
                total: parseInt(countResult.rows[0].total),
                limit,
                offset
            };
        } catch (error) {
            throw new Error(`Failed to get pricing history: ${error.message}`);
        }
    }

    /**
     * Validate pricing configuration data
     */
    static validatePricingData(pricingData) {
        const { min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage } = pricingData;
        
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

        return validation;
    }

    /**
     * Get agent statistics including revenue and fees
     */
    static async getAgentStatistics(agentId) {
        try {
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

            // Get projects this month
            const thisMonthProjects = projects.filter(p => {
                const projectDate = new Date(p.created_at);
                const now = new Date();
                return projectDate.getMonth() === now.getMonth() && 
                       projectDate.getFullYear() === now.getFullYear();
            });

            return {
                total_projects: projects.length,
                total_revenue: parseFloat(totalRevenue.toFixed(2)),
                total_fees_owed_to_super_agent: parseFloat(totalFeesOwed.toFixed(2)),
                total_agent_profit: parseFloat(totalAgentProfit.toFixed(2)),
                projects_this_month: thisMonthProjects.length,
                average_project_value: projects.length > 0 ? parseFloat((totalRevenue / projects.length).toFixed(2)) : 0
            };
        } catch (error) {
            throw new Error(`Failed to get agent statistics: ${error.message}`);
        }
    }

    /**
     * Get pricing overview for all agents (Super Agent only)
     */
    static async getAllAgentsPricingOverview() {
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

            return result.rows.map(row => ({
                ...row,
                total_revenue: parseFloat(row.total_revenue),
                has_custom_pricing: row.base_rate_per_500_words !== null
            }));
        } catch (error) {
            throw new Error(`Failed to get pricing overview: ${error.message}`);
        }
    }

    /**
     * Generate pricing recommendations based on agent performance
     */
    static async generatePricingRecommendations(agentId) {
        try {
            const stats = await this.getAgentStatistics(agentId);
            const currentPricing = await this.getAgentPricing(agentId);
            
            const recommendations = [];

            // Analyze performance metrics
            if (stats.total_projects > 10 && stats.average_project_value > 50) {
                if (currentPricing.base_rate_per_500_words < 7.0) {
                    recommendations.push({
                        type: 'rate_increase',
                        message: 'Consider increasing base rate due to strong performance',
                        suggested_rate: Math.min(currentPricing.base_rate_per_500_words + 0.5, 8.0),
                        reason: 'High project volume and value indicate market acceptance'
                    });
                }
            }

            if (stats.total_projects < 5 && currentPricing.base_rate_per_500_words > 7.0) {
                recommendations.push({
                    type: 'rate_decrease',
                    message: 'Consider lowering base rate to attract more clients',
                    suggested_rate: Math.max(currentPricing.base_rate_per_500_words - 0.25, 6.0),
                    reason: 'Low project volume may indicate pricing is too high'
                });
            }

            if (currentPricing.agent_fee_percentage < 10) {
                recommendations.push({
                    type: 'fee_adjustment',
                    message: 'Agent fee percentage is quite low',
                    suggested_fee: 15.0,
                    reason: 'Standard agent fee is typically 15-20%'
                });
            }

            return {
                agent_id: agentId,
                current_pricing: currentPricing,
                performance_stats: stats,
                recommendations
            };
        } catch (error) {
            throw new Error(`Failed to generate pricing recommendations: ${error.message}`);
        }
    }
}

export default AgentPricingService;