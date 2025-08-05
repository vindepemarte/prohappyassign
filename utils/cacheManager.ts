interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
  staleWhileRevalidate?: boolean; // Return stale data while fetching fresh data
}

class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default
  private maxSize = 100; // Default max size
  private accessOrder = new Map<string, number>(); // For LRU eviction

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.ttl || this.defaultTTL;
    this.maxSize = options.maxSize || this.maxSize;
  }

  // Set data in cache
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);
    
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt
    });

    this.accessOrder.set(key, now);
  }

  // Get data from cache
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return null;
    }

    // Update access order for LRU
    this.accessOrder.set(key, now);
    
    return entry.data;
  }

  // Get data with stale-while-revalidate pattern
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: { ttl?: number; staleWhileRevalidate?: boolean } = {}
  ): Promise<T> {
    const cached = this.get<T>(key);
    const now = Date.now();
    
    if (cached) {
      const entry = this.cache.get(key);
      
      // If stale-while-revalidate is enabled and data is getting stale
      if (options.staleWhileRevalidate && entry) {
        const staleThreshold = entry.expiresAt - (options.ttl || this.defaultTTL) * 0.2; // 20% before expiry
        
        if (now > staleThreshold) {
          // Return stale data immediately, fetch fresh data in background
          this.fetchAndCache(key, fetchFn, options.ttl);
        }
      }
      
      return cached;
    }

    // No cached data, fetch fresh
    return this.fetchAndCache(key, fetchFn, options.ttl);
  }

  // Fetch data and cache it
  private async fetchAndCache<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> {
    try {
      const data = await fetchFn();
      this.set(key, data, ttl);
      return data;
    } catch (error) {
      // If fetch fails, try to return stale data if available
      const staleEntry = this.cache.get(key);
      if (staleEntry) {
        console.warn(`Fetch failed for ${key}, returning stale data`, error);
        return staleEntry.data;
      }
      throw error;
    }
  }

  // Check if key exists and is not expired
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return false;
    }
    
    return true;
  }

  // Delete specific key
  delete(key: string): boolean {
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
  }

  // Get cache statistics
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; age: number; expiresIn: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      expiresIn: entry.expiresAt - now
    }));

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need to track hits/misses for accurate calculation
      entries
    };
  }

  // Evict least recently used entries
  private evictLRU(): void {
    if (this.accessOrder.size === 0) return;

    // Find the least recently used key
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, time] of this.accessOrder.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
    }
  }

  // Clean up expired entries
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// Global cache instances for different data types
export const projectCache = new CacheManager({
  ttl: 2 * 60 * 1000, // 2 minutes for project data
  maxSize: 50,
  staleWhileRevalidate: true
});

export const userCache = new CacheManager({
  ttl: 10 * 60 * 1000, // 10 minutes for user data
  maxSize: 100
});

export const analyticsCache = new CacheManager({
  ttl: 5 * 60 * 1000, // 5 minutes for analytics
  maxSize: 20
});

export const exchangeRateCache = new CacheManager({
  ttl: 60 * 60 * 1000, // 1 hour for exchange rates
  maxSize: 10
});

// Cleanup expired entries periodically
setInterval(() => {
  projectCache.cleanup();
  userCache.cleanup();
  analyticsCache.cleanup();
  exchangeRateCache.cleanup();
}, 5 * 60 * 1000); // Every 5 minutes

export { CacheManager };
export type { CacheOptions, CacheEntry };