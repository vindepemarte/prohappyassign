/**
 * Tests for analytics data accuracy and chart rendering
 * Verifies that analytics calculations are correct and data is properly formatted for charts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProfitCalculator } from '../utils/profitCalculator'
import type { Project, ProjectStatus } from '../types'
import type { TimeFilter } from '../components/common/FilterBar'

// Mock constants
vi.mock('../constants', () => ({
  WORKER_PAY_RATE_PER_500_WORDS: 25,
  GBP_TO_INR_RATE: 100
}))

describe('Analytics Data Accuracy Tests', () => {
  // Create comprehensive test data spanning multiple months
  const createAnalyticsTestData = (): Project[] => {
    const projects: Project[] = []
    const clients = ['client-1', 'client-2', 'client-3', 'client-4']
    const workers = ['worker-1', 'worker-2', 'worker-3']
    
    // Generate projects for the last 6 months
    for (let month = 0; month < 6; month++) {
      const date = new Date()
      date.setMonth(date.getMonth() - month)
      
      // 3-5 projects per month
      const projectsThisMonth = 3 + (month % 3)
      
      for (let i = 0; i < projectsThisMonth; i++) {
        const projectId = month * 10 + i + 1
        const clientIndex = i % clients.length
        const workerIndex = i % workers.length
        
        projects.push({
          id: projectId,
          client_id: clients[clientIndex],
          worker_id: workers[workerIndex],
          agent_id: 'agent-1',
          title: `Project ${projectId}`,
          description: `Test project for month ${month}`,
          status: 'completed' as ProjectStatus,
          initial_word_count: 500 + (i * 250), // Varying word counts
          adjusted_word_count: 500 + (i * 250),
          cost_gbp: 50 + (i * 25), // Varying costs
          deadline: date.toISOString().split('T')[0],
          order_reference: `ORD-2024-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(6, '0')}`,
          deadline_charge: i % 2 === 0 ? 0 : 5, // Some projects have deadline charges
          urgency_level: i % 3 === 0 ? 'urgent' : 'normal',
          created_at: new Date(date.getFullYear(), date.getMonth(), 1 + i).toISOString(),
          updated_at: new Date(date.getFullYear(), date.getMonth(), 5 + i).toISOString()
        })
      }
    }
    
    return projects
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Monthly Profit Trends Tests', () => {
    it('should calculate accurate monthly trends', () => {
      const projects = createAnalyticsTestData()
      const trends = ProfitCalculator.calculateMonthlyProfitTrends(projects, 6)

      expect(trends).toHaveLength(6)

      // Verify each month has valid data
      trends.forEach(trend => {
        expect(trend.month).toMatch(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/)
        expect(trend.year).toBeGreaterThan(2020)
        expect(trend.revenue).toBeGreaterThanOrEqual(0)
        expect(trend.profit).toBeGreaterThanOrEqual(0)
        expect(trend.projects).toBeGreaterThanOrEqual(0)
        expect(trend.margin).toBeGreaterThanOrEqual(0)
      })

      // Verify profit calculation accuracy
      trends.forEach(trend => {
        if (trend.revenue > 0) {
          const expectedMargin = (trend.profit / trend.revenue) * 100
          expect(trend.margin).toBeCloseTo(expectedMargin, 2)
        }
      })
    })

    it('should handle months with no projects', () => {
      // Create projects only for specific months
      const projects: Project[] = [{
        id: 1,
        client_id: 'client-1',
        worker_id: 'worker-1',
        agent_id: 'agent-1',
        title: 'Single Project',
        description: 'Only project',
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
      }]

      const trends = ProfitCalculator.calculateMonthlyProfitTrends(projects, 12)

      // Should have 12 months of data
      expect(trends).toHaveLength(12)

      // Most months should have zero values
      const emptyMonths = trends.filter(t => t.projects === 0)
      expect(emptyMonths.length).toBeGreaterThan(10)

      // Empty months should have zero revenue and profit
      emptyMonths.forEach(month => {
        expect(month.revenue).toBe(0)
        expect(month.profit).toBe(0)
        expect(month.margin).toBe(0)
      })
    })

    it('should sort months chronologically', () => {
      const projects = createAnalyticsTestData()
      const trends = ProfitCalculator.calculateMonthlyProfitTrends(projects, 12)

      // Verify chronological order
      for (let i = 1; i < trends.length; i++) {
        const current = new Date(`${trends[i].month} 1, ${trends[i].year}`)
        const previous = new Date(`${trends[i-1].month} 1, ${trends[i-1].year}`)
        expect(current.getTime()).toBeGreaterThanOrEqual(previous.getTime())
      }
    })
  })

  describe('Client Profit Analysis Tests', () => {
    it('should calculate accurate client profit analysis', () => {
      const projects = createAnalyticsTestData()
      const filter: TimeFilter = {
        type: 'custom',
        startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // Last 6 months
        endDate: new Date()
      }

      const clientAnalysis = ProfitCalculator.calculateClientProfitAnalysis(projects, filter)

      expect(clientAnalysis.length).toBeGreaterThan(0)

      // Verify sorting by profit (descending)
      for (let i = 1; i < clientAnalysis.length; i++) {
        expect(clientAnalysis[i-1].profit).toBeGreaterThanOrEqual(clientAnalysis[i].profit)
      }

      // Verify calculations for each client
      clientAnalysis.forEach(client => {
        expect(client.clientId).toBeDefined()
        expect(client.revenue).toBeGreaterThan(0)
        expect(client.profit).toBeGreaterThanOrEqual(0)
        expect(client.projects).toBeGreaterThan(0)
        expect(client.averageProjectValue).toBe(client.revenue / client.projects)
        
        if (client.revenue > 0) {
          const expectedMargin = (client.profit / client.revenue) * 100
          expect(client.profitMargin).toBeCloseTo(expectedMargin, 2)
        }
      })
    })

    it('should handle clients with different project volumes', () => {
      const projects: Project[] = [
        // Client 1: High volume, low value
        ...Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          client_id: 'high-volume-client',
          worker_id: 'worker-1',
          agent_id: 'agent-1',
          title: `Small Project ${i + 1}`,
          description: 'Small project',
          status: 'completed' as ProjectStatus,
          initial_word_count: 500,
          adjusted_word_count: 500,
          cost_gbp: 30,
          deadline: '2024-01-15',
          order_reference: `ORD-2024-01-${String(i + 1).padStart(6, '0')}`,
          deadline_charge: 0,
          urgency_level: 'normal',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-10T00:00:00Z'
        })),
        // Client 2: Low volume, high value
        {
          id: 11,
          client_id: 'high-value-client',
          worker_id: 'worker-1',
          agent_id: 'agent-1',
          title: 'Large Project',
          description: 'Large project',
          status: 'completed' as ProjectStatus,
          initial_word_count: 5000,
          adjusted_word_count: 5000,
          cost_gbp: 500,
          deadline: '2024-01-15',
          order_reference: 'ORD-2024-01-000011',
          deadline_charge: 0,
          urgency_level: 'normal',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-10T00:00:00Z'
        }
      ]

      const filter: TimeFilter = {
        type: 'month',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }

      const analysis = ProfitCalculator.calculateClientProfitAnalysis(projects, filter)

      expect(analysis).toHaveLength(2)

      const highVolumeClient = analysis.find(c => c.clientId === 'high-volume-client')
      const highValueClient = analysis.find(c => c.clientId === 'high-value-client')

      expect(highVolumeClient).toBeDefined()
      expect(highValueClient).toBeDefined()

      // High volume client should have more projects but lower average value
      expect(highVolumeClient!.projects).toBe(10)
      expect(highVolumeClient!.averageProjectValue).toBe(30)

      // High value client should have fewer projects but higher average value
      expect(highValueClient!.projects).toBe(1)
      expect(highValueClient!.averageProjectValue).toBe(500)
    })
  })

  describe('Profit Comparison Tests', () => {
    it('should calculate accurate profit comparisons between periods', () => {
      const currentProjects = createAnalyticsTestData().slice(0, 10) // First 10 projects
      const previousProjects = createAnalyticsTestData().slice(10, 15) // Next 5 projects

      const currentFilter: TimeFilter = {
        type: 'month',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }

      const previousFilter: TimeFilter = {
        type: 'month',
        startDate: new Date('2023-12-01'),
        endDate: new Date('2023-12-31')
      }

      const comparison = ProfitCalculator.calculateProfitComparison(
        currentProjects,
        previousProjects,
        currentFilter,
        previousFilter
      )

      expect(comparison.current).toBeDefined()
      expect(comparison.previous).toBeDefined()
      expect(comparison.growth).toBeDefined()

      // Verify growth calculations
      const { current, previous, growth } = comparison

      if (previous.totalRevenue > 0) {
        const expectedRevenueGrowth = ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100
        expect(growth.revenue).toBeCloseTo(expectedRevenueGrowth, 2)
      }

      if (previous.totalProfit > 0) {
        const expectedProfitGrowth = ((current.totalProfit - previous.totalProfit) / previous.totalProfit) * 100
        expect(growth.profit).toBeCloseTo(expectedProfitGrowth, 2)
      }

      const expectedMarginChange = current.profitMargin - previous.profitMargin
      expect(growth.margin).toBeCloseTo(expectedMarginChange, 2)
    })

    it('should handle zero previous values in growth calculations', () => {
      const currentProjects = createAnalyticsTestData().slice(0, 5)
      const previousProjects: Project[] = [] // No previous projects

      const currentFilter: TimeFilter = {
        type: 'month',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }

      const previousFilter: TimeFilter = {
        type: 'month',
        startDate: new Date('2023-12-01'),
        endDate: new Date('2023-12-31')
      }

      const comparison = ProfitCalculator.calculateProfitComparison(
        currentProjects,
        previousProjects,
        currentFilter,
        previousFilter
      )

      // When previous values are zero, growth should be 100% if current > 0, or 0 if current = 0
      if (comparison.current.totalRevenue > 0) {
        expect(comparison.growth.revenue).toBe(100)
      }
      if (comparison.current.totalProfit > 0) {
        expect(comparison.growth.profit).toBe(100)
      }
    })
  })

  describe('Worker Payment Summary Tests', () => {
    it('should calculate accurate worker payment summaries', () => {
      const projects = createAnalyticsTestData()
      const filter: TimeFilter = {
        type: 'custom',
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 3 months
        endDate: new Date()
      }

      const workerPayments = ProfitCalculator.calculateWorkerPayments(projects, filter)

      expect(workerPayments.length).toBeGreaterThan(0)

      // Verify sorting by total payment (descending)
      for (let i = 1; i < workerPayments.length; i++) {
        expect(workerPayments[i-1].totalPayment).toBeGreaterThanOrEqual(workerPayments[i].totalPayment)
      }

      // Verify calculations for each worker
      workerPayments.forEach(worker => {
        expect(worker.workerId).toBeDefined()
        expect(worker.totalPayment).toBeGreaterThan(0)
        expect(worker.projectCount).toBeGreaterThan(0)
        expect(worker.averagePayment).toBe(worker.totalPayment / worker.projectCount)
        expect(worker.projects).toHaveLength(worker.projectCount)

        // Verify that all projects belong to this worker
        worker.projects.forEach(project => {
          expect(project.worker_id).toBe(worker.workerId)
          expect(project.status).toBe('completed')
        })
      })
    })

    it('should only include completed projects in worker payments', () => {
      const projects: Project[] = [
        {
          id: 1,
          client_id: 'client-1',
          worker_id: 'worker-1',
          agent_id: 'agent-1',
          title: 'Completed Project',
          description: 'This is completed',
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
          client_id: 'client-1',
          worker_id: 'worker-1',
          agent_id: 'agent-1',
          title: 'In Progress Project',
          description: 'This is in progress',
          status: 'in_progress' as ProjectStatus,
          initial_word_count: 1000,
          adjusted_word_count: 1000,
          cost_gbp: 100,
          deadline: '2024-01-15',
          order_reference: 'ORD-2024-01-000002',
          deadline_charge: 0,
          urgency_level: 'normal',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-10T00:00:00Z'
        }
      ]

      const filter: TimeFilter = {
        type: 'month',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      }

      const workerPayments = ProfitCalculator.calculateWorkerPayments(projects, filter)

      expect(workerPayments).toHaveLength(1)
      expect(workerPayments[0].projectCount).toBe(1) // Only completed project
      expect(workerPayments[0].totalPayment).toBe(50) // 1000 words = £50
    })
  })

  describe('Chart Data Formatting Tests', () => {
    it('should format profit display correctly', () => {
      const breakdown = {
        totalRevenue: 1000,
        totalWorkerPayments: 600,
        totalProfit: 400,
        profitMargin: 40,
        projectCount: 10,
        averageRevenue: 100,
        averageProfit: 40,
        averageWorkerPayment: 60
      }

      const formatted = ProfitCalculator.formatProfitDisplay(breakdown)
      expect(formatted).toBe('Profit £400.00 / To Give £600.00')
    })

    it('should get appropriate profit status colors', () => {
      expect(ProfitCalculator.getProfitStatusColor(60)).toBe('text-green-600') // High profit
      expect(ProfitCalculator.getProfitStatusColor(40)).toBe('text-blue-600') // Good profit
      expect(ProfitCalculator.getProfitStatusColor(20)).toBe('text-yellow-600') // Moderate profit
      expect(ProfitCalculator.getProfitStatusColor(5)).toBe('text-red-600') // Low profit
    })

    it('should handle edge cases in profit margin calculations', () => {
      // Zero revenue scenario
      const zeroRevenueBreakdown = {
        totalRevenue: 0,
        totalWorkerPayments: 0,
        totalProfit: 0,
        profitMargin: 0,
        projectCount: 0,
        averageRevenue: 0,
        averageProfit: 0,
        averageWorkerPayment: 0
      }

      const formatted = ProfitCalculator.formatProfitDisplay(zeroRevenueBreakdown)
      expect(formatted).toBe('Profit £0.00 / To Give £0.00')

      // Negative profit scenario
      const negativeBreakdown = {
        totalRevenue: 100,
        totalWorkerPayments: 150,
        totalProfit: -50,
        profitMargin: -50,
        projectCount: 1,
        averageRevenue: 100,
        averageProfit: -50,
        averageWorkerPayment: 150
      }

      const negativeFormatted = ProfitCalculator.formatProfitDisplay(negativeBreakdown)
      expect(negativeFormatted).toBe('Profit £-50.00 / To Give £150.00')
    })
  })

  describe('Data Accuracy Validation Tests', () => {
    it('should maintain data consistency across different calculations', () => {
      const projects = createAnalyticsTestData()
      const filter: TimeFilter = {
        type: 'custom',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last month
        endDate: new Date()
      }

      // Calculate using different methods
      const profitBreakdown = ProfitCalculator.calculateProfitBreakdown(projects, filter)
      const workerPayments = ProfitCalculator.calculateWorkerPayments(projects, filter)
      const clientAnalysis = ProfitCalculator.calculateClientProfitAnalysis(projects, filter)

      // Total worker payments should be consistent
      const totalWorkerPaymentsFromSummary = workerPayments.reduce((sum, w) => sum + w.totalPayment, 0)
      expect(profitBreakdown.totalWorkerPayments).toBeCloseTo(totalWorkerPaymentsFromSummary, 2)

      // Total revenue should be consistent
      const totalRevenueFromClients = clientAnalysis.reduce((sum, c) => sum + c.revenue, 0)
      expect(profitBreakdown.totalRevenue).toBeCloseTo(totalRevenueFromClients, 2)

      // Total profit should be consistent
      const totalProfitFromClients = clientAnalysis.reduce((sum, c) => sum + c.profit, 0)
      expect(profitBreakdown.totalProfit).toBeCloseTo(totalProfitFromClients, 2)
    })

    it('should handle rounding consistently across calculations', () => {
      const projects: Project[] = [{
        id: 1,
        client_id: 'client-1',
        worker_id: 'worker-1',
        agent_id: 'agent-1',
        title: 'Rounding Test Project',
        description: 'Project to test rounding',
        status: 'completed' as ProjectStatus,
        initial_word_count: 333, // Should result in fractional payment
        adjusted_word_count: 333,
        cost_gbp: 33.33,
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

      const breakdown = ProfitCalculator.calculateProfitBreakdown(projects, filter)
      
      // All monetary values should be rounded to 2 decimal places
      expect(breakdown.totalRevenue % 0.01).toBeCloseTo(0, 10)
      expect(breakdown.totalWorkerPayments % 0.01).toBeCloseTo(0, 10)
      expect(breakdown.totalProfit % 0.01).toBeCloseTo(0, 10)
      expect(breakdown.averageRevenue % 0.01).toBeCloseTo(0, 10)
      expect(breakdown.averageProfit % 0.01).toBeCloseTo(0, 10)
    })
  })
})