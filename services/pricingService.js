/**
 * Comprehensive Pricing Service
 * Handles Super Agent fixed pricing, Agent custom pricing, and urgency calculations
 */

import { Pool } from 'pg';
import HierarchyService from './hierarchyService.js';

// Import constants - handle both .js and .ts imports
let SUPER_AGENT_PRICING_TABLE, GBP_TO_INR_RATE, WORKER_PAY_RATE_PER_500_WORDS;

try {
  const constants = await import('../constants.js');
  SUPER_AGENT_PRICING_TABLE = constants.SUPER_AGENT_PRICING_TABLE;
  GBP_TO_INR_RATE = constants.GBP_TO_INR_RATE;
  WORKER_PAY_RATE_PER_500_WORDS = constants.WORKER_PAY_RATE_PER_500_WORDS;
} catch (error) {
  // Fallback values if import fails
  SUPER_AGENT_PRICING_TABLE = [
    { maxWords: 500, price: 45 },
    { maxWords: 1000, price: 55 },
    { maxWords: 1500, price: 65 },
    { maxWords: 2000, price: 70 },
    { maxWords: 2500, price: 85 },
    { maxWords: 3000, price: 100 },
    { maxWords: 3500, price: 110 },
    { maxWords: 4000, price: 120 },
    { maxWords: 4500, price: 130 },
    { maxWords: 5000, price: 140 },
    { maxWords: 5500, price: 150 },
    { maxWords: 6000, price: 160 },
    { maxWords: 6500, price: 170 },
    { maxWords: 7000, price: 180 },
    { maxWords: 7500, price: 190 },
    { maxWords: 8000, price: 200 },
    { maxWords: 8500, price: 210 },
    { maxWords: 9000, price: 220 },
    { maxWords: 9500, price: 230 },
    { maxWords: 10000, price: 240 },
    { maxWords: 10500, price: 250 },
    { maxWords: 11000, price: 260 },
    { maxWords: 11500, price: 270 },
    { maxWords: 12000, price: 280 },
    { maxWords: 12500, price: 290 },
    { maxWords: 13000, price: 300 },
    { maxWords: 13500, price: 310 },
    { maxWords: 14000, price: 320 },
    { maxWords: 14500, price: 330 },
    { maxWords: 15000, price: 340 },
    { maxWords: 15500, price: 350 },
    { maxWords: 16000, price: 360 },
    { maxWords: 16500, price: 370 },
    { maxWords: 17000, price: 380 },
    { maxWords: 17500, price: 390 },
    { maxWords: 18000, price: 400 },
    { maxWords: 18500, price: 410 },
    { maxWords: 19000, price: 420 },
    { maxWords: 19500, price: 430 },
    { maxWords: 20000, price: 440 },
  ];
  GBP_TO_INR_RATE = 105.50;
  WORKER_PAY_RATE_PER_500_WORDS = 6.25;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

export class PricingService {
  /**
   * Urgency pricing configuration
   */
  static URGENCY_PRICING = [
    { daysFromRequest: 1, additionalCharge: 30, urgencyLevel: 'rush' },
    { daysFromRequest: 2, additionalCharge: 10, urgencyLevel: 'urgent' },
    { daysFromRequest: 3, additionalCharge: 5, urgencyLevel: 'moderate' },
    { daysFromRequest: 4, additionalCharge: 5, urgencyLevel: 'moderate' },
    { daysFromRequest: 5, additionalCharge: 5, urgencyLevel: 'moderate' },
    { daysFromRequest: 6, additionalCharge: 5, urgencyLevel: 'moderate' },
  ];

  /**
   * Calculate Super Agent pricing (fixed rates)
   */
  static calculateSuperAgentPrice(wordCount) {
    if (wordCount <= 0 || wordCount > 20000) {
      throw new Error('Word count must be between 1 and 20,000 for Super Agent pricing');
    }

    const tier = SUPER_AGENT_PRICING_TABLE.find(p => wordCount <= p.maxWords);
    return tier ? tier.price : SUPER_AGENT_PRICING_TABLE[SUPER_AGENT_PRICING_TABLE.length - 1].price;
  }

  /**
   * Calculate Agent custom pricing
   */
  static async calculateAgentPrice(wordCount, agentId) {
    try {
      // Get agent's custom pricing
      const result = await pool.query(
        'SELECT * FROM agent_pricing WHERE agent_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
        [agentId]
      );

      if (result.rows.length === 0) {
        // Use default pricing if no custom pricing set
        return this.calculateSuperAgentPrice(wordCount);
      }

      const pricing = result.rows[0];
      
      // Validate word count against agent's limits
      if (wordCount < pricing.min_word_count || wordCount > pricing.max_word_count) {
        throw new Error(`Word count must be between ${pricing.min_word_count} and ${pricing.max_word_count} for this agent`);
      }

      // Calculate based on agent's rate per 500 words
      const baseUnits = Math.ceil(wordCount / 500);
      return baseUnits * pricing.base_rate_per_500_words;
    } catch (error) {
      console.error('Error calculating agent price:', error);
      throw new Error('Failed to calculate agent pricing');
    }
  }

  /**
   * Calculate urgency charge based on deadline
   */
  static calculateUrgencyCharge(deadline, requestDate = new Date()) {
    const timeDiff = deadline.getTime() - requestDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    const pricingTier = this.URGENCY_PRICING.find(tier => daysDiff <= tier.daysFromRequest);
    return pricingTier ? pricingTier.additionalCharge : 0;
  }

  /**
   * Determine urgency level
   */
  static getUrgencyLevel(deadline, requestDate = new Date()) {
    const timeDiff = deadline.getTime() - requestDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    const pricingTier = this.URGENCY_PRICING.find(tier => daysDiff <= tier.daysFromRequest);
    return pricingTier ? pricingTier.urgencyLevel : 'normal';
  }

  /**
   * Determine which pricing to use based on client's hierarchy
   */
  static async determinePricingType(clientId) {
    try {
      // Get client's hierarchy info
      const hierarchyInfo = await HierarchyService.getUserHierarchyInfo(clientId);
      
      if (!hierarchyInfo || !hierarchyInfo.parent_id) {
        // Client not assigned to anyone, use Super Agent pricing
        return { type: 'super_agent', agentId: null };
      }

      // Get parent's role
      const parentInfo = await HierarchyService.getUserInfo(hierarchyInfo.parent_id);
      
      if (!parentInfo) {
        return { type: 'super_agent', agentId: null };
      }

      if (parentInfo.role === 'super_agent') {
        return { type: 'super_agent', agentId: parentInfo.id };
      } else if (parentInfo.role === 'agent') {
        return { type: 'agent', agentId: parentInfo.id };
      }

      // Default to Super Agent pricing
      return { type: 'super_agent', agentId: null };
    } catch (error) {
      console.error('Error determining pricing type:', error);
      // Default to Super Agent pricing on error
      return { type: 'super_agent', agentId: null };
    }
  }

  /**
   * Calculate complete pricing for an assignment
   */
  static async calculateAssignmentPricing(clientId, wordCount, deadline, requestDate = new Date()) {
    try {
      // Determine pricing type
      const pricingInfo = await this.determinePricingType(clientId);
      
      // Calculate base price
      let basePrice;
      if (pricingInfo.type === 'super_agent') {
        basePrice = this.calculateSuperAgentPrice(wordCount);
      } else {
        basePrice = await this.calculateAgentPrice(wordCount, pricingInfo.agentId);
      }

      // Calculate urgency charge
      const urgencyCharge = this.calculateUrgencyCharge(deadline, requestDate);
      const urgencyLevel = this.getUrgencyLevel(deadline, requestDate);

      // Calculate total price
      const totalPrice = basePrice + urgencyCharge;

      // Calculate Super Worker fee (always £6.25 per 500 words)
      const wordUnits = Math.ceil(wordCount / 500);
      const superWorkerFee = wordUnits * WORKER_PAY_RATE_PER_500_WORDS;

      // Calculate fees based on pricing type
      let agentFee = 0;
      if (pricingInfo.type === 'agent' && pricingInfo.agentId) {
        // Agent gets the difference between their price and Super Agent price
        const superAgentPrice = this.calculateSuperAgentPrice(wordCount);
        agentFee = Math.max(0, basePrice - superAgentPrice);
      }

      return {
        pricing_type: pricingInfo.type,
        agent_id: pricingInfo.agentId,
        word_count: wordCount,
        base_price: parseFloat(basePrice.toFixed(2)),
        urgency_charge: parseFloat(urgencyCharge.toFixed(2)),
        urgency_level: urgencyLevel,
        total_price: parseFloat(totalPrice.toFixed(2)),
        super_worker_fee: parseFloat(superWorkerFee.toFixed(2)),
        agent_fee: parseFloat(agentFee.toFixed(2)),
        breakdown: {
          base_price_description: pricingInfo.type === 'super_agent' ? 'Super Agent Rate' : 'Agent Custom Rate',
          urgency_description: urgencyLevel !== 'normal' ? `${urgencyLevel} delivery` : 'Standard delivery',
          super_worker_fee_description: `Super Worker fee (${wordUnits} × £${WORKER_PAY_RATE_PER_500_WORDS})`,
          agent_fee_description: agentFee > 0 ? 'Agent commission' : null
        }
      };
    } catch (error) {
      console.error('Error calculating assignment pricing:', error);
      throw new Error('Failed to calculate assignment pricing');
    }
  }

  /**
   * Calculate Super Worker earnings in GBP and INR
   */
  static calculateSuperWorkerEarnings(wordCount) {
    const wordUnits = Math.ceil(wordCount / 500);
    const earningsGBP = wordUnits * WORKER_PAY_RATE_PER_500_WORDS;
    const earningsINR = earningsGBP * GBP_TO_INR_RATE;

    return {
      word_count: wordCount,
      word_units: wordUnits,
      earnings_gbp: parseFloat(earningsGBP.toFixed(2)),
      earnings_inr: parseFloat(earningsINR.toFixed(2)),
      rate_per_500_words_gbp: WORKER_PAY_RATE_PER_500_WORDS,
      exchange_rate: GBP_TO_INR_RATE
    };
  }

  /**
   * Get pricing breakdown for display
   */
  static formatPricingBreakdown(pricingData) {
    const parts = [`£${pricingData.base_price.toFixed(2)} (${pricingData.breakdown.base_price_description})`];
    
    if (pricingData.urgency_charge > 0) {
      parts.push(`£${pricingData.urgency_charge.toFixed(2)} (${pricingData.breakdown.urgency_description})`);
    }
    
    return `${parts.join(' + ')} = £${pricingData.total_price.toFixed(2)}`;
  }

  /**
   * Validate pricing data
   */
  static validatePricingRequest(wordCount, deadline) {
    const errors = [];

    if (!wordCount || wordCount <= 0) {
      errors.push('Word count must be greater than 0');
    }

    if (wordCount > 20000) {
      errors.push('Word count cannot exceed 20,000 words');
    }

    if (!deadline || !(deadline instanceof Date)) {
      errors.push('Valid deadline date is required');
    }

    if (deadline && deadline <= new Date()) {
      errors.push('Deadline must be in the future');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default PricingService;