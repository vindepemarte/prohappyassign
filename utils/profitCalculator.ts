/**
 * Profit Calculator Utility
 * Specialized calculations for agent dashboard profit tracking
 */

import type { Project } from '../types';
import { TimeFilter } from '../components/common/FilterBar';
import { EarningsCalculator } from './earningsCalculator';

export interface ProfitBreakdown {
  totalRevenue: number;
  totalWorkerPayments: number;
  totalProfit: number;
  profitMargin: number; // Percentage
  projectCount: number;
  averageRevenue: number;
  averageProfit: number;
  averageWorkerPayment: number;
}

export interface ProfitComparison {
  current: ProfitBreakdown;
  previous?: ProfitBreakdown;
  growth: {
    revenue: number;
    profit: number;
    margin: number;
    projects: number;
  };
}

export interface WorkerPaymentSummary {
  workerId: string;
  workerName?: string;
  totalPayment: number;
  projectCount: number;
  averagePayment: number;
  projects: Project[];
}

export class ProfitCalculator {
  /**
   * Calculates detailed profit breakdown for agent dashboard
   * @param projects Array of projects
   * @param filter Time filter to apply
   * @returns Detailed profit breakdown
   */
  static calculateProfitBreakdown(projects: Project[], filter: TimeFilter): ProfitBreakdown {
    const filteredProjects = EarningsCalculator.filterProjectsByTimeRange(projects, filter);
    const completedProjects = filteredProjects.filter(p => p.status === 'completed');

    let totalRevenue = 0;
    let totalWorkerPayments = 0;

    completedProjects.forEach(project => {
      const wordCount = project.adjusted_word_count || project.initial_word_count;
      const workerPayout = EarningsCalculator.calculateWorkerPayoutGbp(wordCount);
      
      totalRevenue += project.cost_gbp;
      totalWorkerPayments += workerPayout;
    });

    const totalProfit = totalRevenue - totalWorkerPayments;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const projectCount = completedProjects.length;

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalWorkerPayments: Math.round(totalWorkerPayments * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      profitMargin: Math.round(profitMargin * 100) / 100,
      projectCount,
      averageRevenue: projectCount > 0 ? Math.round((totalRevenue / projectCount) * 100) / 100 : 0,
      averageProfit: projectCount > 0 ? Math.round((totalProfit / projectCount) * 100) / 100 : 0,
      averageWorkerPayment: projectCount > 0 ? Math.round((totalWorkerPayments / projectCount) * 100) / 100 : 0
    };
  }

  /**
   * Calculates profit comparison between current and previous periods
   * @param currentProjects Current period projects
   * @param previousProjects Previous period projects
   * @param currentFilter Current time filter
   * @param previousFilter Previous time filter
   * @returns Profit comparison with growth metrics
   */
  static calculateProfitComparison(
    currentProjects: Project[],
    previousProjects: Project[],
    currentFilter: TimeFilter,
    previousFilter: TimeFilter
  ): ProfitComparison {
    const current = this.calculateProfitBreakdown(currentProjects, currentFilter);
    const previous = this.calculateProfitBreakdown(previousProjects, previousFilter);

    const calculateGrowth = (currentValue: number, previousValue: number): number => {
      if (previousValue === 0) return currentValue > 0 ? 100 : 0;
      return Math.round(((currentValue - previousValue) / previousValue) * 10000) / 100;
    };

    return {
      current,
      previous,
      growth: {
        revenue: calculateGrowth(current.totalRevenue, previous.totalRevenue),
        profit: calculateGrowth(current.totalProfit, previous.totalProfit),
        margin: Math.round((current.profitMargin - previous.profitMargin) * 100) / 100,
        projects: calculateGrowth(current.projectCount, previous.projectCount)
      }
    };
  }

  /**
   * Calculates worker payment summary for agent dashboard
   * @param projects Array of projects
   * @param filter Time filter to apply
   * @returns Array of worker payment summaries
   */
  static calculateWorkerPayments(projects: Project[], filter: TimeFilter): WorkerPaymentSummary[] {
    const filteredProjects = EarningsCalculator.filterProjectsByTimeRange(projects, filter);
    const completedProjects = filteredProjects.filter(p => p.status === 'completed' && p.worker_id);

    const workerPayments = new Map<string, {
      totalPayment: number;
      projectCount: number;
      projects: Project[];
    }>();

    completedProjects.forEach(project => {
      if (!project.worker_id) return;

      const wordCount = project.adjusted_word_count || project.initial_word_count;
      const payment = EarningsCalculator.calculateWorkerPayoutGbp(wordCount);

      if (workerPayments.has(project.worker_id)) {
        const existing = workerPayments.get(project.worker_id)!;
        existing.totalPayment += payment;
        existing.projectCount += 1;
        existing.projects.push(project);
      } else {
        workerPayments.set(project.worker_id, {
          totalPayment: payment,
          projectCount: 1,
          projects: [project]
        });
      }
    });

    return Array.from(workerPayments.entries()).map(([workerId, data]) => ({
      workerId,
      totalPayment: Math.round(data.totalPayment * 100) / 100,
      projectCount: data.projectCount,
      averagePayment: Math.round((data.totalPayment / data.projectCount) * 100) / 100,
      projects: data.projects
    })).sort((a, b) => b.totalPayment - a.totalPayment);
  }

  /**
   * Calculates monthly profit trends for analytics
   * @param projects Array of projects
   * @param months Number of months to analyze
   * @returns Monthly profit data
   */
  static calculateMonthlyProfitTrends(projects: Project[], months: number = 12): {
    month: string;
    year: number;
    revenue: number;
    profit: number;
    projects: number;
    margin: number;
  }[] {
    const now = new Date();
    const monthlyData: { [key: string]: {
      revenue: number;
      workerPayments: number;
      projects: number;
    } } = {};

    // Initialize months
    for (let i = 0; i < months; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      monthlyData[key] = { revenue: 0, workerPayments: 0, projects: 0 };
    }

    // Process completed projects
    const completedProjects = projects.filter(p => p.status === 'completed');
    
    completedProjects.forEach(project => {
      const projectDate = new Date(project.updated_at);
      const key = `${projectDate.getFullYear()}-${projectDate.getMonth()}`;
      
      if (monthlyData[key]) {
        const wordCount = project.adjusted_word_count || project.initial_word_count;
        const workerPayment = EarningsCalculator.calculateWorkerPayoutGbp(wordCount);
        
        monthlyData[key].revenue += project.cost_gbp;
        monthlyData[key].workerPayments += workerPayment;
        monthlyData[key].projects += 1;
      }
    });

    // Convert to array and calculate profit/margin
    return Object.entries(monthlyData)
      .map(([key, data]) => {
        const [year, month] = key.split('-').map(Number);
        const date = new Date(year, month, 1);
        const profit = data.revenue - data.workerPayments;
        const margin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;

        return {
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          year,
          revenue: Math.round(data.revenue * 100) / 100,
          profit: Math.round(profit * 100) / 100,
          projects: data.projects,
          margin: Math.round(margin * 100) / 100
        };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return new Date(`${a.month} 1, ${a.year}`).getMonth() - new Date(`${b.month} 1, ${b.year}`).getMonth();
      });
  }

  /**
   * Calculates profit per client for analysis
   * @param projects Array of projects
   * @param filter Time filter to apply
   * @returns Client profit analysis
   */
  static calculateClientProfitAnalysis(projects: Project[], filter: TimeFilter): {
    clientId: string;
    revenue: number;
    profit: number;
    projects: number;
    averageProjectValue: number;
    profitMargin: number;
  }[] {
    const filteredProjects = EarningsCalculator.filterProjectsByTimeRange(projects, filter);
    const completedProjects = filteredProjects.filter(p => p.status === 'completed');

    const clientData = new Map<string, {
      revenue: number;
      workerPayments: number;
      projects: number;
    }>();

    completedProjects.forEach(project => {
      const wordCount = project.adjusted_word_count || project.initial_word_count;
      const workerPayment = EarningsCalculator.calculateWorkerPayoutGbp(wordCount);

      if (clientData.has(project.client_id)) {
        const existing = clientData.get(project.client_id)!;
        existing.revenue += project.cost_gbp;
        existing.workerPayments += workerPayment;
        existing.projects += 1;
      } else {
        clientData.set(project.client_id, {
          revenue: project.cost_gbp,
          workerPayments: workerPayment,
          projects: 1
        });
      }
    });

    return Array.from(clientData.entries())
      .map(([clientId, data]) => {
        const profit = data.revenue - data.workerPayments;
        const profitMargin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;

        return {
          clientId,
          revenue: Math.round(data.revenue * 100) / 100,
          profit: Math.round(profit * 100) / 100,
          projects: data.projects,
          averageProjectValue: Math.round((data.revenue / data.projects) * 100) / 100,
          profitMargin: Math.round(profitMargin * 100) / 100
        };
      })
      .sort((a, b) => b.profit - a.profit);
  }

  /**
   * Formats profit display for agent dashboard
   * @param breakdown Profit breakdown object
   * @returns Formatted profit string
   */
  static formatProfitDisplay(breakdown: ProfitBreakdown): string {
    return `Profit £${breakdown.totalProfit.toFixed(2)} / To Give £${breakdown.totalWorkerPayments.toFixed(2)}`;
  }

  /**
   * Gets profit status color for UI
   * @param profitMargin Profit margin percentage
   * @returns CSS color class
   */
  static getProfitStatusColor(profitMargin: number): string {
    if (profitMargin >= 50) return 'text-green-600';
    if (profitMargin >= 30) return 'text-blue-600';
    if (profitMargin >= 10) return 'text-yellow-600';
    return 'text-red-600';
  }

  /**
   * Validates projects for profit calculations
   * @param projects Array of projects
   * @returns Validation result
   */
  static validateProjectsForProfit(projects: Project[]): {
    isValid: boolean;
    issues: string[];
    validProjects: Project[];
  } {
    return EarningsCalculator.validateProjectsForEarnings(projects);
  }
}

// Export utility functions
export const calculateProfit = (projects: Project[], filter: TimeFilter) =>
  ProfitCalculator.calculateProfitBreakdown(projects, filter);

export const formatProfitDisplay = (breakdown: ProfitBreakdown) =>
  ProfitCalculator.formatProfitDisplay(breakdown);

export const calculateWorkerPayments = (projects: Project[], filter: TimeFilter) =>
  ProfitCalculator.calculateWorkerPayments(projects, filter);