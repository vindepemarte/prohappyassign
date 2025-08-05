/**
 * Comprehensive tests for dashboard filtering and calculations
 * Tests earnings calculations, currency conversion, profit calculations, and analytics data accuracy
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EarningsCalculator, WorkerEarnings, AgentProfit } from '../utils/earningsCalculator'
import { ProfitCalculator, ProfitBreakdown } from '../utils/profitCalculator'
import { currencyService } from '../services/currencyService'
import { validateTimeFilter, sanitizeTimeFilter, createDefaultFilter } from '../utils/filterValidation'
import type { Project, ProjectStatus } from '../types'
import type { TimeFilter } from '../components/common/FilterBar'

// Mock constants
vi.mock('../constants', () => ({
  WORKER_PAY_RATE_PER_500_WORDS: 25, // £25 per 500 words
  GBP_TO_INR_RATE: 100 // 1 GBP = 100 INR for easy testing
}))

// Mock currency service
vi.mock('../services/currencyService', () => ({
  currencyService: {
    getExchangeRate: vi.fn().mockResolvedValue({
      rate: 100,
      lastUpdated: new Date(),
      source: 'api'
    }),
    convertGbpToInr: vi.fn().mockImplementation((amount: number) => 
      Promise.resolve({
        gbp: amount,
        inr: amount * 100,
        exchangeRate: 100,
        lastUpdated: new Date(),
        source: 'api'
      })
    ),
    formatCurrency: vi.fn().mockImplementation((amount: number, currency: 'GBP' | 'INR') => 
      currency === 'GBP' ? `£${amount.toFixed(2)}` : `₹${amount.toLocaleString('en-IN')}`
    )
  }
}))

describe('Dashboard Filtering and Calculations Tests', () => {
  // Sample project data for testing
  const createSampleProjects = (): Project[] => [
    {
      id: 1,
      client_id: 'client-1',
      worker_id: 'worker-1',
      agent_id: 'agent-1',
      title: 'Project 1',
      description: 'Test project 1',
      status: 'completed' as ProjectStatus,
      initial_word_count: 1000,
      adjusted_word_count: 1000,
      cost_gbp: 100,
      deadline: '2024-01-15',
      order_reference: 'ORD-2024-01-000001',
      deadline_charge: 0,
      urgency_level: 'normal',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-10T00:00:00Z'
    },
    {
      id: 2,
      client_id: 'client-2',
      worker_id: 'worker-1',
      agent_id: 'agent-1',
      title: 'Project 2',
      description: 'Test project 2',
      status: 'completed' as ProjectStatus,
      initial_word_count: 500,
      adjusted_word_count: 600,
      cost_gbp: 75,
      deadline: '2024-01-20',
      order_reference: 'ORD-2024-01-000002',
      deadline_charge: 5,
      urgency_level: 'moderate',
      created_at: '2024-01-05T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z'
    },
    {
      id: 3,
      client_id: 'client-1',
      worker_id: 'worker-2',
      agent_id: 'agent-1',
      title: 'Project 3',
      description: 'Test project 3',
      status: 'in_progress' as ProjectStatus,
      initial_word_count: 2000,
      adjusted_word_count: null,
      cost_gbp: 200,
      deadline: '2024-02-01',
      order_reference: 'ORD-2024-01-000003',
      deadline_charge: 0,
      urgency_level: 'normal',
      created_at: '2024-01-20T00:00:00Z',
      updated_at: '2024-01-25T00:00:00Z'
    },
    {
      id: 4,
      client_id: 'client-3',
      worker_id: 'worker-1',
      agent_id: 'agent-1',
      title: 'Project 4',
      description: 'Test project 4',
      status: 'completed' as ProjectStatus,
      initial_word_count: 1500,
      adjusted_word_count: 1500,
      cost_gbp: 150,
      deadline: '2024-02-10',
      order_reference: 'ORD-2024-02-000001',
      deadline_charge: 10,
      urgency_level: 'urgent',
      created_at: '2024-02-01T00:00:00Z',
      updated_at: '2024-02-05T00:00:00Z'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Time Filter Validation Tests', () => {
    it('should validate week filter correctly', () => {
      const weekFilter: TimeFilter = {
        type: 'week',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07')
      }

      const result = validateTimeFilter(weekFilter)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should validate month filter correctly', () => {
      const monthFilter: TimeFilter = {
        type: 'month',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }

      const result = validateTimeFilter(monthFilter)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should validate custom filter correctly', () => {
      const customFilter: TimeFilter = {
        type: 'custom',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-15')
      }

      const result = validateTimeFilter(customFilter)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject invalid filter types', () => {
      const invalidFilter = {
        type: 'invalid' as any,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-15')
      }

      const result = validateTimeFilter(invalidFilter)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Invalid filter type')
    })

    it('should reject filters with start date after end date', () => {
      const invalidFilter: TimeFilter = {
        type: 'custom',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-01')
      }

      const result = validateTimeFilter(invalidFilter)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Start date must be before end date')
    })

    it('should warn about large date ranges', () => {
      const largeRangeFilter: TimeFilter = {
        type: 'custom',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      }

      const result = validateTimeFilter(largeRangeFilter)
      expect(result.isValid).toBe(true)
      expect(result.warning).toContain('Large date ranges may affect performance')
    })

    it('should sanitize invalid dates', () => {
      const invalidFilter = {
        type: 'custom' as const,
        startDate: new Date('invalid-date'),
        endDate: new Date('2024-01-15')
      }

      const sanitized = sanitizeTimeFilter(invalidFilter)
      expect(sanitized.startDate).toBeUndefined()
      expect(sanitized.endDate).toEqual(new Date('2024-01-15'))
    })

    it('should create default filters correctly', () => {
      const weekFilter = createDefaultFilter('week')
      expect(weekFilter.type).toBe('week')
      expect(weekFilter.startDate).toBeInstanceOf(Date)
      expect(weekFilter.endDate).toBeInstanceOf(Date)

      const monthFilter = createDefaultFilter('month')
      expect(monthFilter.type).toBe('month')
      expect(monthFilter.startDate).toBeInstanceOf(Date)
      expect(monthFilter.endDate).toBeInstanceOf(Date)
    })
  })

  describe('Project Filtering Tests', () => {
    it('should filter projects by time range correctly', () => {
      const projects = createSampleProjects()
      const filter: TimeFilter = {
        type: 'custom',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }

      const filtered = EarningsCalculator.filterProjectsByTimeRange(projects, filter)
      
      // Should include projects 1, 2, and 3 (updated in January)
      expect(filtered).toHaveLength(3)
      expect(filtered.map(p => p.id)).toEqual([1, 2, 3])
    })

    it('should return all projects when no date range is specified', () => {
      const projects = createSampleProjects()
      const filter: TimeFilter = { type: 'month' }

      const filtered = EarningsCalculator.filterProjectsByTimeRange(projects, filter)
      expect(filtered).toHaveLength(4)
    })

    it('should handle empty project arrays', () => {
      const filter: TimeFilter = {
        type: 'custom',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }

      const filtered = EarningsCalculator.filterProjectsByTimeRange([], filter)
      expect(filtered).toHaveLength(0)
    })
  })

  describe('Worker Earnings Calculations Tests', () => {
    it('should calculate worker earnings correctly', () => {
      const projects = createSampleProjects()
      const filter: TimeFilter = {
        type: 'custom',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }

      const earnings = EarningsCalculator.calculateWorkerEarnings(projects, filter)

      // Only completed projects count: Project 1 (1000 words = £50) + Project 2 (600 words = £30)
      expect(earnings.totalGbp).toBe(80) // £50 + £30
      expect(earnings.totalInr).toBe(8000) // £80 * 100
      expect(earnings.projectCount).toBe(2)
      expect(earnings.averagePerProject).toBe(40) // £80 / 2
    })

    it('should only count completed projects for earnings', () => {
      const projects = createSampleProjects()
      const filter: TimeFilter = {
        type: 'custom',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-02-28')
      }

      const earnings = EarningsCalculator.calculateWorkerEarnings(projects, filter)

      // Should include Projects 1, 2, and 4 (all completed)
      // Project 3 is in_progress so shouldn't count
      expect(earnings.projectCount).toBe(3)
      expect(earnings.totalGbp).toBe(155) // £50 + £30 + £75
    })

    it('should handle projects with no adjusted word count', () => {
      const projects = createSampleProjects()
      // Project 3 has no adjusted_word_count, should use initial_word_count
      projects[2].status = 'completed' // Make it completed for testing
      
      const filter: TimeFilter = {
        type: 'custom',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-02-28')
      }

      const earnings = EarningsCalculator.calculateWorkerEarnings(projects, filter)
      
      // Project 3: 2000 words = £100
      expect(earnings.projects.some(p => p.id === 3)).toBe(true)
    })

    it('should format worker earnings correctly', () => {
      const earnings: WorkerEarnings = {
        totalGbp: 123.45,
        totalInr: 12345.67,
        projectCount: 3,
        averagePerProject: 41.15,
        projects: []
      }

      const formatted = EarningsCalculator.formatWorkerEarnings(earnings)
      expect(formatted).toBe('£123.45 / 12,345.67 Indian Rupee')
    })

    it('should handle zero earnings gracefully', () => {
      const projects: Project[] = []
      const filter: TimeFilter = {
        type: 'month',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }

      const earnings = EarningsCalculator.calculateWorkerEarnings(projects, filter)
      
      expect(earnings.totalGbp).toBe(0)
      expect(earnings.totalInr).toBe(0)
      expect(earnings.projectCount).toBe(0)
      expect(earnings.averagePerProject).toBe(0)
    })
  })

  describe('Agent Profit Calculations Tests', () => {
    it('should calculate agent profit correctly', () => {
      const projects = createSampleProjects()
      const filter: TimeFilter = {
        type: 'custom',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }

      const profit = EarningsCalculator.calculateAgentProfit(projects, filter)

      // Project 1: Revenue £100, Worker payment £50, Profit £50
      // Project 2: Revenue £75, Worker payment £30, Profit £45
      // Total: Revenue £175, Worker payments £80, Profit £95
      expect(profit.totalRevenue).toBe(175)
      expect(profit.totalWorkerPayments).toBe(80)
      expect(profit.totalProfit).toBe(95)
      expect(profit.projectCount).toBe(2)
      expect(profit.averageProfit).toBe(47.5)
    })

    it('should format agent profit correctly', () => {
      const profit: AgentProfit = {
        totalRevenue: 200,
        totalWorkerPayments: 75,
        totalProfit: 125,
        projectCount: 3,
        averageProfit: 41.67,
        projects: []
      }

      const formatted = EarningsCalculator.formatAgentProfit(profit)
      expect(formatted).toBe('Profit £125.00 / To Give £75.00')
    })

    it('should handle negative profit scenarios', () => {
      // Create a scenario where worker payments exceed revenue
      const projects: Project[] = [{
        id: 1,
        client_id: 'client-1',
        worker_id: 'worker-1',
        agent_id: 'agent-1',
        title: 'Low Revenue Project',
        description: 'Test project with low revenue',
        status: 'completed' as ProjectStatus,
        initial_word_count: 2000, // £100 worker payment
        adjusted_word_count: 2000,
        cost_gbp: 50, // Only £50 revenue
        deadline: '2024-01-15',
        order_reference: 'ORD-2024-01-000001',
        deadline_charge: 0,
        urgency_level: 'normal',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-10T00:00:00Z'
      }]

      const filter: TimeFilter = {
        type: 'month',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }

      const profit = EarningsCalculator.calculateAgentProfit(projects, filter)
      
      expect(profit.totalRevenue).toBe(50)
      expect(profit.totalWorkerPayments).toBe(100)
      expect(profit.totalProfit).toBe(-50) // Negative profit
    })
  })

  describe('Detailed Profit Breakdown Tests', () => {
    it('should calculate detailed profit breakdown', () => {
      const projects = createSampleProjects()
      const filter: TimeFilter = {
        type: 'custom',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-02-28')
      }

      const breakdown = ProfitCalculator.calculateProfitBreakdown(projects, filter)

      // All completed projects: 1, 2, 4
      expect(breakdown.projectCount).toBe(3)
      expect(breakdown.totalRevenue).toBe(325) // £100 + £75 + £150
      expect(breakdown.totalWorkerPayments).toBe(155) // £50 + £30 + £75
      expect(breakdown.totalProfit).toBe(170) // £325 - £155
      expect(breakdown.profitMargin).toBeCloseTo(52.31, 2) // (170/325) * 100
      expect(breakdown.averageRevenue).toBeCloseTo(108.33, 2)
      expect(breakdown.averageProfit).toBeCloseTo(56.67, 2)
    })

    it('should calculate worker payment summaries', () => {
      const projects = createSampleProjects()
      const filter: TimeFilter = {
        type: 'custom',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-02-28')
      }

      const workerPayments = ProfitCalculator.calculateWorkerPayments(projects, filter)

      // Should have 2 workers
      expect(workerPayments).toHaveLength(2)
      
      // Worker 1 should have higher total (Projects 1, 2, 4)
      const worker1 = workerPayments.find(w => w.workerId === 'worker-1')
      expect(worker1).toBeDefined()
      expect(worker1!.totalPayment).toBe(155) // £50 + £30 + £75
      expect(worker1!.projectCount).toBe(3)
      
      // Worker 2 should have no completed projects in this range
      const worker2 = workerPayments.find(w => w.workerId === 'worker-2')
      expect(worker2).toBeUndefined() // Project 3 is not completed
    })

    it('should calculate monthly profit trends', () => {
      const projects = createSampleProjects()
      const trends = ProfitCalculator.calculateMonthlyProfitTrends(projects, 3)

      expect(trends).toHaveLength(3)
      
      // Each trend should have required properties
      trends.forEach(trend => {
        expect(trend).toHaveProperty('month')
        expect(trend).toHaveProperty('year')
        expect(trend).toHaveProperty('revenue')
        expect(trend).toHaveProperty('profit')
        expect(trend).toHaveProperty('projects')
        expect(trend).toHaveProperty('margin')
      })
    })

    it('should calculate client profit analysis', () => {
      const projects = createSampleProjects()
      const filter: TimeFilter = {
        type: 'custom',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-02-28')
      }

      const clientAnalysis = ProfitCalculator.calculateClientProfitAnalysis(projects, filter)

      expect(clientAnalysis.length).toBeGreaterThan(0)
      
      // Should be sorted by profit (highest first)
      for (let i = 1; i < clientAnalysis.length; i++) {
        expect(clientAnalysis[i-1].profit).toBeGreaterThanOrEqual(clientAnalysis[i].profit)
      }

      // Each client should have valid data
      clientAnalysis.forEach(client => {
        expect(client.clientId).toBeDefined()
        expect(client.revenue).toBeGreaterThanOrEqual(0)
        expect(client.projects).toBeGreaterThan(0)
        expect(client.averageProjectValue).toBeGreaterThan(0)
        expect(typeof client.profitMargin).toBe('number')
      })
    })
  })

  describe('Currency Conversion Tests', () => {
    it('should convert GBP to INR correctly', () => {
      const gbpAmount = 100
      const inrAmount = EarningsCalculator.convertGbpToInr(gbpAmount, 100)
      
      expect(inrAmount).toBe(10000)
    })

    it('should handle zero amounts', () => {
      const result = EarningsCalculator.convertGbpToInr(0)
      expect(result).toBe(0)
    })

    it('should handle custom exchange rates', () => {
      const customRate = 85.5
      const result = EarningsCalculator.convertGbpToInr(100, customRate)
      expect(result).toBe(8550)
    })

    it('should round currency conversions properly', () => {
      const result = EarningsCalculator.convertGbpToInr(123.456, 100)
      expect(result).toBe(12345.6) // Should round to 2 decimal places
    })
  })

  describe('Earnings Growth Calculations Tests', () => {
    it('should calculate positive earnings growth', () => {
      const currentEarnings: WorkerEarnings = {
        totalGbp: 150,
        totalInr: 15000,
        projectCount: 3,
        averagePerProject: 50,
        projects: []
      }

      const previousEarnings: WorkerEarnings = {
        totalGbp: 100,
        totalInr: 10000,
        projectCount: 2,
        averagePerProject: 50,
        projects: []
      }

      const growth = EarningsCalculator.calculateEarningsGrowth(currentEarnings, previousEarnings)
      
      expect(growth.percentageChange).toBe(50) // 50% increase
      expect(growth.absoluteChange).toBe(50) // £50 increase
      expect(growth.isPositive).toBe(true)
    })

    it('should calculate negative earnings growth', () => {
      const currentEarnings: WorkerEarnings = {
        totalGbp: 75,
        totalInr: 7500,
        projectCount: 1,
        averagePerProject: 75,
        projects: []
      }

      const previousEarnings: WorkerEarnings = {
        totalGbp: 100,
        totalInr: 10000,
        projectCount: 2,
        averagePerProject: 50,
        projects: []
      }

      const growth = EarningsCalculator.calculateEarningsGrowth(currentEarnings, previousEarnings)
      
      expect(growth.percentageChange).toBe(-25) // 25% decrease
      expect(growth.absoluteChange).toBe(-25) // £25 decrease
      expect(growth.isPositive).toBe(false)
    })

    it('should handle zero previous earnings', () => {
      const currentEarnings: WorkerEarnings = {
        totalGbp: 100,
        totalInr: 10000,
        projectCount: 2,
        averagePerProject: 50,
        projects: []
      }

      const previousEarnings: WorkerEarnings = {
        totalGbp: 0,
        totalInr: 0,
        projectCount: 0,
        averagePerProject: 0,
        projects: []
      }

      const growth = EarningsCalculator.calculateEarningsGrowth(currentEarnings, previousEarnings)
      
      expect(growth.percentageChange).toBe(100) // 100% when starting from zero
      expect(growth.absoluteChange).toBe(100)
      expect(growth.isPositive).toBe(true)
    })
  })

  describe('Data Validation Tests', () => {
    it('should validate projects for earnings calculations', () => {
      const validProjects = createSampleProjects()
      const validation = EarningsCalculator.validateProjectsForEarnings(validProjects)
      
      expect(validation.isValid).toBe(true)
      expect(validation.issues).toHaveLength(0)
      expect(validation.validProjects).toHaveLength(4)
    })

    it('should identify invalid projects', () => {
      const invalidProjects: Project[] = [
        {
          ...createSampleProjects()[0],
          cost_gbp: 0, // Invalid cost
          initial_word_count: -100 // Invalid word count
        },
        {
          ...createSampleProjects()[1],
          updated_at: '' // Invalid date
        }
      ]

      const validation = EarningsCalculator.validateProjectsForEarnings(invalidProjects)
      
      expect(validation.isValid).toBe(false)
      expect(validation.issues.length).toBeGreaterThan(0)
      expect(validation.validProjects).toHaveLength(0)
    })

    it('should handle mixed valid and invalid projects', () => {
      const mixedProjects = [
        createSampleProjects()[0], // Valid
        {
          ...createSampleProjects()[1],
          cost_gbp: 0 // Invalid
        }
      ]

      const validation = EarningsCalculator.validateProjectsForEarnings(mixedProjects)
      
      expect(validation.isValid).toBe(false)
      expect(validation.issues.length).toBeGreaterThan(0)
      expect(validation.validProjects).toHaveLength(1)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty project arrays gracefully', () => {
      const filter: TimeFilter = {
        type: 'month',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }

      const earnings = EarningsCalculator.calculateWorkerEarnings([], filter)
      const profit = EarningsCalculator.calculateAgentProfit([], filter)
      
      expect(earnings.totalGbp).toBe(0)
      expect(earnings.projectCount).toBe(0)
      expect(profit.totalRevenue).toBe(0)
      expect(profit.projectCount).toBe(0)
    })

    it('should handle projects with null/undefined values', () => {
      const projectsWithNulls: Project[] = [{
        id: 1,
        client_id: 'client-1',
        worker_id: null,
        agent_id: 'agent-1',
        title: 'Test Project',
        description: null,
        status: 'completed' as ProjectStatus,
        initial_word_count: 1000,
        adjusted_word_count: null, // Should fall back to initial_word_count
        cost_gbp: 100,
        deadline: '2024-01-15',
        order_reference: 'ORD-2024-01-000001',
        deadline_charge: 0,
        urgency_level: 'normal',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-10T00:00:00Z'
      }]

      const filter: TimeFilter = {
        type: 'month',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }

      const earnings = EarningsCalculator.calculateWorkerEarnings(projectsWithNulls, filter)
      
      // Should use initial_word_count when adjusted_word_count is null
      expect(earnings.totalGbp).toBe(50) // 1000 words = £50
    })

    it('should handle very large numbers correctly', () => {
      const largeProject: Project = {
        id: 1,
        client_id: 'client-1',
        worker_id: 'worker-1',
        agent_id: 'agent-1',
        title: 'Large Project',
        description: 'Very large project',
        status: 'completed' as ProjectStatus,
        initial_word_count: 1000000, // 1 million words
        adjusted_word_count: 1000000,
        cost_gbp: 50000, // £50,000
        deadline: '2024-01-15',
        order_reference: 'ORD-2024-01-000001',
        deadline_charge: 0,
        urgency_level: 'normal',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-10T00:00:00Z'
      }

      const filter: TimeFilter = {
        type: 'month',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }

      const earnings = EarningsCalculator.calculateWorkerEarnings([largeProject], filter)
      const profit = EarningsCalculator.calculateAgentProfit([largeProject], filter)
      
      expect(earnings.totalGbp).toBe(50000) // 1M words = £50,000
      expect(profit.totalRevenue).toBe(50000)
      expect(profit.totalWorkerPayments).toBe(50000)
      expect(profit.totalProfit).toBe(0) // No profit in this case
    })
  })
})