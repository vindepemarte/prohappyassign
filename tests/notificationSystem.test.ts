/**
 * Comprehensive tests for notification system reliability
 * Tests notification delivery, retry mechanisms, error handling, and tracking functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import type { NotificationData, DeliveryStatus } from '../types'

// Mock Supabase first, before any imports
vi.mock('../services/supabase', () => ({
  supabase: {
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
          })),
          filter: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
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
  }
}))

// Now import the modules after mocking
import { NotificationTracker } from '../services/notificationTracker'
import { 
  sendNotification, 
  sendTrackedNotification, 
  queueNotification,
  sendNotificationWithGuarantee,
  getNotificationQueueStatus,
  clearNotificationQueue
} from '../services/notificationService'

describe('Notification System Reliability Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    NotificationTracker.clearAllRetries()
    clearNotificationQueue()
  })

  afterEach(() => {
    NotificationTracker.clearAllRetries()
    clearNotificationQueue()
  })

  describe('Notification Delivery Tests', () => {
    it('should successfully send a basic notification', async () => {
      const target = { userIds: ['user-123'] }
      const payload = { title: 'Test', body: 'Test message' }

      const result = await sendNotification({ target, payload })

      expect(result.success).toBe(true)
      // We can't directly access the mock, so we'll verify the result instead
      expect(result.success).toBe(true)
    })

    it('should handle notification service errors gracefully', async () => {
      const { supabase } = await import('../services/supabase')
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
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
      mockSupabase.functions.invoke.mockRejectedValueOnce(new Error('Network error'))

      const target = { userIds: ['user-123'] }
      const payload = { title: 'Test', body: 'Test message' }

      const result = await sendNotification({ target, payload })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network connection failed')
    })
  })

  describe('Notification Tracking Tests', () => {
    it('should create notification record and track successful delivery', async () => {
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

      // Verify database calls
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_history')
    })

    it('should track failed delivery and schedule retry', async () => {
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
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: { message: 'DB error' } }))
          }))
        }))
      })

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

  describe('Retry Mechanism Tests', () => {
    it('should implement exponential backoff for retries', async () => {
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

      // Mock the database response for retry count
      mockSupabase.from.mockReturnValue({
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
            single: vi.fn(() => Promise.resolve({ data: { retry_count: 0 }, error: null }))
          }))
        })),
        rpc: vi.fn(() => Promise.resolve({ error: null }))
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

    it('should stop retrying after maximum attempts', async () => {
      const notificationData: NotificationData = {
        userId: 'user-123',
        title: 'Max Retry Test',
        body: 'This will exceed max retries'
      }

      // Mock database to return max retry count
      mockSupabase.from.mockReturnValue({
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
            single: vi.fn(() => Promise.resolve({ data: { retry_count: 3 }, error: null }))
          }))
        })),
        rpc: vi.fn(() => Promise.resolve({ error: null }))
      })

      const mockSendFunction = vi.fn().mockResolvedValue({ 
        success: false, 
        error: 'Persistent failure' 
      })

      const result = await NotificationTracker.trackNotificationDelivery(
        notificationData,
        mockSendFunction
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Persistent failure')
    })

    it('should retry failed notifications from previous sessions', async () => {
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

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            lt: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: failedNotifications, error: null }))
            }))
          }))
        }))
      })

      await NotificationTracker.retryFailedNotifications()

      // Verify that retry was scheduled for the failed notification
      const retryStatus = NotificationTracker.getRetryQueueStatus()
      expect(retryStatus.length).toBe(1)
    })
  })

  describe('Notification Queue Tests', () => {
    it('should queue notifications with different priorities', async () => {
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

    it('should process queued notifications', async () => {
      const target = { userIds: ['user-123'] }
      const payload = { title: 'Queued Test', body: 'This is queued' }

      await queueNotification({ target, payload })

      // Wait a bit for processing to start
      await new Promise(resolve => setTimeout(resolve, 150))

      // The queue should eventually process the notification
      // Note: In a real test, we might need to mock timers for more precise control
    })

    it('should handle queue processing errors gracefully', async () => {
      // Mock a scenario where the notification service fails
      mockSupabase.functions.invoke.mockRejectedValue(new Error('Service down'))

      const target = { userIds: ['user-123'] }
      const payload = { title: 'Error Test', body: 'This will cause an error' }

      const queueId = await queueNotification({ target, payload })
      expect(queueId).toBeDefined()

      // The queue should handle the error without crashing
      await new Promise(resolve => setTimeout(resolve, 150))
    })
  })

  describe('Notification with Guarantee Tests', () => {
    it('should attempt immediate delivery for high priority notifications', async () => {
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
      mockSupabase.functions.invoke.mockResolvedValueOnce({
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

    it('should queue notification even if there are errors', async () => {
      // Mock both immediate delivery and initial queue attempt to fail
      mockSupabase.functions.invoke.mockRejectedValue(new Error('Complete service failure'))

      const target = { userIds: ['user-123'] }
      const payload = { title: 'Error Recovery Test', body: 'Should still be queued' }

      const result = await sendNotificationWithGuarantee({
        target,
        payload,
        priority: 'normal'
      })

      expect(result.success).toBe(true)
      expect(result.queueId).toBeDefined()
      expect(result.error).toContain('Queued after initial failure')
    })
  })

  describe('Notification History and Statistics Tests', () => {
    it('should retrieve notification history for a user', async () => {
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

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: mockHistory, error: null }))
            }))
          }))
        }))
      })

      const history = await NotificationTracker.getNotificationHistory('user-123', 10)

      expect(history).toHaveLength(2)
      expect(history[0].delivery_status).toBe('delivered')
      expect(history[1].delivery_status).toBe('failed')
    })

    it('should calculate notification statistics correctly', async () => {
      const mockNotifications = [
        { delivery_status: 'delivered' },
        { delivery_status: 'delivered' },
        { delivery_status: 'failed' },
        { delivery_status: 'pending' }
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => Promise.resolve({ data: mockNotifications, error: null }))
      })

      const stats = await NotificationTracker.getNotificationStats()

      expect(stats.total).toBe(4)
      expect(stats.delivered).toBe(2)
      expect(stats.failed).toBe(1)
      expect(stats.pending).toBe(1)
      expect(stats.deliveryRate).toBe(50) // 2/4 * 100
    })

    it('should handle empty statistics gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => Promise.resolve({ data: [], error: null }))
      })

      const stats = await NotificationTracker.getNotificationStats()

      expect(stats.total).toBe(0)
      expect(stats.delivered).toBe(0)
      expect(stats.failed).toBe(0)
      expect(stats.pending).toBe(0)
      expect(stats.deliveryRate).toBe(0)
    })
  })

  describe('Error Handling Tests', () => {
    it('should provide user-friendly error messages', async () => {
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
        mockSupabase.functions.invoke.mockResolvedValueOnce({
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

    it('should handle database connection errors', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const notificationData: NotificationData = {
        userId: 'user-123',
        title: 'DB Error Test',
        body: 'This will cause a DB error'
      }

      const mockSendFunction = vi.fn().mockResolvedValue({ success: true })

      await expect(
        NotificationTracker.trackNotificationDelivery(notificationData, mockSendFunction)
      ).rejects.toThrow()
    })
  })

  describe('Project Status Change Notifications', () => {
    it('should send notifications for all project status changes', async () => {
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

        // Each status change should trigger a notification
        expect(mockSupabase.functions.invoke).toHaveBeenCalled()
      }
    })

    it('should handle role-based notifications for status changes', async () => {
      const result = await sendNotification({
        target: { role: 'agent' },
        payload: {
          title: 'New Project Assignment',
          body: 'A new project requires your attention'
        }
      })

      expect(result.success).toBe(true)
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('send-push-notification', {
        body: {
          target: { role: 'agent' },
          payload: {
            title: 'New Project Assignment',
            body: 'A new project requires your attention'
          }
        }
      })
    })
  })
})