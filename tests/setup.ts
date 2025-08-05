import { vi } from 'vitest'

// Mock global objects that might be needed
global.fetch = vi.fn()

// Mock Notification API
global.Notification = {
  requestPermission: vi.fn().mockResolvedValue('granted'),
} as any

// Mock navigator.serviceWorker
Object.defineProperty(global.navigator, 'serviceWorker', {
  value: {
    ready: Promise.resolve({
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(null),
        subscribe: vi.fn().mockResolvedValue({
          toJSON: vi.fn().mockReturnValue({
            endpoint: 'test-endpoint',
            keys: { p256dh: 'test-key', auth: 'test-auth' }
          })
        })
      }
    })
  },
  writable: true
})

// Mock window.atob
global.atob = vi.fn().mockImplementation((str: string) => {
  return Buffer.from(str, 'base64').toString('binary')
})

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}