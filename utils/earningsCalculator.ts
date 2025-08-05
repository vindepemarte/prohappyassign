/**
 * Earnings Calculator Utility
 * Handles earnings calculations for workers and profit calculations for agents
 */

import type { Project } from '../types';
import { TimeFilter } from '../components/common/FilterBar';
import { WORKER_PAY_RATE_PER_500_WORDS, GBP_TO_INR_RATE } from '../constants';

export interface WorkerEarnings {
  totalGbp: number;
  totalInr: number;
  projectCount: number;
  averagePerProject: number;
  projects: Project[];
}

export interface AgentProfit {
  totalRevenue: number;
  totalWorkerPayments: number;
  totalProfit: number;
  projectCount: number;
  averageProfit: number;
  projects: Project[];
}

export interface CurrencyConversion {
  gbp: number;
  inr: number;
  exchangeRate: number;
  lastUpdated?: Date;
}

export class EarningsCalculator {
  /**
   * Filters projects based on time filter criteria
   * @param projects Array of projects to filter
   * @param filter Time filter to apply
   * @returns Filtered projects array
   */
  static filterProjectsByTimeRange(projects: Project[], filter: TimeFilter): Project[] {
    if (!filter.startDate || !filter.endDate) {
      return projects;
    }

    return projects.filter(project => {
      const projectDate = new Date(project.updated_at);
      return projectDate >= filter.startDate! && projectDate <= filter.endDate!;
    });
  }

  /**
   * Calculates worker payout for a single project
   * @param wordCount Word count for the project
   * @returns Payout in GBP
   */
  static calculateWorkerPayoutGbp(wordCount: number): number {
    if (wordCount <= 0) return 0;
    return (wordCount / 500) * WORKER_PAY_RATE_PER_500_WORDS;
  }

  /**
   * Converts GBP amount to INR
   * @param gbpAmount Amount in GBP
   * @param exchangeRate Exchange rate (defaults to constant rate)
   * @returns Amount in INR
   */
  static convertGbpToInr(gbpAmount: number, exchangeRate: number = GBP_TO_INR_RATE): number {
    return gbpAmount * exchangeRate;
  }

  /**
   * Calculates total earnings for a worker based on filtered projects
   * @param projects Array of projects assigned to the worker
   * @param filter Time filter to apply
   * @param exchangeRate Exchange rate for currency conversion
   * @returns Worker earnings breakdown
   */
  static calculateWorkerEarnings(
    projects: Project[], 
    filter: TimeFilter,
    exchangeRate: number = GBP_TO_INR_RATE
  ): WorkerEarnings {
    const filteredProjects = this.filterProjectsByTimeRange(projects, filter);
    
    // Only count completed projects for earnings
    const completedProjects = filteredProjects.filter(p => p.status === 'completed');
    
    let totalGbp = 0;
    
    completedProjects.forEach(project => {
      const wordCount = project.adjusted_word_count || project.initial_word_count;
      totalGbp += this.calculateWorkerPayoutGbp(wordCount);
    });

    const totalInr = this.convertGbpToInr(totalGbp, exchangeRate);
    const averagePerProject = completedProjects.length > 0 ? totalGbp / completedProjects.length : 0;

    return {
      totalGbp: Math.round(totalGbp * 100) / 100,
      totalInr: Math.round(totalInr * 100) / 100,
      projectCount: completedProjects.length,
      averagePerProject: Math.round(averagePerProject * 100) / 100,
      projects: completedProjects
    };
  }

  /**
   * Calculates profit for an agent based on filtered projects
   * @param projects Array of all projects
   * @param filter Time filter to apply
   * @returns Agent profit breakdown
   */
  static calculateAgentProfit(projects: Project[], filter: TimeFilter): AgentProfit {
    const filteredProjects = this.filterProjectsByTimeRange(projects, filter);
    
    // Only count completed projects for profit calculations
    const completedProjects = filteredProjects.filter(p => p.status === 'completed');
    
    let totalRevenue = 0;
    let totalWorkerPayments = 0;
    
    completedProjects.forEach(project => {
      const wordCount = project.adjusted_word_count || project.initial_word_count;
      const workerPayout = this.calculateWorkerPayoutGbp(wordCount);
      
      totalRevenue += project.cost_gbp;
      totalWorkerPayments += workerPayout;
    });

    const totalProfit = totalRevenue - totalWorkerPayments;
    const averageProfit = completedProjects.length > 0 ? totalProfit / completedProjects.length : 0;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalWorkerPayments: Math.round(totalWorkerPayments * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      projectCount: completedProjects.length,
      averageProfit: Math.round(averageProfit * 100) / 100,
      projects: completedProjects
    };
  }

  /**
   * Formats earnings for display in the required format
   * @param earnings Worker earnings object
   * @returns Formatted string for display
   */
  static formatWorkerEarnings(earnings: WorkerEarnings): string {
    return `£${earnings.totalGbp.toFixed(2)} / ${earnings.totalInr.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Indian Rupee`;
  }

  /**
   * Formats agent profit for display in the required format
   * @param profit Agent profit object
   * @returns Formatted string for display
   */
  static formatAgentProfit(profit: AgentProfit): string {
    return `Profit £${profit.totalProfit.toFixed(2)} / To Give £${profit.totalWorkerPayments.toFixed(2)}`;
  }

  /**
   * Gets real-time exchange rate (placeholder for future API integration)
   * @returns Promise with current exchange rate
   */
  static async getRealTimeExchangeRate(): Promise<number> {
    // TODO: Implement real-time exchange rate fetching
    // For now, return the constant rate
    return new Promise((resolve) => {
      setTimeout(() => resolve(GBP_TO_INR_RATE), 100);
    });
  }

  /**
   * Calculates earnings summary for a specific time period
   * @param projects Array of projects
   * @param filter Time filter
   * @param userRole User role ('worker' or 'agent')
   * @returns Earnings summary object
   */
  static calculateEarningsSummary(
    projects: Project[], 
    filter: TimeFilter, 
    userRole: 'worker' | 'agent'
  ): WorkerEarnings | AgentProfit {
    if (userRole === 'worker') {
      return this.calculateWorkerEarnings(projects, filter);
    } else {
      return this.calculateAgentProfit(projects, filter);
    }
  }

  /**
   * Validates that projects have required fields for earnings calculation
   * @param projects Array of projects to validate
   * @returns Validation result with any issues found
   */
  static validateProjectsForEarnings(projects: Project[]): {
    isValid: boolean;
    issues: string[];
    validProjects: Project[];
  } {
    const issues: string[] = [];
    const validProjects: Project[] = [];

    projects.forEach((project, index) => {
      let isProjectValid = true;

      if (!project.cost_gbp || project.cost_gbp <= 0) {
        issues.push(`Project ${index + 1}: Invalid cost_gbp value`);
        isProjectValid = false;
      }

      if (!project.initial_word_count || project.initial_word_count <= 0) {
        issues.push(`Project ${index + 1}: Invalid initial_word_count value`);
        isProjectValid = false;
      }

      if (!project.updated_at) {
        issues.push(`Project ${index + 1}: Missing updated_at timestamp`);
        isProjectValid = false;
      }

      if (isProjectValid) {
        validProjects.push(project);
      }
    });

    return {
      isValid: issues.length === 0,
      issues,
      validProjects
    };
  }

  /**
   * Calculates earnings growth compared to previous period
   * @param currentEarnings Current period earnings
   * @param previousEarnings Previous period earnings
   * @returns Growth percentage and absolute change
   */
  static calculateEarningsGrowth(
    currentEarnings: WorkerEarnings | AgentProfit,
    previousEarnings: WorkerEarnings | AgentProfit
  ): {
    percentageChange: number;
    absoluteChange: number;
    isPositive: boolean;
  } {
    const currentAmount = 'totalGbp' in currentEarnings ? currentEarnings.totalGbp : currentEarnings.totalProfit;
    const previousAmount = 'totalGbp' in previousEarnings ? previousEarnings.totalGbp : previousEarnings.totalProfit;

    if (previousAmount === 0) {
      return {
        percentageChange: currentAmount > 0 ? 100 : 0,
        absoluteChange: currentAmount,
        isPositive: currentAmount >= 0
      };
    }

    const absoluteChange = currentAmount - previousAmount;
    const percentageChange = (absoluteChange / previousAmount) * 100;

    return {
      percentageChange: Math.round(percentageChange * 100) / 100,
      absoluteChange: Math.round(absoluteChange * 100) / 100,
      isPositive: absoluteChange >= 0
    };
  }
}

// Export utility functions for easier use
export const calculateWorkerEarnings = (projects: Project[], filter: TimeFilter) =>
  EarningsCalculator.calculateWorkerEarnings(projects, filter);

export const calculateAgentProfit = (projects: Project[], filter: TimeFilter) =>
  EarningsCalculator.calculateAgentProfit(projects, filter);

export const formatWorkerEarnings = (earnings: WorkerEarnings) =>
  EarningsCalculator.formatWorkerEarnings(earnings);

export const formatAgentProfit = (profit: AgentProfit) =>
  EarningsCalculator.formatAgentProfit(profit);