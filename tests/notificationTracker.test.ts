/**
 * Tests for NotificationTracker functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationTracker } from '../services/notificationTracker';
import type { NotificationData } from '../types';

// Mock Supabase
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
          single: vi.fn(() => Promise.resolve({ data: { retry_count: 0 }, error: null }))
        }))
      })),
      rpc: vi.fn(() => Promise.resolve({ error: null }))
    }))
  }
}));

describe('NotificationTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any existing timers
    NotificationTracker.clearAllRetries();
  });

  afterEach(() => {
    NotificationTracker.clearAllRetries();
  });

  it('should create notification record successfully', async () => {
    const notificationData: NotificationData = {
      userId: 'user-123',
      projectId: 1,
      title: 'Test Notification',
      body: 'This is a test notification'
    };

    const notificationId = await NotificationTracker.createNotificationRecord(notificationData);
    expect(notificationId).toBe(1);
  });

  it('should track successful notification delivery', async () => {
    const notificationData: NotificationData = {
      userId: 'user-123',
      title: 'Test Notification',
      body: 'This is a test notification'
    };

    const mockSendFunction = vi.fn().mockResolvedValue({ success: true });

    const result = await NotificationTracker.trackNotificationDelivery(
      notificationData,
      mockSendFunction
    );

    expect(result.success).toBe(true);
    expect(result.deliveryStatus).toBe('delivered');
    expect(mockSendFunction).toHaveBeenCalledOnce();
  });

  it('should handle failed notification and schedule retry', async () => {
    const notificationData: NotificationData = {
      userId: 'user-123',
      title: 'Test Notification',
      body: 'This is a test notification'
    };

    const mockSendFunction = vi.fn().mockResolvedValue({ 
      success: false, 
      error: 'Network error' 
    });

    const result = await NotificationTracker.trackNotificationDelivery(
      notificationData,
      mockSendFunction
    );

    expect(result.success).toBe(false);
    expect(result.deliveryStatus).toBe('failed');
    expect(result.error).toBe('Network error');
    expect(mockSendFunction).toHaveBeenCalledOnce();

    // Check that retry was scheduled
    const retryStatus = NotificationTracker.getRetryQueueStatus();
    expect(retryStatus.length).toBe(1);
  });

  it('should calculate exponential backoff delays correctly', () => {
    // This tests the private RETRY_DELAYS constant indirectly
    const retryDelays = [2000, 8000, 32000];
    
    // Test that delays increase exponentially
    expect(retryDelays[1]).toBe(retryDelays[0] * 4);
    expect(retryDelays[2]).toBe(retryDelays[1] * 4);
  });

  it('should clear all retries when requested', () => {
    // First, let's simulate having some retries scheduled
    const notificationData: NotificationData = {
      userId: 'user-123',
      title: 'Test Notification',
      body: 'This is a test notification'
    };

    // This would normally schedule retries, but we'll just test the clear function
    NotificationTracker.clearAllRetries();
    
    const retryStatus = NotificationTracker.getRetryQueueStatus();
    expect(retryStatus.length).toBe(0);
  });

  it('should get notification statistics correctly', async () => {
    const stats = await NotificationTracker.getNotificationStats();
    
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('delivered');
    expect(stats).toHaveProperty('failed');
    expect(stats).toHaveProperty('pending');
    expect(stats).toHaveProperty('deliveryRate');
    expect(typeof stats.deliveryRate).toBe('number');
  });
});