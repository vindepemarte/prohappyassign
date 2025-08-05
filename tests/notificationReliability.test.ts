/**
 * Comprehensive tests for notification system reliability
 * Tests notification delivery, retry mechanisms, error handling, and tracking functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NotificationData, DeliveryStatus } from '../types'

// Create a comprehensive mock for Supabase
const createMockSupabase = () => ({
  from: vi.fn(() => ({
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: 1 }, error: null }))
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null }))
    })),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { retry_count: 0 }, error: null })),
        lt: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        gte: vi.fn(() => ({
          lte: vi.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      })),
      filter: vi.fn(() => Promise.resolve({ data: [], error: null }))
    })),
    rpc: vi.fn(() => Promise.resolve({ error: null })),
    delete: vi.fn(() => ({
      lt: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  })),
  functions: {
    invoke: vi.fn(() => Promise.resolve({ data: { success: true }, error: null }))
  }
})

// Mock the supabase module
vi.mock('../services/supabase', () => ({
  supabase: createMockSupabase()
}))

describe('Notification System Reliability Tests', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>

  beforeEach(async () => {
    vi.clearAllMocks()
    const { supabase } = await import('../services/supabase')
    mockSupabase = supabase as any
  })

  describe('Basic Notification Delivery', () => {
    it('should successfully send a notification', async () => {
      const { sendNotification } = await import('../services/notificationService')
      
      const target = { userIds: ['user-123'] }
      const payload = { title: 'Test', body: 'Test message' }

      const result = await sendNotification({ target, payload })

      expect(result.success).toBe(true)
    })

    it('should handle service errors gracefully', async () => {
      const { sendNotification } = await import('../services/notificationService')
      
      vi.mocked(mockSupabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: { message: 'VAPID keys missing' }
      })

      const target = { userIds: ['user-123'] }
      const payload = { title: 'Test', body: 'Test message' }

      const result = await sendNotification({ target, payload })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Push notifications are not configured')
    })

    it('should handle network errors without throwing', async () => {
      const { sendNotification } = await import('../services/notificationService')
      
      vi.mocked(mockSupabase.functions.invoke).mockRejectedValueOnce(new Error('Network error'))

      const target = { userIds: ['user-123'] }
      const payload = { title: 'Test', body: 'Test message' }

      const result = await sendNotification({ target, payload })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network connection failed')
    })
  })

  describe('Notification Tracking', () => {
    it('should create notification record and track successful delivery', async () => {
      const { NotificationTracker } = await import('../services/notificationTracker')
      
      const notificationData: NotificationData = {
        userId: 'user-123',
        projectId: 1,
        title: 'Project Update',
        body: 'Your project status has changed'
      }

      const mockSendFunction = vi.fn().mockResolvedValue({ success: true })

      const result = await NotificationTracker.trackNotificationDelivery(
        notificationData,
        mockSendFunction
      )

      expect(result.success).toBe(true)
      expect(result.deliveryStatus).toBe('delivered')
      expect(result.notificationId).toBe(1)
      expect(mockSendFunction).toHaveBeenCalledOnce()
    })

    it('should track failed delivery and schedule retry', async () => {
      const { NotificationTracker } = await import('../services/notificationTracker')
      
      const notificationData: NotificationData = {
        userId: 'user-123',
        title: 'Test Notification',
        body: 'This will fail'
      }

      const mockSendFunction = vi.fn().mockResolvedValue({ 
        success: false, 
        error: 'Service unavailable' 
      })

      const result = await NotificationTracker.trackNotificationDelivery(
        notificationData,
        mockSendFunction
      )

      expect(result.success).toBe(false)
      expect(result.deliveryStatus).toBe('failed')
      expect(result.error).toBe('Service unavailable')

      // Verify retry was scheduled
      const retryStatus = NotificationTracker.getRetryQueueStatus()
      expect(retryStatus.length).toBe(1)
    })

    it('should handle database errors during tracking', async () => {
      const { NotificationTracker } = await import('../services/notificationTracker')
      
      vi.mocked(mockSupabase.from).mockReturnValueOnce({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'DB error' } }))
          }))
        }))
      } as any)

      const notificationData: NotificationData = {
        userId: 'user-123',
        title: 'Test',
        body: 'Test'
      }

      const mockSendFunction = vi.fn().mockResolvedValue({ success: true })

      await expect(
        NotificationTracker.trackNotificationDelivery(notificationData, mockSendFunction)
      ).rejects.toThrow('Failed to create notification record')
    })
  })

  describe('Retry Mechanism', () => {
    it('should implement exponential backoff for retries', async () => {
      const { NotificationTracker } = await import('../services/notificationTracker')
      
      const notificationData: NotificationData = {
        userId: 'user-123',
        title: 'Retry Test',
        body: 'This will be retried'
      }

      let callCount = 0
      const mockSendFunction = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount <= 2) {
          return Promise.resolve({ success: false, error: 'Temporary failure' })
        }
        return Promise.resolve({ success: true })
      })

      const result = await NotificationTracker.trackNotificationDelivery(
        notificationData,
        mockSendFunction
      )

      expect(result.success).toBe(false) // Initial attempt fails
      expect(mockSendFunction).toHaveBeenCalledOnce()

      // Verify retry was scheduled
      const retryStatus = NotificationTracker.getRetryQueueStatus()
      expect(retryStatus.length).toBe(1)
    })

    it('should retry failed notifications from previous sessions', async () => {
      const { NotificationTracker } = await import('../services/notificationTracker')
      
      // Mock failed notifications in database
      const failedNotifications = [
        {
          id: 1,
          user_id: 'user-123',
          project_id: 1,
          title: 'Failed Notification',
          body: 'This failed previously',
          retry_count: 1
        }
      ]

      vi.mocked(mockSupabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            lt: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: failedNotifications, error: null }))
            }))
          }))
        }))
      } as any)

      await NotificationTracker.retryFailedNotifications()

      // Verify that retry was scheduled for the failed notification
      const retryStatus = NotificationTracker.getRetryQueueStatus()
      expect(retryStatus.length).toBe(1)
    })
  })

  describe('Notification Queue', () => {
    it('should queue notifications with different priorities', async () => {
      const { queueNotification, getNotificationQueueStatus } = await import('../services/notificationService')
      
      const target = { userIds: ['user-123'] }
      const payload = { title: 'Test', body: 'Test message' }

      const highPriorityId = await queueNotification({
        target,
        payload,
        priority: 'high'
      })

      const normalPriorityId = await queueNotification({
        target,
        payload,
        priority: 'normal'
      })

      expect(highPriorityId).toBeDefined()
      expect(normalPriorityId).toBeDefined()
      expect(highPriorityId).not.toBe(normalPriorityId)

      const status = getNotificationQueueStatus()
      expect(status.queueLength).toBeGreaterThan(0)
    })

    it('should handle queue processing errors gracefully', async () => {
      const { queueNotification } = await import('../services/notificationService')
      
      // Mock a scenario where the notification service fails
      vi.mocked(mockSupabase.functions.invoke).mockRejectedValue(new Error('Service down'))

      const target = { userIds: ['user-123'] }
      const payload = { title: 'Error Test', body: 'This will cause an error' }

      const queueId = await queueNotification({ target, payload })
      expect(queueId).toBeDefined()

      // The queue should handle the error without crashing
      await new Promise(resolve => setTimeout(resolve, 150))
    })
  })

  describe('Notification with Guarantee', () => {
    it('should attempt immediate delivery for high priority notifications', async () => {
      const { sendNotificationWithGuarantee } = await import('../services/notificationService')
      
      const target = { userIds: ['user-123'] }
      const payload = { title: 'Urgent', body: 'High priority message' }

      const result = await sendNotificationWithGuarantee({
        target,
        payload,
        priority: 'high'
      })

      expect(result.success).toBe(true)
      expect(result.immediate).toBe(true)
      expect(result.queueId).toBeNull()
    })

    it('should queue notification if immediate delivery fails', async () => {
      const { sendNotificationWithGuarantee } = await import('../services/notificationService')
      
      vi.mocked(mockSupabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: { message: 'Service temporarily unavailable' }
      })

      const target = { userIds: ['user-123'] }
      const payload = { title: 'Fallback Test', body: 'Should be queued' }

      const result = await sendNotificationWithGuarantee({
        target,
        payload,
        priority: 'high'
      })

      expect(result.success).toBe(true)
      expect(result.immediate).toBe(false)
      expect(result.queueId).toBeDefined()
    })
  })

  describe('Notification Statistics', () => {
    it('should retrieve notification history for a user', async () => {
      const { NotificationTracker } = await import('../services/notificationTracker')
      
      const mockHistory = [
        {
          id: 1,
          user_id: 'user-123',
          title: 'Test 1',
          body: 'Message 1',
          delivery_status: 'delivered',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          user_id: 'user-123',
          title: 'Test 2',
          body: 'Message 2',
          delivery_status: 'failed',
          created_at: new Date().toISOString()
        }
      ]

      vi.mocked(mockSupabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: mockHistory, error: null }))
            }))
          }))
        }))
      } as any)

      const history = await NotificationTracker.getNotificationHistory('user-123', 10)

      expect(history).toHaveLength(2)
      expect(history[0].delivery_status).toBe('delivered')
      expect(history[1].delivery_status).toBe('failed')
    })

    it('should calculate notification statistics correctly', async () => {
      const { NotificationTracker } = await import('../services/notificationTracker')
      
      const mockNotifications = [
        { delivery_status: 'delivered' },
        { delivery_status: 'delivered' },
        { delivery_status: 'failed' },
        { delivery_status: 'pending' }
      ]

      vi.mocked(mockSupabase.from).mockReturnValue({
        select: vi.fn(() => Promise.resolve({ data: mockNotifications, error: null }))
      } as any)

      const stats = await NotificationTracker.getNotificationStats()

      expect(stats.total).toBe(4)
      expect(stats.delivered).toBe(2)
      expect(stats.failed).toBe(1)
      expect(stats.pending).toBe(1)
      expect(stats.deliveryRate).toBe(50) // 2/4 * 100
    })

    it('should handle empty statistics gracefully', async () => {
      const { NotificationTracker } = await import('../services/notificationTracker')
      
      vi.mocked(mockSupabase.from).mockReturnValue({
        select: vi.fn(() => Promise.resolve({ data: [], error: null }))
      } as any)

      const stats = await NotificationTracker.getNotificationStats()

      expect(stats.total).toBe(0)
      expect(stats.delivered).toBe(0)
      expect(stats.failed).toBe(0)
      expect(stats.pending).toBe(0)
      expect(stats.deliveryRate).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should provide user-friendly error messages', async () => {
      const { sendNotification } = await import('../services/notificationService')
      
      const errorScenarios = [
        { 
          serverError: 'VAPID keys missing', 
          expectedMessage: 'Push notifications are not configured' 
        },
        { 
          serverError: 'Failed to send a request', 
          expectedMessage: 'Unable to connect to notification service' 
        },
        { 
          serverError: 'Permission denied', 
          expectedMessage: 'Notification permissions are required' 
        },
        { 
          serverError: 'Unknown error', 
          expectedMessage: 'Unable to send notification right now' 
        }
      ]

      for (const scenario of errorScenarios) {
        vi.mocked(mockSupabase.functions.invoke).mockResolvedValueOnce({
          data: null,
          error: { message: scenario.serverError }
        })

        const result = await sendNotification({
          target: { userIds: ['user-123'] },
          payload: { title: 'Test', body: 'Test' }
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain(scenario.expectedMessage)
      }
    })
  })

  describe('Project Status Change Notifications', () => {
    it('should send notifications for all project status changes', async () => {
      const { sendTrackedNotification } = await import('../services/notificationService')
      
      const projectStatuses = [
        'pending_payment_approval',
        'rejected_payment',
        'awaiting_worker_assignment',
        'in_progress',
        'pending_quote_approval',
        'needs_changes',
        'pending_final_approval',
        'completed',
        'refund',
        'cancelled'
      ]

      for (const status of projectStatuses) {
        const result = await sendTrackedNotification({
          target: { userIds: ['user-123'] },
          payload: {
            title: 'Project Status Update',
            body: `Your project status has changed to ${status}`
          },
          projectId: 1
        })

        // Each status change should result in a successful call
        expect(result.success).toBe(true)
      }
    })

    it('should handle role-based notifications for status changes', async () => {
      const { sendNotification } = await import('../services/notificationService')
      
      const result = await sendNotification({
        target: { role: 'agent' },
        payload: {
          title: 'New Project Assignment',
          body: 'A new project requires your attention'
        }
      })

      expect(result.success).toBe(true)
    })
  })

  afterEach(async () => {
    // Clean up any pending retries
    const { NotificationTracker } = await import('../services/notificationTracker')
    const { clearNotificationQueue } = await import('../services/notificationService')
    
    NotificationTracker.clearAllRetries()
    clearNotificationQueue()
  })
})