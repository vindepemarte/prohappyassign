/**
 * Pricing Calculator Utility
 * Handles deadline-based pricing calculations with urgency charges
 */

import { SUPER_AGENT_PRICING_TABLE } from '../constants.js';

export class PricingCalculator {
  // Deadline pricing configuration based on requirements
  static DEADLINE_PRICING = [
    { daysFromRequest: 1, additionalCharge: 30, urgencyLevel: 'rush' },
    { daysFromRequest: 2, additionalCharge: 10, urgencyLevel: 'urgent' },
    { daysFromRequest: 3, additionalCharge: 5, urgencyLevel: 'moderate' },
    { daysFromRequest: 4, additionalCharge: 5, urgencyLevel: 'moderate' },
    { daysFromRequest: 5, additionalCharge: 5, urgencyLevel: 'moderate' },
    { daysFromRequest: 6, additionalCharge: 5, urgencyLevel: 'moderate' },
  ];

  /**
   * Calculates the base price based on word count using the pricing table
   * @param {number} wordCount Number of words
   * @returns {number} Base price in GBP
   */
  static calculateBasePrice(wordCount) {
    if (wordCount <= 0) return 0;

    // Defensive check to ensure SUPER_AGENT_PRICING_TABLE is available
    if (!SUPER_AGENT_PRICING_TABLE || !Array.isArray(SUPER_AGENT_PRICING_TABLE) || SUPER_AGENT_PRICING_TABLE.length === 0) {
      console.error('SUPER_AGENT_PRICING_TABLE is not available or empty');
      return 0;
    }

    const tier = SUPER_AGENT_PRICING_TABLE.find(p => wordCount <= p.maxWords);
    return tier ? tier.price : SUPER_AGENT_PRICING_TABLE[SUPER_AGENT_PRICING_TABLE.length - 1].price; // Default to max price if over
  }

  /**
   * Calculates deadline charge based on days between request and deadline
   * @param {Date} deadline Deadline date
   * @param {Date} requestDate Request date (defaults to current date)
   * @returns {number} Deadline charge in GBP
   */
  static calculateDeadlineCharge(deadline, requestDate = new Date()) {
    const timeDiff = deadline.getTime() - requestDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    // Find the appropriate pricing tier
    const pricingTier = this.DEADLINE_PRICING.find(tier => daysDiff <= tier.daysFromRequest);
    
    return pricingTier ? pricingTier.additionalCharge : 0;
  }

  /**
   * Determines urgency level based on days between request and deadline
   * @param {Date} deadline Deadline date
   * @param {Date} requestDate Request date (defaults to current date)
   * @returns {string} Urgency level
   */
  static calculateUrgencyLevel(deadline, requestDate = new Date()) {
    const timeDiff = deadline.getTime() - requestDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    // Find the appropriate urgency level
    const pricingTier = this.DEADLINE_PRICING.find(tier => daysDiff <= tier.daysFromRequest);
    
    return pricingTier ? pricingTier.urgencyLevel : 'normal';
  }

  /**
   * Calculates total price including base price and deadline charges
   * @param {number} wordCount Number of words
   * @param {Date} deadline Deadline date
   * @param {Date} requestDate Request date (defaults to current date)
   * @returns {Object} Complete pricing breakdown
   */
  static calculateTotalPrice(wordCount, deadline, requestDate = new Date()) {
    const basePrice = this.calculateBasePrice(wordCount);
    const deadlineCharge = this.calculateDeadlineCharge(deadline, requestDate);
    const totalPrice = basePrice + deadlineCharge;
    const urgencyLevel = this.calculateUrgencyLevel(deadline, requestDate);

    return {
      basePrice,
      deadlineCharge,
      totalPrice: Math.round(totalPrice * 100) / 100, // Round to 2 decimal places
      urgencyLevel
    };
  }

  /**
   * Formats pricing breakdown for display
   * @param {Object} breakdown Pricing breakdown object
   * @returns {string} Formatted string for display
   */
  static formatPricingBreakdown(breakdown) {
    if (breakdown.deadlineCharge > 0) {
      return `£${breakdown.basePrice.toFixed(2)} + £${breakdown.deadlineCharge.toFixed(2)} (${breakdown.urgencyLevel}) = £${breakdown.totalPrice.toFixed(2)}`;
    }
    return `£${breakdown.totalPrice.toFixed(2)}`;
  }

  /**
   * Gets urgency level display text
   * @param {string} urgencyLevel Urgency level
   * @returns {string} Display text for urgency level
   */
  static getUrgencyDisplayText(urgencyLevel) {
    const displayTexts = {
      normal: 'Standard',
      moderate: 'Moderate Rush',
      urgent: 'Urgent',
      rush: 'Rush Job'
    };
    return displayTexts[urgencyLevel];
  }

  /**
   * Gets urgency level color for UI styling
   * @param {string} urgencyLevel Urgency level
   * @returns {string} CSS color class or hex color
   */
  static getUrgencyColor(urgencyLevel) {
    const colors = {
      normal: '#10B981', // green
      moderate: '#F59E0B', // amber
      urgent: '#EF4444', // red
      rush: '#DC2626' // dark red
    };
    return colors[urgencyLevel];
  }

  /**
   * Calculates days until deadline
   * @param {Date} deadline Deadline date
   * @param {Date} fromDate Date to calculate from (defaults to current date)
   * @returns {number} Number of days until deadline
   */
  static getDaysUntilDeadline(deadline, fromDate = new Date()) {
    const timeDiff = deadline.getTime() - fromDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }
}

// Export utility functions for easier use
export const calculatePrice = (wordCount, deadline) => 
  PricingCalculator.calculateTotalPrice(wordCount, deadline);

export const formatPrice = (breakdown) => 
  PricingCalculator.formatPricingBreakdown(breakdown);

export const getUrgencyLevel = (deadline) => 
  PricingCalculator.calculateUrgencyLevel(deadline);