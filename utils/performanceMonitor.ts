interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
  memoryUsage?: number;
  type?: 'render' | 'interaction' | 'network' | 'computation';
}

interface WebVitalsMetrics {
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private completedMetrics: PerformanceMetric[] = [];
  private thresholds: Map<string, number> = new Map();
  private listeners: Array<(metric: PerformanceMetric) => void> = [];
  private observers: PerformanceObserver[] = [];
  private webVitals: WebVitalsMetrics = {};
  private isMonitoring = false;

  // Set performance thresholds for different operations
  setThreshold(operationName: string, thresholdMs: number) {
    this.thresholds.set(operationName, thresholdMs);
  }

  // Initialize performance monitoring
  initialize(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitorWebVitals();
    this.monitorMemoryUsage();
  }

  // Start timing an operation
  start(name: string, metadata?: Record<string, any>, type?: 'render' | 'interaction' | 'network' | 'computation'): void {
    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      metadata,
      type
    };

    // Add memory usage if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      metric.memoryUsage = memory.usedJSHeapSize;
    }
    
    this.metrics.set(name, metric);
  }

  // End timing an operation
  end(name: string): PerformanceMetric | null {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Performance metric "${name}" not found`);
      return null;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;

    // Add final memory usage if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const finalMemory = memory.usedJSHeapSize;
      if (metric.memoryUsage) {
        metric.metadata = {
          ...metric.metadata,
          memoryDelta: finalMemory - metric.memoryUsage
        };
      }
    }

    // Check if operation exceeded threshold
    const threshold = this.thresholds.get(name);
    if (threshold && metric.duration > threshold) {
      console.warn(
        `Performance warning: "${name}" took ${metric.duration.toFixed(2)}ms (threshold: ${threshold}ms)`,
        metric.metadata
      );
    }

    // Store completed metric
    this.completedMetrics.push({ ...metric });
    
    // Keep only last 1000 metrics to prevent memory leaks
    if (this.completedMetrics.length > 1000) {
      this.completedMetrics.splice(0, this.completedMetrics.length - 1000);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(metric));

    // Clean up
    this.metrics.delete(name);
    
    return metric;
  }

  // Measure a function execution
  async measure<T>(
    name: string,
    fn: () => Promise<T> | T,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.start(name, metadata);
    
    try {
      const result = await fn();
      this.end(name);
      return result;
    } catch (error) {
      this.end(name);
      throw error;
    }
  }

  // Add a listener for performance metrics
  addListener(listener: (metric: PerformanceMetric) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Monitor Core Web Vitals
  private monitorWebVitals(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    // Monitor Largest Contentful Paint (LCP)
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.webVitals.lcp = lastEntry.startTime;
        
        if (lastEntry.startTime > 2500) {
          console.warn(`Poor LCP: ${lastEntry.startTime.toFixed(2)}ms (should be < 2500ms)`);
        }
      });
      
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);
    } catch (e) {
      // LCP not supported
    }

    // Monitor First Input Delay (FID)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const fid = entry.processingStart - entry.startTime;
          this.webVitals.fid = fid;
          
          if (fid > 100) {
            console.warn(`Poor FID: ${fid.toFixed(2)}ms (should be < 100ms)`);
          }
        });
      });
      
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);
    } catch (e) {
      // FID not supported
    }

    // Monitor Cumulative Layout Shift (CLS)
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        this.webVitals.cls = clsValue;
        
        if (clsValue > 0.1) {
          console.warn(`Poor CLS: ${clsValue.toFixed(3)} (should be < 0.1)`);
        }
      });
      
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
    } catch (e) {
      // CLS not supported
    }

    // Monitor First Contentful Paint (FCP)
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          this.webVitals.fcp = entry.startTime;
        });
      });
      
      fcpObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(fcpObserver);
    } catch (e) {
      // FCP not supported
    }
  }

  // Monitor memory usage patterns
  private monitorMemoryUsage(): void {
    if (!('memory' in performance)) return;

    setInterval(() => {
      const memory = (performance as any).memory;
      const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
      const totalMB = Math.round(memory.totalJSHeapSize / 1048576);
      const limitMB = Math.round(memory.jsHeapSizeLimit / 1048576);
      
      // Warn if memory usage is high
      if (usedMB / limitMB > 0.8) {
        console.warn(`High memory usage: ${usedMB}MB / ${limitMB}MB (${Math.round(usedMB / limitMB * 100)}%)`);
      }
    }, 30000); // Check every 30 seconds
  }

  // Get Web Vitals metrics
  getWebVitals(): WebVitalsMetrics {
    return { ...this.webVitals };
  }

  // Get all completed metrics
  getMetrics(): PerformanceMetric[] {
    return [...this.completedMetrics];
  }

  // Clear all metrics
  clear(): void {
    this.metrics.clear();
    this.completedMetrics = [];
  }

  // Disconnect all observers
  disconnect(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.isMonitoring = false;
  }

  // Get performance summary
  getSummary(): Record<string, { count: number; avgDuration: number; maxDuration: number; type?: string }> {
    const summary: Record<string, { count: number; totalDuration: number; maxDuration: number; type?: string }> = {};
    
    this.getMetrics().forEach(metric => {
      if (!metric.duration) return;
      
      if (!summary[metric.name]) {
        summary[metric.name] = {
          count: 0,
          totalDuration: 0,
          maxDuration: 0,
          type: metric.type
        };
      }
      
      summary[metric.name].count++;
      summary[metric.name].totalDuration += metric.duration;
      summary[metric.name].maxDuration = Math.max(summary[metric.name].maxDuration, metric.duration);
    });

    // Convert to final format with averages
    const result: Record<string, { count: number; avgDuration: number; maxDuration: number; type?: string }> = {};
    Object.entries(summary).forEach(([name, data]) => {
      result[name] = {
        count: data.count,
        avgDuration: data.totalDuration / data.count,
        maxDuration: data.maxDuration,
        type: data.type
      };
    });

    return result;
  }

  // Get performance report with recommendations
  getPerformanceReport(): {
    webVitals: WebVitalsMetrics;
    summary: Record<string, any>;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    const summary = this.getSummary();
    
    // Analyze Web Vitals
    if (this.webVitals.lcp && this.webVitals.lcp > 2500) {
      recommendations.push('Optimize Largest Contentful Paint (LCP) - consider image optimization and server response times');
    }
    
    if (this.webVitals.fid && this.webVitals.fid > 100) {
      recommendations.push('Reduce First Input Delay (FID) - minimize JavaScript execution time');
    }
    
    if (this.webVitals.cls && this.webVitals.cls > 0.1) {
      recommendations.push('Improve Cumulative Layout Shift (CLS) - ensure proper sizing for images and ads');
    }

    // Analyze component performance
    Object.entries(summary).forEach(([name, stats]) => {
      if (stats.avgDuration > 100 && stats.type === 'render') {
        recommendations.push(`Optimize ${name} component - average render time is ${stats.avgDuration.toFixed(2)}ms`);
      }
      
      if (stats.avgDuration > 1000 && stats.type === 'network') {
        recommendations.push(`Optimize ${name} network request - average response time is ${stats.avgDuration.toFixed(2)}ms`);
      }
    });

    return {
      webVitals: this.webVitals,
      summary,
      recommendations
    };
  }
}

// Global instance
export const performanceMonitor = new PerformanceMonitor();

// Initialize and set default thresholds
performanceMonitor.initialize();
performanceMonitor.setThreshold('database-query', 1000); // 1 second
performanceMonitor.setThreshold('api-request', 2000); // 2 seconds
performanceMonitor.setThreshold('file-upload', 5000); // 5 seconds
performanceMonitor.setThreshold('component-render', 100); // 100ms
performanceMonitor.setThreshold('data-processing', 500); // 500ms
performanceMonitor.setThreshold('user-interaction', 50); // 50ms

// React hook for performance monitoring
export const usePerformanceMonitor = () => {
  const measure = async <T>(
    name: string,
    fn: () => Promise<T> | T,
    metadata?: Record<string, any>
  ): Promise<T> => {
    return performanceMonitor.measure(name, fn, metadata);
  };

  const start = (name: string, metadata?: Record<string, any>, type?: 'render' | 'interaction' | 'network' | 'computation') => {
    performanceMonitor.start(name, metadata, type);
  };

  const end = (name: string) => {
    return performanceMonitor.end(name);
  };

  const getWebVitals = () => {
    return performanceMonitor.getWebVitals();
  };

  const getReport = () => {
    return performanceMonitor.getPerformanceReport();
  };

  return { measure, start, end, getWebVitals, getReport };
};

// Decorator for measuring function performance
export const measurePerformance = (name?: string) => {
  return function <T extends (...args: any[]) => any>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const originalMethod = descriptor.value;
    const metricName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      return performanceMonitor.measure(
        metricName,
        () => originalMethod?.apply(this, args),
        { args: args.length }
      );
    } as T;

    return descriptor;
  };
};

export type { PerformanceMetric, WebVitalsMetrics };