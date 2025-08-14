/**
 * Analytics Service
 * Handles earnings calculations for Super Agent, Agent, and Super Worker roles
 */

import { Pool } from 'pg';

// Import constants with fallback
let GBP_TO_INR_RATE, WORKER_PAY_RATE_PER_500_WORDS;

try {
  const constants = await import('../constants.js');
  GBP_TO_INR_RATE = constants.GBP_TO_INR_RATE;
  WORKER_PAY_RATE_PER_500_WORDS = constants.WORKER_PAY_RATE_PER_500_WORDS;
} catch (error) {
  GBP_TO_INR_RATE = 105.50;
  WORKER_PAY_RATE_PER_500_WORDS = 6.25;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

export class AnalyticsService {
  /**
   * Calculate Super Worker earnings and analytics
   */
  static async calculateSuperWorkerAnalytics(superWorkerId, startDate = null, endDate = null) {
    try {
      let dateFilter = '';
      const params = [superWorkerId];
      
      if (startDate && endDate) {
        dateFilter = 'AND p.created_at BETWEEN $2 AND $3';
        params.push(startDate, endDate);
      }

      // Get completed projects assigned to this Super Worker
      const projectsResult = await pool.query(`
        SELECT 
          p.id,
          p.title,
          p.initial_word_count,
          p.adjusted_word_count,
          p.cost_gbp,
          p.created_at,
          p.completed_at,
          p.pricing_type,
          p.super_worker_fee_gbp
        FROM projects p
        WHERE p.super_worker_id = $1 
        AND p.status = 'completed'
        ${dateFilter}
        ORDER BY p.completed_at DESC
      `, params);

      const projects = projectsResult.rows;
      let totalEarningsGBP = 0;
      let totalWordCount = 0;

      // Calculate earnings for each project
      const projectEarnings = projects.map(project => {
        const wordCount = project.adjusted_word_count || project.initial_word_count;
        const wordUnits = Math.ceil(wordCount / 500);
        const earningsGBP = wordUnits * WORKER_PAY_RATE_PER_500_WORDS;
        const earningsINR = earningsGBP * GBP_TO_INR_RATE;

        totalEarningsGBP += earningsGBP;
        totalWordCount += wordCount;

        return {
          project_id: project.id,
          project_title: project.title,
          word_count: wordCount,
          word_units: wordUnits,
          earnings_gbp: parseFloat(earningsGBP.toFixed(2)),
          earnings_inr: parseFloat(earningsINR.toFixed(2)),
          completed_at: project.completed_at
        };
      });

      const totalEarningsINR = totalEarningsGBP * GBP_TO_INR_RATE;
      const totalWordUnits = Math.ceil(totalWordCount / 500);

      return {
        super_worker_id: superWorkerId,
        period: {
          start_date: startDate,
          end_date: endDate
        },
        summary: {
          total_projects: projects.length,
          total_word_count: totalWordCount,
          total_word_units: totalWordUnits,
          total_earnings_gbp: parseFloat(totalEarningsGBP.toFixed(2)),
          total_earnings_inr: parseFloat(totalEarningsINR.toFixed(2)),
          rate_per_500_words_gbp: WORKER_PAY_RATE_PER_500_WORDS,
          exchange_rate_gbp_to_inr: GBP_TO_INR_RATE
        },
        project_earnings: projectEarnings
      };
    } catch (error) {
      console.error('Error calculating Super Worker analytics:', error);
      throw new Error('Failed to calculate Super Worker analytics');
    }
  }

  /**
   * Calculate Super Agent analytics (revenue minus all fees)
   */
  static async calculateSuperAgentAnalytics(superAgentId, startDate = null, endDate = null) {
    try {
      let dateFilter = '';
      const params = [superAgentId];
      
      if (startDate && endDate) {
        dateFilter = 'AND p.created_at BETWEEN $2 AND $3';
        params.push(startDate, endDate);
      }

      // Get all completed projects in the system (Super Agent oversees all)
      const projectsResult = await pool.query(`
        SELECT 
          p.id,
          p.title,
          p.initial_word_count,
          p.adjusted_word_count,
          p.cost_gbp,
          p.pricing_type,
          p.super_worker_fee_gbp,
          p.agent_fee_gbp,
          p.agent_id,
          p.created_at,
          p.completed_at,
          agent.full_name as agent_name
        FROM projects p
        LEFT JOIN users agent ON p.agent_id = agent.id
        WHERE p.status = 'completed'
        ${dateFilter}
        ORDER BY p.completed_at DESC
      `, params);

      const projects = projectsResult.rows;
      let totalRevenue = 0;
      let totalSuperWorkerFees = 0;
      let totalAgentFees = 0;
      let directProjects = 0;
      let agentProjects = 0;

      // Calculate fees for each project
      const projectBreakdown = projects.map(project => {
        const wordCount = project.adjusted_word_count || project.initial_word_count;
        const wordUnits = Math.ceil(wordCount / 500);
        const superWorkerFee = wordUnits * WORKER_PAY_RATE_PER_500_WORDS;
        
        // Agent fee is only for projects that came through agents
        const agentFee = project.agent_id && project.pricing_type === 'agent' ? 
          (project.agent_fee_gbp || 0) : 0;

        totalRevenue += project.cost_gbp;
        totalSuperWorkerFees += superWorkerFee;
        totalAgentFees += agentFee;

        if (project.agent_id) {
          agentProjects++;
        } else {
          directProjects++;
        }

        return {
          project_id: project.id,
          project_title: project.title,
          word_count: wordCount,
          revenue: project.cost_gbp,
          super_worker_fee: parseFloat(superWorkerFee.toFixed(2)),
          agent_fee: parseFloat(agentFee.toFixed(2)),
          agent_name: project.agent_name,
          pricing_type: project.pricing_type,
          completed_at: project.completed_at
        };
      });

      const netProfit = totalRevenue - totalSuperWorkerFees - totalAgentFees;

      return {
        super_agent_id: superAgentId,
        period: {
          start_date: startDate,
          end_date: endDate
        },
        summary: {
          total_projects: projects.length,
          direct_projects: directProjects,
          agent_projects: agentProjects,
          total_revenue: parseFloat(totalRevenue.toFixed(2)),
          total_super_worker_fees: parseFloat(totalSuperWorkerFees.toFixed(2)),
          total_agent_fees: parseFloat(totalAgentFees.toFixed(2)),
          net_profit: parseFloat(netProfit.toFixed(2)),
          profit_margin: totalRevenue > 0 ? parseFloat(((netProfit / totalRevenue) * 100).toFixed(2)) : 0
        },
        project_breakdown: projectBreakdown
      };
    } catch (error) {
      console.error('Error calculating Super Agent analytics:', error);
      throw new Error('Failed to calculate Super Agent analytics');
    }
  }

  /**
   * Calculate Agent analytics (earnings minus Super Agent fees)
   */
  static async calculateAgentAnalytics(agentId, startDate = null, endDate = null) {
    try {
      let dateFilter = '';
      const params = [agentId];
      
      if (startDate && endDate) {
        dateFilter = 'AND p.created_at BETWEEN $2 AND $3';
        params.push(startDate, endDate);
      }

      // Get completed projects assigned to this agent
      const projectsResult = await pool.query(`
        SELECT 
          p.id,
          p.title,
          p.initial_word_count,
          p.adjusted_word_count,
          p.cost_gbp,
          p.pricing_type,
          p.super_worker_fee_gbp,
          p.agent_fee_gbp,
          p.created_at,
          p.completed_at
        FROM projects p
        WHERE p.agent_id = $1 
        AND p.status = 'completed'
        ${dateFilter}
        ORDER BY p.completed_at DESC
      `, params);

      const projects = projectsResult.rows;
      let totalEarnings = 0;
      let totalSuperAgentFees = 0;
      let totalSuperWorkerFees = 0;

      // Calculate fees for each project
      const projectBreakdown = projects.map(project => {
        const wordCount = project.adjusted_word_count || project.initial_word_count;
        const wordUnits = Math.ceil(wordCount / 500);
        const superWorkerFee = wordUnits * WORKER_PAY_RATE_PER_500_WORDS;
        
        // Agent earnings from their custom pricing
        const agentEarnings = project.cost_gbp;
        
        // Super Agent fee includes Super Worker fee
        const superAgentFee = superWorkerFee + (project.agent_fee_gbp || 0);

        totalEarnings += agentEarnings;
        totalSuperAgentFees += superAgentFee;
        totalSuperWorkerFees += superWorkerFee;

        return {
          project_id: project.id,
          project_title: project.title,
          word_count: wordCount,
          agent_earnings: parseFloat(agentEarnings.toFixed(2)),
          super_worker_fee: parseFloat(superWorkerFee.toFixed(2)),
          super_agent_fee: parseFloat(superAgentFee.toFixed(2)),
          completed_at: project.completed_at
        };
      });

      const netProfit = totalEarnings - totalSuperAgentFees;

      return {
        agent_id: agentId,
        period: {
          start_date: startDate,
          end_date: endDate
        },
        summary: {
          total_projects: projects.length,
          total_earnings: parseFloat(totalEarnings.toFixed(2)),
          total_super_agent_fees: parseFloat(totalSuperAgentFees.toFixed(2)),
          super_worker_fees_included: parseFloat(totalSuperWorkerFees.toFixed(2)),
          net_profit: parseFloat(netProfit.toFixed(2)),
          profit_margin: totalEarnings > 0 ? parseFloat(((netProfit / totalEarnings) * 100).toFixed(2)) : 0
        },
        project_breakdown: projectBreakdown
      };
    } catch (error) {
      console.error('Error calculating Agent analytics:', error);
      throw new Error('Failed to calculate Agent analytics');
    }
  }

  /**
   * Get analytics summary for any user role
   */
  static async getUserAnalytics(userId, role, startDate = null, endDate = null) {
    switch (role) {
      case 'super_worker':
        return await this.calculateSuperWorkerAnalytics(userId, startDate, endDate);
      case 'super_agent':
        return await this.calculateSuperAgentAnalytics(userId, startDate, endDate);
      case 'agent':
        return await this.calculateAgentAnalytics(userId, startDate, endDate);
      default:
        throw new Error(`Analytics not available for role: ${role}`);
    }
  }

  /**
   * Get current month analytics
   */
  static async getCurrentMonthAnalytics(userId, role) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    return await this.getUserAnalytics(userId, role, startOfMonth, endOfMonth);
  }

  /**
   * Get year-to-date analytics
   */
  static async getYearToDateAnalytics(userId, role) {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    return await this.getUserAnalytics(userId, role, startOfYear, now);
  }

  /**
   * Track earnings for a completed project
   */
  static async trackProjectEarnings(projectId) {
    try {
      // Get project details
      const projectResult = await pool.query(`
        SELECT 
          p.*,
          client.id as client_id,
          agent.id as agent_id,
          agent.role as agent_role,
          super_worker.id as super_worker_id
        FROM projects p
        LEFT JOIN users client ON p.client_id = client.id
        LEFT JOIN users agent ON p.agent_id = agent.id
        LEFT JOIN users super_worker ON p.super_worker_id = super_worker.id
        WHERE p.id = $1
      `, [projectId]);

      if (projectResult.rows.length === 0) {
        throw new Error('Project not found');
      }

      const project = projectResult.rows[0];
      const wordCount = project.adjusted_word_count || project.initial_word_count;
      const wordUnits = Math.ceil(wordCount / 500);

      // Track Super Worker earnings
      if (project.super_worker_id) {
        const superWorkerEarnings = wordUnits * WORKER_PAY_RATE_PER_500_WORDS;
        const superWorkerEarningsINR = superWorkerEarnings * GBP_TO_INR_RATE;

        await pool.query(`
          INSERT INTO user_earnings (user_id, project_id, role, earnings_gbp, earnings_inr, calculation_date)
          VALUES ($1, $2, 'super_worker', $3, $4, NOW())
          ON CONFLICT (user_id, project_id) DO UPDATE SET
          earnings_gbp = EXCLUDED.earnings_gbp,
          earnings_inr = EXCLUDED.earnings_inr,
          calculation_date = NOW()
        `, [project.super_worker_id, projectId, superWorkerEarnings, superWorkerEarningsINR]);
      }

      // Track Agent earnings and fees
      if (project.agent_id) {
        const agentEarnings = project.cost_gbp;
        const superAgentFee = (wordUnits * WORKER_PAY_RATE_PER_500_WORDS) + (project.agent_fee_gbp || 0);
        const agentNetProfit = agentEarnings - superAgentFee;

        await pool.query(`
          INSERT INTO user_earnings (user_id, project_id, role, earnings_gbp, fees_paid_gbp, net_profit_gbp, calculation_date)
          VALUES ($1, $2, 'agent', $3, $4, $5, NOW())
          ON CONFLICT (user_id, project_id) DO UPDATE SET
          earnings_gbp = EXCLUDED.earnings_gbp,
          fees_paid_gbp = EXCLUDED.fees_paid_gbp,
          net_profit_gbp = EXCLUDED.net_profit_gbp,
          calculation_date = NOW()
        `, [project.agent_id, projectId, agentEarnings, superAgentFee, agentNetProfit]);
      }

      console.log(`Earnings tracked for project ${projectId}`);
      return true;
    } catch (error) {
      console.error('Error tracking project earnings:', error);
      throw new Error('Failed to track project earnings');
    }
  }
}

export default AnalyticsService;