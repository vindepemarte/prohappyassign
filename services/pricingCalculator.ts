/**
 * Pricing Calculator Utility
 * Handles deadline-based pricing calculations with urgency charges
 */

import type { UrgencyLevel, PricingBreakdown } from '../types';
import { SUPER_AGENT_PRICING_TABLE } from '../constants';

export class PricingCalculator {
  // Deadline pricing configuration based on requirements
  private static readonly DEADLINE_PRICING = [
    { daysFromRequest: 1, additionalCharge: 30, urgencyLevel: 'rush' as UrgencyLevel },
    { daysFromRequest: 2, additionalCharge: 10, urgencyLevel: 'urgent' as UrgencyLevel },
    { daysFromRequest: 3, additionalCharge: 5, urgencyLevel: 'moderate' as UrgencyLevel },
    { daysFromRequest: 4, additionalCharge: 5, urgencyLevel: 'moderate' as UrgencyLevel },
    { daysFromRequest: 5, additionalCharge: 5, urgencyLevel: 'moderate' as UrgencyLevel },
    { daysFromRequest: 6, additionalCharge: 5, urgencyLevel: 'moderate' as UrgencyLevel },
  ];

  /**
   * Calculates the base price based on word count using the pricing table
   * @param wordCount Number of words
   * @returns Base price in GBP
   */
  static calculateBasePrice(wordCount: number): number {
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
   * @param deadline Deadline date
   * @param requestDate Request date (defaults to current date)
   * @returns Deadline charge in GBP
   */
  static calculateDeadlineCharge(deadline: Date, requestDate: Date = new Date()): number {
    const timeDiff = deadline.getTime() - requestDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    // Find the appropriate pricing tier
    const pricingTier = this.DEADLINE_PRICING.find(tier => daysDiff <= tier.daysFromRequest);
    
    return pricingTier ? pricingTier.additionalCharge : 0;
  }

  /**
   * Determines urgency level based on days between request and deadline
   * @param deadline Deadline date
   * @param requestDate Request date (defaults to current date)
   * @returns Urgency level
   */
  static calculateUrgencyLevel(deadline: Date, requestDate: Date = new Date()): UrgencyLevel {
    const timeDiff = deadline.getTime() - requestDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    // Find the appropriate urgency level
    const pricingTier = this.DEADLINE_PRICING.find(tier => daysDiff <= tier.daysFromRequest);
    
    return pricingTier ? pricingTier.urgencyLevel : 'normal';
  }

  /**
   * Calculates total price including base price and deadline charges
   * @param wordCount Number of words
   * @param deadline Deadline date
   * @param requestDate Request date (defaults to current date)
   * @returns Complete pricing breakdown
   */
  static calculateTotalPrice(
    wordCount: number, 
    deadline: Date, 
    requestDate: Date = new Date()
  ): PricingBreakdown {
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
   * @param breakdown Pricing breakdown object
   * @returns Formatted string for display
   */
  static formatPricingBreakdown(breakdown: PricingBreakdown): string {
    if (breakdown.deadlineCharge > 0) {
      return `£${breakdown.basePrice.toFixed(2)} + £${breakdown.deadlineCharge.toFixed(2)} (${breakdown.urgencyLevel}) = £${breakdown.totalPrice.toFixed(2)}`;
    }
    return `£${breakdown.totalPrice.toFixed(2)}`;
  }

  /**
   * Gets urgency level display text
   * @param urgencyLevel Urgency level
   * @returns Display text for urgency level
   */
  static getUrgencyDisplayText(urgencyLevel: UrgencyLevel): string {
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
   * @param urgencyLevel Urgency level
   * @returns CSS color class or hex color
   */
  static getUrgencyColor(urgencyLevel: UrgencyLevel): string {
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
   * @param deadline Deadline date
   * @param fromDate Date to calculate from (defaults to current date)
   * @returns Number of days until deadline
   */
  static getDaysUntilDeadline(deadline: Date, fromDate: Date = new Date()): number {
    const timeDiff = deadline.getTime() - fromDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }
}

// Export utility functions for easier use
export const calculatePrice = (wordCount: number, deadline: Date) => 
  PricingCalculator.calculateTotalPrice(wordCount, deadline);

export const formatPrice = (breakdown: PricingBreakdown) => 
  PricingCalculator.formatPricingBreakdown(breakdown);

export const getUrgencyLevel = (deadline: Date) => 
  PricingCalculator.calculateUrgencyLevel(deadline);